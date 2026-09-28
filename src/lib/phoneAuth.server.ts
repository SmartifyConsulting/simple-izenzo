/** Server-only helpers for phone sign-up: Infobip SMS delivery and one-time code storage. */

export const SYNTHETIC_DOMAIN = "phone.izenzo.app";

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new Error("Enter a valid mobile number, including the country code.");
  return digits;
}

export function syntheticEmail(phone: string) {
  return `${phone}@${SYNTHETIC_DOMAIN}`;
}

export function isSyntheticEmail(email: string | null | undefined) {
  return Boolean(email && email.toLowerCase().endsWith(`@${SYNTHETIC_DOMAIN}`));
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashCode(phone: string, purpose: string, code: string) {
  return sha256(`${phone}:${purpose}:${code}:${process.env["INFOBIP_API_KEY"] ?? ""}`);
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function sendSms(to: string, text: string) {
  const key = process.env["INFOBIP_API_KEY"];
  let base = process.env["INFOBIP_BASE_URL"];
  if (!key || !base) throw new Error("SMS sending is not set up yet. Please contact support.");
  base = base.replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) base = `https://${base}`;
  const res = await fetch(`${base}/sms/2/text/advanced`, {
    method: "POST",
    headers: {
      Authorization: `App ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ messages: [{ destinations: [{ to }], from: "Izenzo", text }] }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Infobip SMS failed [${res.status}]: ${body}`);
    throw new Error("We couldn't send the SMS code right now. Please check the number and try again.");
  }
}

export async function issueOtp(phone: string, purpose: string, userId?: string | null) {
  const admin = await db();
  const { data: last } = await admin
    .from("phone_otps")
    .select("created_at")
    .eq("phone", phone)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.now() - new Date(last.created_at).getTime() < 60_000) {
    throw new Error("Please wait a minute before asking for another code.");
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const { error } = await admin.from("phone_otps").insert({
    phone,
    purpose,
    code_hash: await hashCode(phone, purpose, code),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    user_id: userId ?? null,
  });
  if (error) throw new Error(error.message);
  await sendSms(phone, `Your Izenzo code is ${code}. It expires in 10 minutes. Never share this code.`);
}

export async function consumeOtp(phone: string, purpose: string, code: string, userId?: string | null) {
  const admin = await db();
  const { data: row } = await admin
    .from("phone_otps")
    .select("*")
    .eq("phone", phone)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error("That code has expired. Ask for a new one.");
  }
  if (row.attempts >= 5) throw new Error("Too many wrong tries. Ask for a new code.");
  if (userId && row.user_id && row.user_id !== userId) throw new Error("That code doesn't match.");
  const ok = row.code_hash === (await hashCode(phone, purpose, code.trim()));
  if (!ok) {
    await admin.from("phone_otps").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    throw new Error("That code doesn't match. Check the SMS and try again.");
  }
  await admin.from("phone_otps").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
}
