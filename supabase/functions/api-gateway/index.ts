// Public API Gateway (rebuild requirements sections 2, 3, 11 — Phase 6). Governed, read-only
// institutional signal API. Deployed as a Supabase Edge Function since this app's TanStack Start
// version has no file-based server-route primitive for a stable external HTTP path — this is the
// genuine external endpoint, not an internal RPC.
//
// URL shape: https://<project>.functions.supabase.co/api-gateway/<environment>/v1/<path>
// e.g. .../api-gateway/sandbox/v1/status
//      .../api-gateway/sandbox/v1/counterparty/lookup   (POST { name })
//      .../api-gateway/production/v1/counterparty/summary/<id>
//      .../api-gateway/sandbox/v1/usage
//      .../api-gateway/sandbox/v1/webhook/test          (POST, sandbox only)
//
// Deliberately OUT OF SCOPE for this pass (see migration header for the full list): real separate
// base-URL domains (DNS/custom-domain config is outside this session's reach — environment is
// carried in the URL path instead, with hard rejection if a key's own environment doesn't match),
// IP allowlist enforcement, the full go-live checklist beyond commercial/compliance owner sign-off.

import { createClient } from "jsr:@supabase/supabase-js@2.115.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SANDBOX_NOTICE =
  "Sandbox records are fictional test records. Sandbox responses, statuses, errors, webhooks and usage reports must not be used for live business decisions, compliance decisions, payment decisions or counterparty approvals.";
const PRODUCTION_NOTICE =
  "Production API responses provide Izenzo status and risk signals based on available records and approved response fields. They are not legal advice, not a payment guarantee, not a compliance clearance, not a bank-account verification guarantee and not a substitute for the client's own approval process unless separately agreed in writing. No API response automatically creates a POI, issues a WaD, clears a compliance block or approves a transaction.";

type Env = "sandbox" | "production";

const SANDBOX_FIXTURES: Record<string, { status: string; extra?: Record<string, unknown> }> = {
  "test verified energy (pty) ltd": { status: "verified_match" },
  "test unverified trading ltd": { status: "unverified_match" },
  "test no match holdings": { status: "no_match" },
  "test duplicate supplies ltd": { status: "multiple_possible_matches" },
  "test blocked entity ltd": { status: "blocked_record" },
  "test stale agrivoltaics ltd": { status: "stale_record" },
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function noticeFor(env: Env) {
  return env === "sandbox" ? SANDBOX_NOTICE : PRODUCTION_NOTICE;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  env: Env,
  requestId: string,
): Response {
  return new Response(JSON.stringify({ ...body, notice: noticeFor(env) }), {
    status,
    headers: {
      "content-type": "application/json",
      "X-Izenzo-Environment": env,
      "X-Izenzo-Request-Id": requestId,
    },
  });
}

type ApiKeyRow = {
  id: string;
  environment: Env;
  org_id: string;
  status: "active" | "suspended" | "revoked";
  scopes: string[];
  expires_at: string;
  monthly_allowance: number;
};

async function logRequest(fields: {
  environment: Env;
  apiKeyId: string | null;
  orgId: string | null;
  endpoint: string;
  method: string;
  requestId: string;
  responseStatus: number;
  errorCode: string | null;
  latencyMs: number;
  billable: boolean;
  tokenCost: number;
  sourceIp: string | null;
  userAgent: string | null;
  scopesEvaluated: string[];
  rateLimitDecision: string;
  requestPayloadHash: string | null;
}) {
  let previousHash: string | null = null;
  if (fields.apiKeyId) {
    const { data: last } = await sb
      .from("api_request_logs")
      .select("log_hash")
      .eq("api_key_id", fields.apiKeyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    previousHash = last?.log_hash ?? null;
  }
  const logHash = await sha256Hex(
    JSON.stringify({ ...fields, previousHash, ts: new Date().toISOString() }),
  );
  await sb.from("api_request_logs").insert({
    environment: fields.environment,
    api_key_id: fields.apiKeyId,
    org_id: fields.orgId,
    endpoint: fields.endpoint,
    method: fields.method,
    request_id: fields.requestId,
    response_status: fields.responseStatus,
    error_code: fields.errorCode,
    latency_ms: fields.latencyMs,
    billable: fields.billable,
    token_cost: fields.tokenCost,
    source_ip: fields.sourceIp,
    user_agent: fields.userAgent,
    scopes_evaluated: fields.scopesEvaluated,
    rate_limit_decision: fields.rateLimitDecision,
    request_payload_hash: fields.requestPayloadHash,
    previous_log_hash: previousHash,
    log_hash: logHash,
  });
}

async function authenticate(
  req: Request,
  env: Env,
): Promise<{ key: ApiKeyRow } | { error: string; status: number; errorCode: string }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { error: "Missing bearer token", status: 401, errorCode: "missing_credentials" };

  const hash = await sha256Hex(token);
  const { data: key } = await sb
    .from("api_keys")
    .select("id, environment, org_id, status, scopes, expires_at, monthly_allowance")
    .eq("key_hash", hash)
    .maybeSingle<ApiKeyRow>();

  if (!key) return { error: "Invalid API key", status: 401, errorCode: "invalid_key" };
  if (key.environment !== env) {
    return {
      error: `This key belongs to the ${key.environment} environment, not ${env}`,
      status: 401,
      errorCode: "environment_mismatch",
    };
  }
  if (key.status !== "active") {
    return { error: `Key is ${key.status}`, status: 401, errorCode: `key_${key.status}` };
  }
  if (new Date(key.expires_at).getTime() <= Date.now()) {
    return { error: "Key has expired", status: 401, errorCode: "key_expired" };
  }

  sb.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(() => {});

  return { key };
}

function requireScope(key: ApiKeyRow, scope: string) {
  return key.scopes.includes(scope);
}

const RATE_LIMIT_PER_MIN: Record<Env, number> = { sandbox: 30, production: 60 };

async function checkRateLimit(key: ApiKeyRow): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await sb
    .from("api_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", key.id)
    .gte("created_at", since);
  return (count ?? 0) < RATE_LIMIT_PER_MIN[key.environment];
}

