/** PayFast helpers. Server-only: reads the encrypted PayFast merchant credentials out of
 * `integration_credentials` and prepares Onsite Payment requests plus ITN verification.
 *
 * Nothing here credits tokens — that only happens once PayFast's own ITN callback confirms a
 * completed payment (see src/routes/api/public/payfast/itn.ts). */

import { createHash } from "node:crypto";

export type PayFastCreds = {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  environment: string;
  enabled: boolean;
};

export function payfastHost(creds: PayFastCreds): string {
  return creds.environment === "production" ? "https://www.payfast.co.za" : "https://sandbox.payfast.co.za";
}

export async function loadPayFastCreds(): Promise<PayFastCreds | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptSecrets } = await import("@/lib/integrationCrypto.server");

  const { data: row, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("*")
    .eq("provider", "payfast")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const config = (row.config ?? {}) as Record<string, string>;
  const secrets = await decryptSecrets(row.secrets_encrypted as string | null);
  // Trimmed defensively — a merchant ID/key pasted with a stray leading/trailing space or newline
  // signs correctly (the signature step also trims) but PayFast itself rejects the untrimmed
  // value as unrecognized, which otherwise surfaces as a bare, hard-to-diagnose 400.
  const merchantId = (config["merchant_id"] ?? "").trim();
  const merchantKey = (secrets["merchant_key"] ?? "").trim();
  if (!merchantId || !merchantKey) return null;

  return {
    merchantId,
    merchantKey,
    passphrase: (secrets["passphrase"] ?? "").trim(),
    environment: (row.environment as string) || "sandbox",
    enabled: Boolean(row.enabled),
  };
}

/** PayFast signs a request as an MD5 of the URL-encoded field string, in the order the fields are
 * submitted, with the passphrase appended when one is set. Spaces encode as "+". */
export function payfastSignature(fields: Record<string, string>, passphrase: string): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === "" || value === undefined || value === null) continue;
    parts.push(`${key}=${encodeURIComponent(value.trim()).replace(/%20/g, "+")}`);
  }
  if (passphrase) parts.push(`passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}`);
  return createHash("md5").update(parts.join("&")).digest("hex");
}

/** Pulls the human-readable reason out of PayFast's HTML error page, which is otherwise 13KB of
 * markup. Falls back to a trimmed snippet when the page shape changes. */
function payfastReason(text: string): string {
  const block = /error-block__message"?>([\s\S]{0,400}?)<\/div>/i.exec(text);
  if (block?.[1]) {
    const cleaned = block[1]
      .replace(/<[^>]*>/g, " ")
      .replace(/^\s*\d+\.\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned) return cleaned;
  }
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || "no details returned";
}

/** Asks PayFast for an Onsite Payment identifier, which the browser then hands to
 * `window.payfast_do_onsite_payment` to open the payment window in place. */
export async function createOnsitePayment(
  creds: PayFastCreds,
  input: {
    amountZar: number;
    itemName: string;
    mPaymentId: string;
    returnUrl: string;
    cancelUrl: string;
    notifyUrl: string;
    /** PayFast rejects an Onsite Payment without a buyer email address ("The email address field
     * is required."), so this is mandatory rather than optional. */
    emailAddress: string;
  },
): Promise<string> {
  // The field order is PayFast's own documented order, not ours: PayFast rebuilds the signature
  // in that order, so email_address must come before m_payment_id/amount/item_name. Any other
  // order fails with "Generated signature does not match submitted signature."
  const fields: Record<string, string> = {
    merchant_id: creds.merchantId,
    merchant_key: creds.merchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    email_address: input.emailAddress,
    m_payment_id: input.mPaymentId,
    amount: input.amountZar.toFixed(2),
    item_name: input.itemName,
  };

  fields["signature"] = payfastSignature(fields, creds.passphrase);

  const body = new URLSearchParams(fields);
  const res = await fetch(`${payfastHost(creds)}/onsite/process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayFast declined this payment: ${payfastReason(text)}`);
  }

  let uuid: string | undefined;
  try {
    uuid = (JSON.parse(text) as { uuid?: string }).uuid;
  } catch {
    throw new Error("PayFast returned an unexpected response.");
  }
  if (!uuid) throw new Error("PayFast did not return a payment reference.");
  return uuid;
}

/** Verifies an ITN payload's signature using the posted field order, excluding the signature
 * itself. */
export function itnSignatureValid(raw: Record<string, string>, passphrase: string): boolean {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "signature") continue;
    fields[k] = v;
  }
  const expected = payfastSignature(fields, passphrase);
  return expected === (raw["signature"] ?? "");
}
