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

/** Wraps a transactional email's own body HTML in the shared Izenzo letterhead/footer so every
 * notification the platform sends (counter offers, outreach, intent challenges, and any future
 * one) reads as coming from Izenzo rather than a bare unbranded message. Recreated in inline-CSS
 * HTML rather than a hosted logo image, since a remote image is blocked by default in most mail
 * clients and would otherwise show as a broken box until the recipient chooses to load it. */
export function renderBrandedEmail(bodyHtml: string): string {
  return `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f4f4f5;padding:24px 0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0d0f14;padding:20px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#14b8a6;width:28px;height:28px;border-radius:7px;text-align:center;vertical-align:middle;font-weight:700;color:#0d0f14;font-size:14px;line-height:28px;">I</td>
        <td style="padding-left:10px;vertical-align:middle;font-weight:700;font-size:17px;color:#ffffff;letter-spacing:0.01em;">Izenzo</td>
      </tr></table>
    </div>
    <div style="padding:28px;color:#1f2937;font-size:14px;line-height:1.6;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;">
      Izenzo — governance-first trade infrastructure. This is an automated message; do not reply directly to this address.
    </div>
  </div>
</div>`.trim();
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
