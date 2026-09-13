/** Didit verification helpers. Server-only: reads the encrypted Didit credentials out of
 * `integration_credentials` and talks to the Didit verification API.
 *
 * Nothing here decides a compliance outcome on its own — a Didit result that is not an explicit
 * approval always lands as "review", matching the identity-routing rule in identityRouting.ts. */

export type DiditCheckType = "id_document" | "kyb" | "aml";
export type DiditStatus = "pending" | "in_progress" | "passed" | "review" | "failed" | "expired";

export type DiditCreds = {
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
  environment: string;
  enabled: boolean;
  workflows: Record<DiditCheckType, string>;
};

const DEFAULT_BASE = "https://verification.didit.me";

export async function loadDiditCreds(): Promise<DiditCreds> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptSecrets } = await import("@/lib/integrationCrypto.server");

  const { data: row, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("*")
    .eq("provider", "didit")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Didit is not configured yet. Add the keys under Admin → Integrations.");

  const config = (row.config ?? {}) as Record<string, string>;
  const secrets = await decryptSecrets(row.secrets_encrypted as string | null);
  const apiKey = secrets["api_key"] ?? "";
  if (!apiKey) throw new Error("Didit API key is missing. Add it under Admin → Integrations.");

  return {
    apiKey,
    webhookSecret: secrets["webhook_secret"] ?? "",
    // Session paths already carry their own version (/v2/session/), so a saved base that
// includes an API version (or the wrong host) would produce /v1/v2/... and 404.
    baseUrl: normaliseBase(config["base_url"]),
    environment: (row.environment as string) || "sandbox",
    enabled: Boolean(row.enabled),
    workflows: {
      id_document: config["workflow_id_document"] ?? "",
      kyb: config["workflow_kyb"] ?? "",
      aml: config["workflow_aml"] ?? "",
    },
  };
}

async function diditFetch(creds: DiditCreds, path: string, init?: RequestInit) {
  const res = await fetch(`${creds.baseUrl}${path}`, {
    ...init,
    headers: {
      "x-api-key": creds.apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const detail = body?.detail ?? body?.message ?? text.slice(0, 300);
    throw new Error(`Didit rejected the request [${res.status}]: ${detail}`);
  }
  return body;
}

/** Create a verification session and return the hosted URL the person is sent to. */
export async function createDiditSession(
  creds: DiditCreds,
  args: { checkType: DiditCheckType; vendorData: string; callbackUrl?: string; contactEmail?: string },
): Promise<{ sessionId: string; url: string; raw: unknown }> {
  const workflowId = creds.workflows[args.checkType];
  if (!workflowId) {
    throw new Error(
      "No Didit workflow is set for this check. Add the workflow ID under Admin → Integrations.",
    );
  }
  const body = await diditFetch(creds, "/v2/session/", {
    method: "POST",
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: args.vendorData,
      ...(args.callbackUrl ? { callback: args.callbackUrl } : {}),
      ...(args.contactEmail ? { contact_details: { email: args.contactEmail } } : {}),
    }),
  });
  const sessionId = body?.session_id ?? body?.id;
  const url = body?.url ?? body?.session_url ?? body?.verification_url;
  if (!sessionId || !url) throw new Error("Didit did not return a session link.");
  return { sessionId: String(sessionId), url: String(url), raw: body };
}

export async function fetchDiditDecision(creds: DiditCreds, sessionId: string) {
  return diditFetch(creds, `/v2/session/${encodeURIComponent(sessionId)}/decision/`);
}

/** Map Didit's session status onto our own. Anything that is not an explicit approval is
 * treated as needing a human — never as a silent pass. */
export function mapDiditStatus(raw: string | null | undefined): DiditStatus {
  const s = (raw ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  switch (s) {
    case "approved":
      return "passed";
    case "declined":
    case "rejected":
      return "failed";
    case "not_started":
      return "pending";
    case "in_progress":
    case "pending":
      return "in_progress";
    case "expired":
    case "kyc_expired":
    case "abandoned":
      return "expired";
    default:
      return "review";
  }
}

/** Timing-safe hex comparison for the webhook signature. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