async function checkMonthlyAllowance(key: ApiKeyRow): Promise<{ ok: boolean; used: number }> {
  if (key.environment === "sandbox") return { ok: true, used: 0 };
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("api_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", key.id)
    .eq("billable", true)
    .gte("created_at", monthStart.toISOString());
  const used = count ?? 0;
  return { ok: used < key.monthly_allowance, used };
}

async function handleStatus(env: Env, key: ApiKeyRow, requestId: string) {
  return jsonResponse({ status: "ok", environment: env, test_record: env === "sandbox" || undefined }, 200, env, requestId);
}

async function handleCounterpartyLookup(env: Env, key: ApiKeyRow, req: Request, requestId: string) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) {
    return { response: jsonResponse({ error: "name is required" }, 422, env, requestId), errorCode: "missing_field", billable: false };
  }

  if (env === "sandbox") {
    const fixture = SANDBOX_FIXTURES[name.toLowerCase()];
    const status = fixture?.status ?? (name.toUpperCase().includes("TEST") ? "no_match" : null);
    if (!status) {
      return {
        response: jsonResponse(
          { error: "Sandbox lookups must use one of the fixed TEST/SANDBOX fixture names" },
          422,
          env,
          requestId,
        ),
        errorCode: "invalid_sandbox_fixture",
        billable: false,
      };
    }
    return {
      response: jsonResponse(
        { name, status, environment: env, test_record: true, sandbox_case_id: name.toLowerCase().replace(/\s+/g, "_") },
        200,
        env,
        requestId,
      ),
      errorCode: null,
      billable: false,
    };
  }

  const { data: company } = await sb
    .from("registry_companies")
    .select("id, legal_name, readiness_state, claimed_org_id")
    .ilike("legal_name", name)
    .limit(1)
    .maybeSingle();

  let status: string;
  if (!company) status = "no_match";
  else if (company.claimed_org_id) status = "verified_match";
  else if (["public_search_ready", "demo_ready"].includes(company.readiness_state)) status = "unverified_match";
  else status = "review_required";

  return {
    response: jsonResponse(
      { name, status, environment: env, counterparty_id: company?.id ?? null },
      200,
      env,
      requestId,
    ),
    errorCode: null,
    billable: true,
  };
}

async function handleUsage(env: Env, key: ApiKeyRow, requestId: string) {
  const allowance = await checkMonthlyAllowance(key);
  return jsonResponse(
    {
      environment: env,
      monthly_allowance: key.monthly_allowance,
      used: allowance.used,
      remaining: Math.max(0, key.monthly_allowance - allowance.used),
      percent_used: env === "production" ? Math.round((allowance.used / key.monthly_allowance) * 100) : 0,
    },
    200,
    env,
    requestId,
  );
}

async function handleWebhookTest(env: Env, key: ApiKeyRow, requestId: string) {
  if (env !== "sandbox") {
    return jsonResponse({ error: "webhook.test is sandbox-only" }, 403, env, requestId);
  }
  const { data: endpoint } = await sb
    .from("api_webhook_endpoints")
    .select("id, url, secret")
    .eq("api_key_id", key.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const payload = {
    event: "webhook.test",
    environment: env,
    request_id: requestId,
    sent_at: new Date().toISOString(),
  };
  const payloadStr = JSON.stringify(payload);

  if (!endpoint) {
    // No endpoint registered — return the signed payload directly so the client can verify their
    // own HMAC implementation before registering a real receiving URL.
    const secret = "no-endpoint-registered-preview-secret";
    const signature = await hmacSha256Hex(secret, payloadStr);
    return jsonResponse(
      { note: "No webhook endpoint registered for this key — returning a preview payload/signature instead of delivering it.", payload, signature },
      200,
      env,
      requestId,
    );
  }

  const signature = await hmacSha256Hex(endpoint.secret, payloadStr);
  let responseStatus: number | null = null;
  let status = "delivered";
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Izenzo-Signature": signature,
        "X-Izenzo-Timestamp": String(Date.now()),
      },
      body: payloadStr,
    });
    responseStatus = res.status;
    if (!res.ok) status = "failed";
  } catch {
    status = "failed";
  }

  await sb.from("api_webhook_deliveries").insert({
    endpoint_id: endpoint.id,
    event_type: "webhook.test",
    payload,
    signature,
    status,
    response_status: responseStatus,
  });

  return jsonResponse({ delivered: status === "delivered", response_status: responseStatus }, 200, env, requestId);
}

