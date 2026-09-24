import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INTEGRATION_PROVIDERS, providerById } from "@/lib/integrations.catalog";
import {
  classifyFailure,
  classifyThrown,
  notConfigured,
  type FailureReason,
} from "@/lib/integrationFailures";

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

/** Reveal the plaintext for one provider so an administrator can check what is stored. Gated
 * behind a second, vault-specific password (`INTEGRATIONS_VAULT_PASSWORD`) — separate from the
 * admin's own account password — so the data stays encrypted to every user, admins included,
 * until that password is entered. Fails closed: if the vault password isn't configured, nothing
 * can ever be revealed rather than silently skipping the check. */
export const revealIntegrationSecrets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ provider: z.string().min(1), vaultPassword: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    await assertAdmin(context as any);
    const expected = process.env["INTEGRATIONS_VAULT_PASSWORD"];
    if (!expected) {
      throw new Error(
        "No vault password is configured (INTEGRATIONS_VAULT_PASSWORD) — nothing can be revealed until an administrator sets one.",
      );
    }
    if (data.vaultPassword !== expected) {
      throw new Error("Incorrect vault password.");
    }
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

type TestResult = {
  ok: boolean;
  message: string;
  /** Why it failed, so the screen can offer the right next step (e.g. a top-up link). */
  reason?: FailureReason;
  /** The provider's own wording, shown as extra detail under the message. */
  detail?: string | undefined;
  /** The provider's billing page, filled in when the failure is a missing balance. */
  topUpUrl?: string | undefined;
};

