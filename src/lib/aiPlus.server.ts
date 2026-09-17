/** Adapter to the client's protected AI+ decision service.
 *
 * Server-only. Off unless an administrator has enabled the "izenzo_ai_plus" integration and
 * saved a private service address plus signing key id and secret. When it is off, nothing here
 * runs and AI+ keeps producing advice through the hosted model service as before.
 *
 * The wire contract is the client's own: Appendix A for the request, Appendix B (DecisionPack
 * 1.0) for the response. Anything that does not validate against Appendix B is discarded — it is
 * never shown as advice and never written to `ai_proposals`.
 *
 * AI+ stays advisory here as everywhere: this module only produces candidate proposals. It never
 * writes Choice, Intent, POI, WaD, Execution or Finality, and a failure on this interface can
 * never unwind anything already sealed.
 */

export type AiPlusConfig = {
  enabled: boolean;
  privateUrl: string;
  hmacKeyId: string;
  hmacSecret: string;
  environment: string;
};

/** Appendix A — decision request. */
export type DecisionRequest = {
  schema_version: "1.0";
  environment: string;
  invocation_id: string;
  transaction: {
    transaction_id: string;
    org_id: string;
    counterparty_org_id: string | null;
    stage: string;
    step: string;
    event_type: string;
    event_at: string;
    attributes: Record<string, unknown>;
  };
};

/** Appendix B — DecisionPack 1.0. */
export type DecisionPackCandidate = {
  id: string;
  type:
    | "counterparty"
    | "pricing"
    | "risk_flag"
    | "structure"
    | "timing"
    | "substitution"
    | "bundle";
  label: string;
  probability: number;
  rationale: string;
  source_refs: string[];
};

export type DecisionPackResponse = {
  schema_version: "1.0";
  transaction_id: string;
  stage: "trading" | "compliance" | "execution" | "finality" | "memory";
  generated_at: string;
  model: string;
  candidates: DecisionPackCandidate[];
  recommendation: string | null;
};

const CANDIDATE_TYPES = [
  "counterparty",
  "pricing",
  "risk_flag",
  "structure",
  "timing",
  "substitution",
  "bundle",
] as const;

const PACK_STAGES = ["trading", "compliance", "execution", "finality", "memory"] as const;

