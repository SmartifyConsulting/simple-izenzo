import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { providerById } from "@/lib/integrations.catalog";

/** Same gate as every other admin screen: any account holding the admin role. */
async function assertAdmin(context: { supabase: any; userId: string; claims?: any }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) {
    throw new Error("Forbidden — this area is restricted to administrators.");
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type IntegrationRow = {
  provider: string;
  environment: string;
  enabled: boolean;
  config: Record<string, string>;
  maskedSecrets: Record<string, string>;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  updatedAt: string | null;
};

/** Everything saved, with secrets masked. Never returns plaintext. */
export const listIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationRow[]> => {
    await assertAdmin(context as any);
    const { decryptSecrets, maskValue } = await import("@/lib/integrationCrypto.server");
    const { data, error } = await (await admin())
      .from("integration_credentials")
      .select("*")
      .order("provider");
    if (error) throw new Error(error.message);

    const rows: IntegrationRow[] = [];
    for (const r of data ?? []) {
      let masked: Record<string, string> = {};
      try {
        const plain = await decryptSecrets(r.secrets_encrypted as string | null);
        masked = Object.fromEntries(Object.entries(plain).map(([k, v]) => [k, maskValue(v)]));
      } catch {
        masked = Object.fromEntries((r.secret_field_names ?? []).map((k: string) => [k, "••••"]));
      }
      rows.push({
        provider: r.provider,
        environment: r.environment,
        enabled: r.enabled,
        config: (r.config ?? {}) as Record<string, string>,
        maskedSecrets: masked,
        lastTestedAt: r.last_tested_at,
        lastTestOk: r.last_test_ok,
        lastTestMessage: r.last_test_message,
        updatedAt: r.updated_at,
      });
    }
    return rows;
  });

