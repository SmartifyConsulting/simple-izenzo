/** Resend helpers. Server-only: reads the encrypted Resend credentials out of
 * `integration_credentials` (configured under Admin → Integrations) and sends transactional
 * email through the Resend API. */

export type ResendCreds = {
  apiKey: string;
  fromAddress: string;
  enabled: boolean;
  /** When true the key is a connection key for the Lovable gateway, not a Resend key. */
  viaGateway: boolean;
};

const DEFAULT_FROM = "no-reply@izenzo.co.za";

export async function loadResendCreds(): Promise<ResendCreds> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptSecrets } = await import("@/lib/integrationCrypto.server");

  const { data: row, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("*")
    .eq("provider", "resend")
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (row) {
    const config = (row.config ?? {}) as Record<string, string>;
    const secrets = await decryptSecrets(row.secrets_encrypted as string | null);
    const apiKey = secrets["api_key"] ?? "";
    if (apiKey) {
      return {
        apiKey,
        fromAddress: config["from_address"] || DEFAULT_FROM,
        enabled: Boolean(row.enabled),
        viaGateway: false,
      };
    }
  }

  // Fall back to the email connection linked to this project.
  const connectionKey = process.env["RESEND_API_KEY"];
  if (connectionKey && process.env["LOVABLE_API_KEY"]) {
    return {
      apiKey: connectionKey,
      fromAddress: process.env["RESEND_FROM_ADDRESS"] || DEFAULT_FROM,
      enabled: true,
      viaGateway: true,
    };
  }

  throw new Error("Email sending is not connected yet. Add Resend under Admin → Integrations.");
}

export async function sendEmail(
  creds: ResendCreds,
  opts: { to: string; subject: string; html: string },
): Promise<void> {
  const url = creds.viaGateway
    ? "https://connector-gateway.lovable.dev/resend/emails"
    : "https://api.resend.com/emails";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: creds.viaGateway
        ? `Bearer ${process.env["LOVABLE_API_KEY"]}`
        : `Bearer ${creds.apiKey}`,
      ...(creds.viaGateway ? { "X-Connection-Api-Key": creds.apiKey } : {}),
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
