/** One place that turns a third-party service's refusal into a sentence an administrator can act
 * on. Client-safe (no secrets, no server-only imports) so both the server probes and the admin
 * screen use exactly the same wording. */

export type FailureReason =
  | "no_credits"
  | "bad_key"
  | "rate_limited"
  | "not_configured"
  | "unreachable"
  | "rejected";

export type IntegrationFailure = {
  ok: false;
  reason: FailureReason;
  /** Plain sentence, safe to show to a person and to store as the last-test message. */
  message: string;
  /** The provider's own wording, trimmed — shown underneath as extra detail. */
  detail?: string | undefined;
};

const CREDIT_WORDS =
  /credit|quota|insufficient|balance|out of funds|payment required|upgrade your plan|limit reached|exceeded/i;
const AUTH_WORDS = /unauthori[sz]ed|invalid.?(api.?)?key|invalid token|forbidden|authentication/i;
const NETWORK_WORDS = /fetch failed|timed out|timeout|abort|ENOTFOUND|ECONNREFUSED|network|dns/i;

/** Build the failure from an HTTP reply. */
export function classifyFailure(
  providerName: string,
  status: number | null,
  body: string,
): IntegrationFailure {
  const detail = (body ?? "").trim().slice(0, 300) || undefined;
  const text = body ?? "";

  if (status === 402 || (status !== 401 && status !== 403 && CREDIT_WORDS.test(text) && status !== 429)) {
    return {
      ok: false,
      reason: "no_credits",
      message: `${providerName} has run out of credits. Top up ${providerName} to continue.`,
      detail,
    };
  }
  if (status === 401 || status === 403 || AUTH_WORDS.test(text)) {
    return {
      ok: false,
      reason: "bad_key",
      message: `${providerName} refused the key. Re-enter the key or password and save.`,
      detail,
    };
  }
  if (status === 429) {
    return {
      ok: false,
      reason: "rate_limited",
      message: `${providerName} is limiting how often we can call it. Wait a moment, or upgrade the plan.`,
      detail,
    };
  }
  if (status === null || status === 0 || status >= 500) {
    return {
      ok: false,
      reason: "unreachable",
      message: `Could not reach ${providerName}. The service may be down, or the address saved is wrong.`,
      detail,
    };
  }
  return {
    ok: false,
    reason: "rejected",
    message: `${providerName} rejected the request.`,
    detail,
  };
}

/** Build the failure from a thrown error (no HTTP reply at all). */
export function classifyThrown(providerName: string, err: unknown): IntegrationFailure {
  const raw = err instanceof Error ? err.message : String(err);
  if (NETWORK_WORDS.test(raw)) {
    return {
      ok: false,
      reason: "unreachable",
      message: `Could not reach ${providerName}. The service may be down, or the address saved is wrong.`,
      detail: raw.slice(0, 300),
    };
  }
  if (CREDIT_WORDS.test(raw)) {
    return {
      ok: false,
      reason: "no_credits",
      message: `${providerName} has run out of credits. Top up ${providerName} to continue.`,
      detail: raw.slice(0, 300),
    };
  }
  if (AUTH_WORDS.test(raw)) {
    return {
      ok: false,
      reason: "bad_key",
      message: `${providerName} refused the key. Re-enter the key or password and save.`,
      detail: raw.slice(0, 300),
    };
  }
  return { ok: false, reason: "rejected", message: raw.slice(0, 300) || `${providerName} rejected the request.` };
}

export function notConfigured(providerName: string): IntegrationFailure {
  return {
    ok: false,
    reason: "not_configured",
    message: `No details saved for ${providerName} yet. Fill in the fields and press Save.`,
  };
}