const CANDIDATE_KEYS = ["id", "type", "label", "probability", "rationale", "source_refs"];
const PACK_KEYS = [
  "schema_version",
  "transaction_id",
  "stage",
  "generated_at",
  "model",
  "candidates",
  "recommendation",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** How long we wait for their service before treating the call as unavailable (Appendix C). */
export const AI_PLUS_TIMEOUT_MS = 8_000;

/** The path their service exposes (Appendix C). */
export const AI_PLUS_PATH = "/internal/v1/decision-packs";

/**
 * Reads the AI+ configuration out of the encrypted integration store. Returns `enabled: false`
 * whenever the integration is absent, switched off, or missing any of the three values — the
 * caller then keeps the existing behaviour instead of failing.
 */
export async function loadAiPlusConfig(): Promise<AiPlusConfig> {
  const off: AiPlusConfig = {
    enabled: false,
    privateUrl: "",
    hmacKeyId: "",
    hmacSecret: "",
    environment: "sandbox",
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecrets } = await import("@/lib/integrationCrypto.server");

    const { data: row } = await supabaseAdmin
      .from("integration_credentials")
      .select("*")
      .eq("provider", "izenzo_ai_plus")
      .maybeSingle();
    if (!row || !row.enabled) return off;

    const secrets = await decryptSecrets(row.secrets_encrypted as string | null);
    const privateUrl = (secrets["private_url"] ?? "").trim().replace(/\/+$/, "");
    const hmacKeyId = (secrets["hmac_key_id"] ?? "").trim();
    const hmacSecret = secrets["hmac_secret"] ?? "";
    if (!privateUrl || !hmacKeyId || !hmacSecret) return off;
    if (!/^https:\/\//i.test(privateUrl)) return off;

    return {
      enabled: true,
      privateUrl,
      hmacKeyId,
      hmacSecret,
      environment: (row.environment as string) || "sandbox",
    };
  } catch {
    // A missing key, an unreadable credential or an absent table must never take the deal
    // workflow down — AI+ simply stays on its existing path.
    return off;
  }
}

/** Canonical body: exactly the bytes that are signed and sent, with no reordering afterwards. */
export function canonicalBody(request: DecisionRequest): string {
  return JSON.stringify(request);
}

/**
 * Signs exactly what Appendix C signs: the stamped time, the one-off number and the body,
 * joined with dots, HMAC SHA-256, hex, prefixed `sha256=`.
 */
export async function signBody(
  secret: string,
  timestamp: string,
  nonce: string,
  body: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${nonce}.${body}`));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
}


export async function sha256Hex(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Builds the Appendix A request for one spine moment. */
export function buildDecisionRequest(args: {
  environment: string;
  invocationId: string;
  transactionId: string;
  orgId: string;
  counterpartyOrgId: string | null;
  stage: string;
  step: string;
  eventType: string;
  eventAt: string;
  attributes: Record<string, unknown>;
}): DecisionRequest {
  return {
    schema_version: "1.0",
    environment: args.environment,
    invocation_id: args.invocationId,
    transaction: {
      transaction_id: args.transactionId,
      org_id: args.orgId,
      counterparty_org_id: args.counterpartyOrgId,
      stage: args.stage,
      step: args.step,
      event_type: args.eventType,
      event_at: args.eventAt,
      attributes: args.attributes,
    },
  };
}

export type ValidationResult =
  | { ok: true; pack: DecisionPackResponse }
  | { ok: false; errors: string[] };

/**
 * Validates a reply against Appendix B. Strict: unknown properties are a failure
 * (`additionalProperties: false`), every listed property is required, and probability stays a
 * number in [0, 1] — it is never coerced into low/medium/high anywhere in this codebase.
 */
export function validateDecisionPack(input: unknown): ValidationResult {
  const errors: string[] = [];
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  if (!isObj(input)) return { ok: false, errors: ["response is not a JSON object"] };

  for (const key of Object.keys(input)) {
    if (!PACK_KEYS.includes(key)) errors.push(`unexpected property "${key}"`);
  }
  for (const key of PACK_KEYS) {
    if (!(key in input)) errors.push(`missing required property "${key}"`);
  }

  if (input["schema_version"] !== "1.0") errors.push('schema_version must be "1.0"');
  if (typeof input["transaction_id"] !== "string" || !UUID_RE.test(input["transaction_id"] as string))
    errors.push("transaction_id must be a uuid");
  if (!PACK_STAGES.includes(input["stage"] as (typeof PACK_STAGES)[number]))
    errors.push(`stage must be one of ${PACK_STAGES.join(", ")}`);
  const generatedAt = input["generated_at"];
  if (typeof generatedAt !== "string" || Number.isNaN(Date.parse(generatedAt)))
    errors.push("generated_at must be a date-time");
  if (typeof input["model"] !== "string" || (input["model"] as string).length < 1)
    errors.push("model must be a non-empty string");
  const recommendation = input["recommendation"];
  if (recommendation !== null && typeof recommendation !== "string")
    errors.push("recommendation must be a string or null");

  const candidates = input["candidates"];
  if (!Array.isArray(candidates)) {
    errors.push("candidates must be an array");
  } else if (candidates.length > 100) {
    errors.push("candidates may not exceed 100 items");
  } else {
    candidates.forEach((c, i) => {
      if (!isObj(c)) {
        errors.push(`candidates[${i}] is not an object`);
        return;
      }
      for (const key of Object.keys(c)) {
        if (!CANDIDATE_KEYS.includes(key)) errors.push(`candidates[${i}] unexpected property "${key}"`);
      }
      for (const key of CANDIDATE_KEYS) {
        if (!(key in c)) errors.push(`candidates[${i}] missing "${key}"`);
      }
      if (typeof c["id"] !== "string") errors.push(`candidates[${i}].id must be a string`);
      if (!CANDIDATE_TYPES.includes(c["type"] as (typeof CANDIDATE_TYPES)[number]))
        errors.push(`candidates[${i}].type is not a known type`);
      if (typeof c["label"] !== "string") errors.push(`candidates[${i}].label must be a string`);
      const p = c["probability"];
      if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1)
        errors.push(`candidates[${i}].probability must be a number between 0 and 1`);
      if (typeof c["rationale"] !== "string") errors.push(`candidates[${i}].rationale must be a string`);
      const refs = c["source_refs"];
      if (!Array.isArray(refs) || refs.some((r) => typeof r !== "string"))
        errors.push(`candidates[${i}].source_refs must be an array of strings`);
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, pack: input as unknown as DecisionPackResponse };
}

export type AiPlusCallResult =
  | { ok: true; pack: DecisionPackResponse; status: number }
  | { ok: false; status: number | null; error: string };

/**
 * Calls the protected AI+ service with a signed Appendix A request and validates the reply
 * against Appendix B. Never throws: a timeout, a transport failure, a non-2xx reply or an
 * invalid body all come back as `{ ok: false }` so the caller can fail safely.
 */
export async function callAiPlus(
  config: AiPlusConfig,
  request: DecisionRequest,
  idempotencyKey: string,
  correlationId: string,
): Promise<AiPlusCallResult> {
  const body = canonicalBody(request);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  let signature: string;
  try {
    signature = await signBody(config.hmacSecret, timestamp, nonce, body);
  } catch {
    return { ok: false, status: null, error: "Could not sign the AI+ request." };
  }

  const controller = new AbortController();
  // A bounded wait on their interface only. Nothing in the transaction path depends on this
  // call completing, so abandoning it is always safe.
  const timer = setTimeout(() => controller.abort(), AI_PLUS_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.privateUrl}${AI_PLUS_PATH}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Izenzo-Key-ID": config.hmacKeyId,
        "X-Izenzo-Timestamp": timestamp,
        "X-Izenzo-Nonce": nonce,
        "X-Izenzo-Signature": signature,
        "X-Izenzo-Invocation-Id": request.invocation_id,
        "X-Correlation-ID": correlationId,
        "Idempotency-Key": idempotencyKey,
      },
      body,
    });


    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `AI+ service returned ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, status: res.status, error: "AI+ service returned a body that is not JSON." };
    }

    const validated = validateDecisionPack(parsed);
    if (!validated.ok) {
      return {
        ok: false,
        status: res.status,
        error: `AI+ reply failed the DecisionPack contract: ${validated.errors.slice(0, 5).join("; ")}`,
      };
    }
    if (validated.pack.transaction_id !== request.transaction.transaction_id) {
      return {
        ok: false,
        status: res.status,
        error: "AI+ reply was for a different transaction.",
      };
    }
    return { ok: true, pack: validated.pack, status: res.status };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: null,
      error: aborted
        ? `AI+ service did not respond within ${Math.round(AI_PLUS_TIMEOUT_MS / 1000)}s.`
        : `AI+ service could not be reached: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Their candidate types map onto ours; only "risk_flag" differs in name. */
export function mapCandidateType(type: DecisionPackCandidate["type"]): string {
  return type === "risk_flag" ? "risk" : type;
}
