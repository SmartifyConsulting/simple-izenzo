/** Server-only. The one place every AI chat request in this app goes through.
 *
 * All AI traffic runs on the OpenAI account saved under Admin → Integrations. There is no
 * built-in/gateway fallback: if no key is saved the request fails with wording that says so,
 * rather than silently billing a different account.
 */

import type { AiUsageContext } from "@/lib/aiUsage.server";

/** True when an OpenAI key is available to make a request with. */
export function aiConfigured(apiKey: string | null | undefined): boolean {
  return Boolean(apiKey && apiKey.trim());
}

/** A failure shaped like an OpenAI reply, so callers' existing `!res.ok` handling produces the
 * right message without a special case for "no key". */
function missingKeyResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        message:
          "AI is not connected: add an OpenAI API key under Admin → Integrations, then try again.",
      },
    }),
    { status: 400, headers: { "content-type": "application/json" } },
  );
}

/** Sends one OpenAI chat request, retrying transient limits the same way everywhere. Callers pass
 * an ordinary OpenAI-style body and get an ordinary reply back.
 *
 * Passing `usage` records the real cost of this call (estimated from its token counts) against a
 * transaction/org in ai_usage_events, for the Admin → Integrations Token Ledger — omit it for
 * calls that aren't meaningfully attributable to one (best-effort, optional at every call site). */
export async function callAiChat(
  apiKey: string | null,
  body: unknown,
  opts: {
    retries?: number;
    usage?: AiUsageContext | undefined;
  } = {},
): Promise<Response> {
  if (!aiConfigured(apiKey)) return missingKeyResponse();
  const { callOpenAiChat } = await import("@/lib/openaiCall.server");
  const res = await callOpenAiChat(apiKey as string, body, opts);
  if (opts.usage && res.ok) {
    void logChatUsage(res.clone(), body, opts.usage);
  }
  return res;
}

async function logChatUsage(res: Response, body: unknown, meta: AiUsageContext): Promise<void> {
  try {
    const json = (await res.json()) as {
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const { logAiUsage } = await import("@/lib/aiUsage.server");
    await logAiUsage({
      provider: "openai",
      operation: meta.operation,
      transactionId: meta.transactionId,
      orgId: meta.orgId,
      model: json.model ?? (body as { model?: string } | null)?.model ?? null,
      inputTokens: json.usage?.prompt_tokens ?? null,
      outputTokens: json.usage?.completion_tokens ?? null,
      totalTokens: json.usage?.total_tokens ?? null,
    });
  } catch {
    // Best-effort only.
  }
}

/** Plain wording for a failed request. */
export async function aiChatFailureMessage(res: Response): Promise<string> {
  const { openAiFailureMessage } = await import("@/lib/openaiCall.server");
  return openAiFailureMessage(res);
}
