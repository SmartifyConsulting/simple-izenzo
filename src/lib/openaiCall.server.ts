/** Server-only. One place where every OpenAI chat request in this app is sent, so a transient
 * request limit is retried the same way everywhere and a failure is always explained in the same
 * plain wording. The account used is whatever is saved in Admin → Integrations (see
 * loadOpenAiApiKey) — this helper never changes which account pays. */

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/** Codes that mean the account itself is out of money or capped — retrying cannot help. */
function isTerminalAccountCode(code: string | undefined): boolean {
  return code === "insufficient_quota" || code === "billing_hard_limit_reached";
}

async function errorCodeOf(res: Response): Promise<string | undefined> {
  const payload = (await res
    .clone()
    .json()
    .catch(() => null)) as { error?: { code?: string; type?: string }; type?: string } | null;
  return payload?.error?.code ?? payload?.error?.type ?? payload?.type;
}

/** Sends one chat request, retrying only genuinely transient refusals (429 and 5xx) with bounded
 * backoff and honouring the wait OpenAI asks for. An exhausted or capped account is terminal and
 * comes straight back, so the caller can say so instead of stalling.
 *
 * `retries` exists because a free OpenAI account allows very few requests per minute: the request
 * that matters (reading the documents) should use the retry budget, while a nice-to-have request
 * that has a safe fallback should give up at once rather than spending the allowance. */
export async function callOpenAiChat(
  apiKey: string,
  body: unknown,
  opts: { retries?: number } = {},
): Promise<Response> {
  const delays = [1000, 3000, 7000].slice(0, opts.retries ?? 3);
  const call = () =>
    fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await call();
  for (const base of delays) {
    if (res.status !== 429 && res.status < 500) break;
    if (res.status === 429 && isTerminalAccountCode(await errorCodeOf(res))) break;
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 10_000)
        : base + Math.floor(Math.random() * 400);
    await new Promise((r) => setTimeout(r, wait));
    res = await call();
  }
  return res;
}

/** Turns an OpenAI failure into wording the person in the app can act on: whose account is
 * involved, whether waiting will help, and what to change if it won't. */
export async function openAiFailureMessage(res: Response): Promise<string> {
  let providerMessage = "";
  let code: string | undefined;
  try {
    const payload = (await res.clone().json()) as {
      message?: string;
      type?: string;
      error?: { message?: string; type?: string; code?: string };
    };
    providerMessage = (payload.error?.message ?? payload.message ?? "").trim();
    code = payload.error?.code ?? payload.error?.type ?? payload.type;
  } catch {
    // Not JSON — the status alone still tells us enough below.
  }

  if (isTerminalAccountCode(code)) {
    return "The OpenAI account has no credit left, or has reached the spending limit set on it. Add credit to that OpenAI account, then try again.";
  }
  if (res.status === 429) {
    return "The OpenAI account has reached how many requests it is allowed right now — this is the free-account limit, not a problem with your documents. Wait a minute and try again; adding credit to that OpenAI account removes the limit.";
  }
  if (res.status === 401 || res.status === 403) {
    return "The saved OpenAI API key was refused. Update it in Admin → Integrations, then try again.";
  }
  if (res.status === 413) {
    return "The documents are too large for one AI request. Attach fewer or smaller files, then try again.";
  }
  if (res.status >= 500) {
    return "OpenAI is temporarily unavailable. Please try again shortly.";
  }
  return providerMessage || "The AI request failed. Please try again later.";
}

/** True when the failure means the OpenAI account has no funds left — used to alert support. */
export function isNoCreditResponseCode(code: string | undefined): boolean {
  return isTerminalAccountCode(code);
}
