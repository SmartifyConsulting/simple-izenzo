/** Server-only. Sends counterparty-search reasoning to Lovable's built-in AI instead of the saved
 * OpenAI account. This is a deliberate, temporary arrangement: the OpenAI account attached to the
 * app has no credit, so searching would otherwise be refused outright. The saved OpenAI credential
 * is untouched — switching back is a single flag here.
 *
 * Nothing about governance changes: this only reads public pages that Tavily already fetched and
 * proposes candidates. Every decision stays a human one. */

const GATEWAY_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** The model every search request uses on the built-in service. */
export const LOVABLE_AI_MODEL = "openai/gpt-6-astra";

/** Marks a reply as having come from the built-in service, so the failure wording can name the
 * right account instead of blaming OpenAI. */
export const LOVABLE_PROVIDER_HEADER = "x-izenzo-ai-provider";

export function lovableAiConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"]);
}

type ChatBody = Record<string, unknown>;

/** Rewrites a request written for the OpenAI account so the built-in service accepts it: its own
 * model id, a reasoning depth it requires, and none of the fields that model rejects. The depth
 * follows what the caller asked for — the ordinary search stays light, the AI+ pass goes deeper. */
function toGatewayBody(body: unknown): ChatBody {
  const source = (body ?? {}) as ChatBody;
  const requested = String(source["reasoning_effort"] ?? "low");
  const effort = requested === "high" || requested === "medium" ? "medium" : "low";
  const out: ChatBody = { ...source };
  delete out["temperature"];
  delete out["top_p"];
  delete out["max_tokens"];
  out["model"] = LOVABLE_AI_MODEL;
  out["reasoning_effort"] = effort;
  if (typeof out["max_completion_tokens"] !== "number") out["max_completion_tokens"] = 8000;
  // A request asking for a JSON reply must also say so in the conversation itself, or the service
  // refuses it outright.
  const format = out["response_format"] as { type?: string } | undefined;
  const messages = Array.isArray(out["messages"]) ? (out["messages"] as { role?: string; content?: unknown }[]) : [];
  if (format?.type === "json_object" && messages.length > 0) {
    const mentionsJson = messages.some((m) => String(m.content ?? "").toLowerCase().includes("json"));
    if (!mentionsJson) {
      out["messages"] = messages.map((m, i) =>
        i === 0 ? { ...m, content: `${String(m.content ?? "")}\n\nAnswer with a single JSON object.` } : m,
      );
    }
  }
  return out;
}

/** Only a rate limit or a service fault is worth retrying; a credit or policy block is terminal and
 * comes straight back so the person is told rather than kept waiting. */
export async function callLovableAiChat(body: unknown, opts: { retries?: number } = {}): Promise<Response> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Lovable AI is not available in this environment.");
  const delays = [1000, 3000].slice(0, opts.retries ?? 2);
  const payload = JSON.stringify(toGatewayBody(body));
  const call = () =>
    fetch(GATEWAY_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: payload,
    });

  let res = await call();
  for (const base of delays) {
    if (res.status !== 429 && res.status < 500) break;
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 10_000)
        : base + Math.floor(Math.random() * 400);
    await new Promise((r) => setTimeout(r, wait));
    res = await call();
  }
  return tagProvider(res);
}

/** Keeps the body intact while recording which service answered. */
function tagProvider(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set(LOVABLE_PROVIDER_HEADER, "lovable");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function isLovableAiResponse(res: Response): boolean {
  return res.headers.get(LOVABLE_PROVIDER_HEADER) === "lovable";
}

/** Plain wording for a built-in-AI failure, naming the Lovable workspace rather than OpenAI so the
 * two cases are never confused. */
export async function lovableAiFailureMessage(res: Response): Promise<string> {
  let providerMessage = "";
  try {
    const payload = (await res.clone().json()) as { message?: string; error?: { message?: string } };
    providerMessage = (payload.error?.message ?? payload.message ?? "").trim();
  } catch {
    // Not JSON — the status alone says enough below.
  }

  if (res.status === 402) {
    return (
      providerMessage ||
      "The Lovable workspace has no AI credits left. Add credits in Lovable under Settings → Plans & credits, then try again."
    );
  }
  if (res.status === 403) {
    return (
      providerMessage ||
      "AI use is blocked for this Lovable workspace, or its AI spending limit has been reached. A workspace administrator can lift it in Lovable settings."
    );
  }
  if (res.status === 401) {
    return "The built-in AI service refused this app's key. Please report this — it needs to be re-issued.";
  }
  if (res.status === 429) {
    return "The built-in AI service is handling too many requests right now. Wait a moment and try again.";
  }
  if (res.status >= 500) {
    return "The built-in AI service is temporarily unavailable. Please try again shortly.";
  }
  return providerMessage || "The AI request failed. Please try again later.";
}