const saveInput = (data: unknown) =>
  z
    .object({
      provider: z.string().min(1),
      environment: z.string().min(1),
      enabled: z.boolean(),
      config: z.record(z.string(), z.string()),
      /** Only the secret fields the admin actually retyped; blanks keep the stored value. */
      secrets: z.record(z.string(), z.string()),
    })
    .parse(data);

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(saveInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const spec = providerById(data.provider);
    if (!spec) throw new Error("Unknown provider");

    const { encryptSecrets, decryptSecrets } = await import("@/lib/integrationCrypto.server");
    const db = await admin();

    const { data: existing } = await db
      .from("integration_credentials")
      .select("secrets_encrypted")
      .eq("provider", data.provider)
      .maybeSingle();

    let current: Record<string, string> = {};
    try {
      current = await decryptSecrets((existing?.secrets_encrypted as string | null) ?? null);
    } catch {
      current = {};
    }

    for (const field of spec.fields.filter((f) => f.secret)) {
      const next = data.secrets[field.key];
      if (typeof next === "string" && next.length > 0) current[field.key] = next;
    }
    // Drop any secret no longer in the catalogue.
    const allowed = new Set(spec.fields.filter((f) => f.secret).map((f) => f.key));
    for (const key of Object.keys(current)) if (!allowed.has(key)) delete current[key];

    const payload = {
      provider: data.provider,
      environment: data.environment,
      enabled: data.enabled,
      config: data.config,
      secrets_encrypted: await encryptSecrets(current),
      secret_field_names: Object.keys(current),
      updated_by: (context as any).userId,
    };

    const { error } = await db
      .from("integration_credentials")
      .upsert(payload, { onConflict: "provider" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reveal the plaintext for one provider so an administrator can check what is stored. */
export const revealIntegrationSecrets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ provider: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    await assertAdmin(context as any);
    const { decryptSecrets } = await import("@/lib/integrationCrypto.server");
    const { data: row, error } = await (await admin())
      .from("integration_credentials")
      .select("secrets_encrypted")
      .eq("provider", data.provider)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return decryptSecrets((row?.secrets_encrypted as string | null) ?? null);
  });

export const deleteIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ provider: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await (await admin())
      .from("integration_credentials")
      .delete()
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type TestResult = { ok: boolean; message: string };

async function probe(
  providerId: string,
  environment: string,
  config: Record<string, string>,
  secrets: Record<string, string>,
): Promise<TestResult> {
  const say = async (res: Response, okMessage: string) => {
    if (res.ok) return { ok: true, message: okMessage };
    const body = (await res.text()).slice(0, 300);
    return { ok: false, message: `Rejected [${res.status}]: ${body}` };
  };

  switch (providerId) {
    case "didit": {
      const base = (config["base_url"] || "https://verification.didit.me").replace(/\/+$/, "");
      const res = await fetch(`${base}/v2/workflows/`, {
        headers: { "x-api-key": secrets["api_key"] ?? "", Accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403)
        return { ok: false, message: `Didit rejected the key [${res.status}].` };
      return say(res, "Didit accepted the key.");
    }
    case "onfido": {
      const region = (config["region"] || "eu").toLowerCase();
      const host = region === "us" ? "api.us.onfido.com" : region === "ca" ? "api.ca.onfido.com" : "api.eu.onfido.com";
      const res = await fetch(`https://${host}/v3.6/applicants?per_page=1`, {
        headers: { Authorization: `Token token=${secrets["api_token"] ?? ""}` },
      });
      return say(res, "Onfido accepted the token.");
    }
    case "resend": {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${secrets["api_key"] ?? ""}` },
      });
      return say(res, "Resend accepted the key.");
    }
    case "twilio": {
      const sid = config["account_sid"] ?? "";
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: `Basic ${btoa(`${sid}:${secrets["auth_token"] ?? ""}`)}` },
      });
      return say(res, "Twilio accepted the account details.");
    }
    case "complyadvantage": {
      const res = await fetch("https://api.complyadvantage.com/users/me", {
        headers: { Authorization: `Token ${secrets["api_key"] ?? ""}` },
      });
      return say(res, "ComplyAdvantage accepted the key.");
    }
    case "exchangerate_host": {
      const res = await fetch(
        `https://api.exchangerate.host/live?access_key=${encodeURIComponent(secrets["access_key"] ?? "")}&source=ZAR&currencies=USD`,
      );
      const body = (await res.json().catch(() => null)) as { success?: boolean; error?: { info?: string } } | null;
      if (res.ok && body?.success) return { ok: true, message: "Live rates returned." };
      return { ok: false, message: body?.error?.info ?? `Rejected [${res.status}]` };
    }
    case "open_exchange_rates": {
      const res = await fetch(
        `https://openexchangerates.org/api/usage.json?app_id=${encodeURIComponent(secrets["app_id"] ?? "")}`,
      );
      return say(res, "Open Exchange Rates accepted the app ID.");
    }
    case "stitch": {
      const res = await fetch("https://secure.stitch.money/connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config["client_id"] ?? "",
          client_secret: secrets["client_secret"] ?? "",
          scope: "client_paymentrequest",
          audience: "https://secure.stitch.money/connect/token",
        }),
      });
      return say(res, "Stitch issued an access token.");
    }
    case "ozow": {
      const res = await fetch("https://api.ozow.com/GetTransactionByReference?siteCode=" + encodeURIComponent(config["site_code"] ?? "") + "&transactionReference=connection-test", {
        headers: { ApiKey: secrets["api_key"] ?? "", Accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403)
        return { ok: false, message: `Ozow rejected the key [${res.status}].` };
      return { ok: true, message: "Ozow accepted the key." };
    }
    case "peach_payments": {
      const base = environment === "production" ? "https://eu-prod.oppwa.com" : "https://eu-test.oppwa.com";
      const res = await fetch(
        `${base}/v1/query?entityId=${encodeURIComponent(config["entity_id"] ?? "")}`,
        { headers: { Authorization: `Bearer ${secrets["access_token"] ?? ""}` } },
      );
      if (res.status === 401 || res.status === 403)
        return { ok: false, message: `Peach rejected the token [${res.status}].` };
      return { ok: true, message: "Peach accepted the token." };
    }
    default:
      return { ok: false, message: "No automatic test is available for this provider." };
  }
}

export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ provider: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }): Promise<TestResult> => {
    await assertAdmin(context as any);
    const spec = providerById(data.provider);
    if (!spec) throw new Error("Unknown provider");

    const { decryptSecrets } = await import("@/lib/integrationCrypto.server");
    const db = await admin();
    const { data: row, error } = await db
      .from("integration_credentials")
      .select("*")
      .eq("provider", data.provider)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false, message: "Nothing saved for this service yet." };

    let result: TestResult;
    try {
      result = await probe(
        data.provider,
        row.environment as string,
        (row.config ?? {}) as Record<string, string>,
        await decryptSecrets(row.secrets_encrypted as string | null),
      );
    } catch (err) {
      result = { ok: false, message: (err as Error).message };
    }

    await db
      .from("integration_credentials")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_ok: result.ok,
        last_test_message: result.message,
      })
      .eq("provider", data.provider);

    return result;
  });