Deno.serve(async (req: Request) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const url = new URL(req.url);
  // Path: /api-gateway/<environment>/v1/<rest...>
  const parts = url.pathname.split("/").filter(Boolean);
  const gatewayIdx = parts.indexOf("api-gateway");
  const envSegment = parts[gatewayIdx + 1];
  const versionSegment = parts[gatewayIdx + 2];
  const rest = parts.slice(gatewayIdx + 3).join("/");

  if (envSegment !== "sandbox" && envSegment !== "production") {
    return new Response(JSON.stringify({ error: "URL must start with /sandbox/v1/... or /production/v1/..." }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  const env = envSegment as Env;
  if (versionSegment !== "v1") {
    return jsonResponse({ error: "Unsupported API version" }, 404, env, requestId);
  }

  const auth = await authenticate(req, env);
  if ("error" in auth) {
    await logRequest({
      environment: env,
      apiKeyId: null,
      orgId: null,
      endpoint: rest,
      method: req.method,
      requestId,
      responseStatus: auth.status,
      errorCode: auth.errorCode,
      latencyMs: Date.now() - startedAt,
      billable: false,
      tokenCost: 0,
      sourceIp: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
      scopesEvaluated: [],
      rateLimitDecision: "n/a",
      requestPayloadHash: null,
    });
    return jsonResponse({ error: auth.error }, auth.status, env, requestId);
  }
  const { key } = auth;

  const withinLimit = await checkRateLimit(key);
  if (!withinLimit) {
    await logRequest({
      environment: env,
      apiKeyId: key.id,
      orgId: key.org_id,
      endpoint: rest,
      method: req.method,
      requestId,
      responseStatus: 429,
      errorCode: "rate_limited",
      latencyMs: Date.now() - startedAt,
      billable: false,
      tokenCost: 0,
      sourceIp: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
      scopesEvaluated: [],
      rateLimitDecision: "blocked",
      requestPayloadHash: null,
    });
    return jsonResponse({ error: "Rate limit exceeded" }, 429, env, requestId);
  }

  let scope: string | null = null;
  let result: { response: Response; errorCode: string | null; billable: boolean };

  if (rest === "status" && req.method === "GET") {
    scope = "api:status_read";
    result = { response: await handleStatus(env, key, requestId), errorCode: null, billable: false };
  } else if (rest === "counterparty/lookup" && req.method === "POST") {
    scope = "counterparty:lookup";
    result = await handleCounterpartyLookup(env, key, req, requestId);
  } else if (rest === "usage" && req.method === "GET") {
    scope = "usage:read";
    result = { response: await handleUsage(env, key, requestId), errorCode: null, billable: false };
  } else if (rest === "webhook/test" && req.method === "POST") {
    scope = "webhook:test";
    result = { response: await handleWebhookTest(env, key, requestId), errorCode: null, billable: false };
  } else {
    result = { response: jsonResponse({ error: "Not found" }, 404, env, requestId), errorCode: "not_found", billable: false };
  }

  if (scope && !requireScope(key, scope)) {
    result = {
      response: jsonResponse({ error: `Key is missing required scope: ${scope}` }, 403, env, requestId),
      errorCode: "insufficient_scope",
      billable: false,
    };
  } else if (result.billable) {
    const allowance = await checkMonthlyAllowance(key);
    if (!allowance.ok) {
      result = {
        response: jsonResponse({ error: "Monthly allowance exceeded" }, 429, env, requestId),
        errorCode: "quota_exceeded",
        billable: false,
      };
    }
  }

  await logRequest({
    environment: env,
    apiKeyId: key.id,
    orgId: key.org_id,
    endpoint: rest,
    method: req.method,
    requestId,
    responseStatus: result.response.status,
    errorCode: result.errorCode,
    latencyMs: Date.now() - startedAt,
    billable: result.billable && result.response.status === 200,
    tokenCost: result.billable && result.response.status === 200 ? 1 : 0,
    sourceIp: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
    scopesEvaluated: scope ? [scope] : [],
    rateLimitDecision: "allowed",
    requestPayloadHash: null,
  });

  return result.response;
});
