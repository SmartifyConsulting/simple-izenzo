/** Server-only. The one place every AI chat request in this app goes through.
 *
 * All AI traffic runs on the OpenAI account saved under Admin → Integrations. There is no
 * built-in/gateway fallback: if no key is saved the request fails with wording that says so,
 * rather than silently billing a different account.
 */

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
 * an ordinary OpenAI-style body and get an ordinary reply back. */
export async function callAiChat(
  apiKey: string | null,
  body: unknown,
  opts: { retries?: number } = {},
): Promise<Response> {
  if (!aiConfigured(apiKey)) return missingKeyResponse();
  const { callOpenAiChat } = await import("@/lib/openaiCall.server");
  return callOpenAiChat(apiKey as string, body, opts);
}

/** Plain wording for a failed request. */
export async function aiChatFailureMessage(res: Response): Promise<string> {
  const { openAiFailureMessage } = await import("@/lib/openaiCall.server");
  return openAiFailureMessage(res);
}
