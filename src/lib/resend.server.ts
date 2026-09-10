/** Resend helpers. Server-only: reads the encrypted Resend credentials out of
 * `integration_credentials` (configured under Admin → Integrations) and sends transactional
 * email through the Resend API. */

export type ResendCreds = {
  apiKey: string;
  fromAddress: string;
  enabled: boolean;
};

export async function loadResendCreds(): Promise<ResendCreds> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptSecrets } = await import("@/lib/integrationCrypto.server");

  const { data: row, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("*")
    .eq("provider", "resend")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Resend is not configured yet. Add the API key under Admin → Integrations.");

  const config = (row.config ?? {}) as Record<string, string>;
  const secrets = await decryptSecrets(row.secrets_encrypted as string | null);
  const apiKey = secrets["api_key"] ?? "";
  if (!apiKey) throw new Error("Resend API key is missing. Add it under Admin → Integrations.");
  const fromAddress = config["from_address"] || "no-reply@izenzo.co.za";

  return { apiKey, fromAddress, enabled: Boolean(row.enabled) };
}

export async function sendEmail(
  creds: ResendCreds,
  opts: { to: string; subject: string; html: string },
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: creds.fromAddress,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend could not send the email (${res.status}): ${body || res.statusText}`);
  }
}