async function probe(
  providerId: string,
  providerName: string,
  environment: string,
  config: Record<string, string>,
  secrets: Record<string, string>,
): Promise<TestResult> {
  const say = async (res: Response, okMessage: string): Promise<TestResult> => {
    if (res.ok) return { ok: true, message: okMessage };
    return classifyFailure(providerName, res.status, await res.text());
  };

  switch (providerId) {
    case "didit": {
      const base = (config["base_url"] || "https://verification.didit.me").replace(/\/+$/, "");
      const checks: Array<[string, string]> = [
        ["ID document", config["workflow_id_document"] ?? ""],
        ["Company (KYB)", config["workflow_kyb"] ?? ""],
        ["Sanctions / PEP", config["workflow_aml"] ?? ""],
      ];
      const notes: string[] = [];
      let allOk = true;
      for (const [label, workflow] of checks) {
        if (!workflow) {
          allOk = false;
          notes.push(`${label}: no workflow saved.`);
          continue;
        }
        // Creating a session is the only reliable probe: it checks both the key and the workflow.
        const res = await fetch(`${base}/v2/session/`, {
          method: "POST",
          headers: { "x-api-key": secrets["api_key"] ?? "", "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow_id: workflow,
            vendor_data: `connection-test-${Date.now()}`,
          }),
        });
        if (res.status === 401 || res.status === 403)
          return classifyFailure(providerName, res.status, await res.text());
        if (res.ok) {
          notes.push(`${label}: OK.`);
          continue;
        }
        allOk = false;
        const body = (await res.text()).slice(0, 200);
        if (res.status === 402 || res.status === 429) return classifyFailure(providerName, res.status, body);
        if (/uuid/i.test(body)) notes.push(`${label}: that workflow ID is not a valid Didit workflow ID.`);
        else if (/portrait_image|stored face/i.test(body))
          notes.push(`${label}: that workflow is a face-match workflow needing an existing photo — use the ID document + liveness workflow instead.`);
        else notes.push(`${label}: ${classifyFailure(providerName, res.status, body).message}`);
      }
      return allOk
        ? { ok: true, message: `Key accepted. ${notes.join(" ")}` }
        : { ok: false, reason: "rejected", message: `Key accepted, but some checks are not ready. ${notes.join(" ")}` };
    }

    case "firecrawl": {
      const token = secrets["api_key"] ?? "";
      if (!token) return notConfigured(providerName);
      const gateway = token.startsWith("lovc_");
      const lovableKey = process.env["LOVABLE_API_KEY"] ?? "";
      if (gateway && !lovableKey) {
        return {
          ok: false,
          reason: "not_configured",
          message:
            "That is a Lovable connection key, but the workspace key is missing — save Firecrawl's own API key instead.",
        };
      }
      const res = await fetch(
        gateway
          ? "https://connector-gateway.lovable.dev/firecrawl/v2/scrape"
          : "https://api.firecrawl.dev/v2/scrape",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${gateway ? lovableKey : token}`,
            ...(gateway ? { "X-Connection-Api-Key": token } : {}),
          },
          body: JSON.stringify({ url: "https://example.com", formats: ["markdown"], onlyMainContent: true }),
        },
      );
      const body = (await res.text()).slice(0, 200);
      if (!res.ok) return classifyFailure(providerName, res.status, body);
      return { ok: true, message: "Key accepted — a live test page was read successfully." };
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
      return classifyFailure(providerName, res.status, body?.error?.info ?? "");
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
        return classifyFailure(providerName, res.status, await res.text());
      return { ok: true, message: "Ozow accepted the key." };
    }
    case "tavily": {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${secrets["api_key"] ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: "connection test", max_results: 1, search_depth: "basic" }),
      });
      return say(res, "Tavily accepted the key — a live search worked.");
    }
    case "openai": {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${secrets["api_key"] ?? ""}` },
      });
      return say(res, "OpenAI accepted the key.");
    }
    case "serpapi": {
      const res = await fetch(
        `https://serpapi.com/account?api_key=${encodeURIComponent(secrets["api_key"] ?? "")}`,
      );
      return say(res, "SerpAPI accepted the key.");
    }
    case "peach_payments": {
      const base = environment === "production" ? "https://eu-prod.oppwa.com" : "https://eu-test.oppwa.com";
      const res = await fetch(
        `${base}/v1/query?entityId=${encodeURIComponent(config["entity_id"] ?? "")}`,
        { headers: { Authorization: `Bearer ${secrets["access_token"] ?? ""}` } },
      );
      if (res.status === 401 || res.status === 403)
        return classifyFailure(providerName, res.status, await res.text());
      return { ok: true, message: "Peach accepted the token." };
    }
    default:
      return {
        ok: false,
        reason: "not_configured",
        message: "No automatic test is available for this service — it is confirmed on first live use.",
      };
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
    if (!row) return notConfigured(spec.name);

    let result: TestResult;
    try {
      result = await probe(
        data.provider,
        spec.name,
        row.environment as string,
        (row.config ?? {}) as Record<string, string>,
        await decryptSecrets(row.secrets_encrypted as string | null),
      );
    } catch (err) {
      result = classifyThrown(spec.name, err);
    }

    // A missing balance is actionable: hand the screen the provider's own billing page.
    if (!result.ok && result.reason === "no_credits" && spec.topUpUrl) {
      result = { ...result, topUpUrl: spec.topUpUrl };
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

export type ProviderPricingEntry = { text: string; fetchedAt: string; sourceUrl?: string | undefined };
export type ProviderPricingCache = Record<string, ProviderPricingEntry>;

const PRICING_SETTINGS_KEY = "provider_pricing_cache";
/** Refreshed at most once a month — pricing pages don't move often enough to justify checking on
 * every page load, and this is one shared cache for every org, not a per-org lookup. */
const PRICING_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** The standard model only — the heavier gpt-5 tier (Izenzo AI+'s model) is reserved for AI+
 * Recommendations and never used for background admin lookups like this one. */
const PRICING_MODELS = ["gpt-5-mini", "gpt-5"];

function pricingIsStale(entry: ProviderPricingEntry | undefined): boolean {
  if (!entry) return true;
  const at = new Date(entry.fetchedAt).getTime();
  return !Number.isFinite(at) || Date.now() - at > PRICING_MAX_AGE_MS;
}

/** Every admin who opens Integrations reads the same cached row — pricing text is fetched from the
 * web at most once a month, shared globally, never per-org. If OpenAI isn't configured yet, or a
 * provider's lookup fails, whatever is cached (possibly nothing) is returned as-is and the screen
 * falls back to each provider's static `costNote`. */
export const getProviderPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProviderPricingCache> => {
    await assertAdmin(context as any);
    const db = await admin();

    const { data: row } = await db
      .from("admin_settings")
      .select("value")
      .eq("key", PRICING_SETTINGS_KEY)
      .maybeSingle();
    const cache: ProviderPricingCache = { ...((row?.value as ProviderPricingCache | null) ?? {}) };

    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (!apiKey) return cache;

    const stale = INTEGRATION_PROVIDERS.filter(
      (p) => p.id !== "izenzo_ai_plus" && pricingIsStale(cache[p.id]),
    );
    if (stale.length === 0) return cache;

    const { webSearch } = await import("@/lib/openaiWebSearch.server");
    const results = await Promise.allSettled(
      stale.map(async (provider) => {
        const result = await webSearch({
          apiKey,
          instructions:
            "You find current, publicly published pricing for a named software/API provider. Reply with one or two short plain-text sentences suitable for an admin dashboard: how the provider currently charges (rate, unit, and free tier if any). No markdown, no headings, no bullet points. If current pricing can't be found, say so briefly.",
          input: `Provider: ${provider.name}. Used here for: ${provider.summary}${
            provider.docsUrl ? ` Docs: ${provider.docsUrl}` : ""
          } What does ${provider.name} currently charge, as of today?`,
          models: PRICING_MODELS,
          effort: "low",
        });
        return { id: provider.id, result };
      }),
    );

    let changed = false;
    for (const settled of results) {
      if (settled.status !== "fulfilled") continue;
      const { id, result } = settled.value;
      if (!result.text) continue;
      cache[id] = { text: result.text, fetchedAt: new Date().toISOString(), sourceUrl: result.sources[0]?.url };
      changed = true;
    }

    if (changed) {
      await db
        .from("admin_settings")
        .upsert(
          { key: PRICING_SETTINGS_KEY, value: cache as any, updated_by: (context as any).userId },
          { onConflict: "key" },
        );
    }
    return cache;
  });

export type CreditSpendByReason = { reason: string; tokens: number; count: number };
export type CreditSpendByOrg = { orgId: string; orgName: string; tokens: number; count: number };
export type CreditSpendEvent = { reason: string; tokens: number; createdAt: string };
export type CreditSpendByTransaction = {
  transactionId: string;
  reference: string | null;
  title: string | null;
  tokens: number;
  count: number;
  events: CreditSpendEvent[];
};
export type CreditSpendReport = {
  totalTokensSpent: number;
  totalEvents: number;
  byReason: CreditSpendByReason[];
  byOrg: CreditSpendByOrg[];
  byTransaction: CreditSpendByTransaction[];
};

/** What the org's own credits are actually being spent on — every debit against credit_ledger
 * (Proof of Intent, WaD verification, and anything else that ever gates on tokens), grouped by
 * reason, by organisation, and by the specific transaction each debit was charged against (with
 * each individual event's own timestamp, so spend within a transaction can be read minute by
 * minute). This is the platform's own token economy, not a read on what the admin's external
 * OpenAI/Tavily/Didit/Resend accounts are costing — those providers are billed directly on the
 * admin's own account and aren't metered anywhere in this app. */
export const getCreditSpendReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditSpendReport> => {
    await assertAdmin(context as any);
    const db = await admin();

    const { data: rows, error } = await db
      .from("credit_ledger")
      .select("delta, reason, org_id, transaction_id, created_at")
      .lt("delta", 0)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const debits = (rows ?? []) as {
      delta: number;
      reason: string;
      org_id: string;
      transaction_id: string | null;
      created_at: string;
    }[];

    const orgIds = [...new Set(debits.map((d) => d.org_id))];
    const { data: orgs } = orgIds.length
      ? await db.from("organisations").select("id, name").in("id", orgIds)
      : { data: [] as { id: string; name: string }[] };
    const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));

    const txIds = [...new Set(debits.map((d) => d.transaction_id).filter((id): id is string => Boolean(id)))];
    const { data: txs } = txIds.length
      ? await db.from("transactions").select("id, reference, title").in("id", txIds)
      : { data: [] as { id: string; reference: string | null; title: string | null }[] };
    const txInfo = new Map((txs ?? []).map((t) => [t.id, t]));

    const byReasonMap = new Map<string, CreditSpendByReason>();
    const byOrgMap = new Map<string, CreditSpendByOrg>();
    const byTxMap = new Map<string, CreditSpendByTransaction>();
    let totalTokensSpent = 0;

    for (const d of debits) {
      const tokens = Math.abs(d.delta);
      totalTokensSpent += tokens;

      const r = byReasonMap.get(d.reason) ?? { reason: d.reason, tokens: 0, count: 0 };
      r.tokens += tokens;
      r.count += 1;
      byReasonMap.set(d.reason, r);

      const o = byOrgMap.get(d.org_id) ?? {
        orgId: d.org_id,
        orgName: orgName.get(d.org_id) ?? "Unknown organisation",
        tokens: 0,
        count: 0,
      };
      o.tokens += tokens;
      o.count += 1;
      byOrgMap.set(d.org_id, o);

      if (d.transaction_id) {
        const info = txInfo.get(d.transaction_id);
        const t = byTxMap.get(d.transaction_id) ?? {
          transactionId: d.transaction_id,
          reference: info?.reference ?? null,
          title: info?.title ?? null,
          tokens: 0,
          count: 0,
          events: [],
        };
        t.tokens += tokens;
        t.count += 1;
        t.events.push({ reason: d.reason, tokens, createdAt: d.created_at });
        byTxMap.set(d.transaction_id, t);
      }
    }

    return {
      totalTokensSpent,
      totalEvents: debits.length,
      byReason: [...byReasonMap.values()].sort((a, b) => b.tokens - a.tokens),
      byOrg: [...byOrgMap.values()].sort((a, b) => b.tokens - a.tokens),
      byTransaction: [...byTxMap.values()].sort((a, b) => b.tokens - a.tokens),
    };
  });
