/** AES-GCM encryption for stored third-party credentials.
 * The key never leaves the server; it lives in the INTEGRATION_ENCRYPTION_KEY secret. */

function keyMaterial(): Uint8Array {
  const raw = process.env["INTEGRATION_ENCRYPTION_KEY"];
  if (!raw) throw new Error("Credential encryption key is not configured.");
  const bytes = new TextEncoder().encode(raw);
  // Fold to exactly 32 bytes so any secret length works.
  const out = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) out[i % 32] = (out[i % 32]! ^ bytes[i]!) & 0xff;
  return out;
}

async function aesKey() {
  return crypto.subtle.importKey("raw", keyMaterial(), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(value: string) {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecrets(secrets: Record<string, string>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(secrets));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), data),
  );
  return `v1.${toBase64(iv)}.${toBase64(cipher)}`;
}

export async function decryptSecrets(payload: string | null): Promise<Record<string, string>> {
  if (!payload) return {};
  const [version, ivPart, cipherPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !cipherPart) return {};
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivPart) },
      await aesKey(),
      fromBase64(cipherPart),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as Record<string, string>;
  } catch {
    throw new Error("Stored credentials could not be decrypted with the current key.");
  }
}

export function maskValue(value: string) {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••••••${value.slice(-4)}`;
}
