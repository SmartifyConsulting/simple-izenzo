/** Server-only. Reads the live web through OpenAI's own web search tool, so finding organisations
 * and checking them online needs nothing but the OpenAI account saved in Admin → Integrations. */

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export type WebSource = { url: string; title: string };

export type WebSearchResult = { text: string; sources: WebSource[]; model: string };

type ResponseItem = {
  type?: string;
  content?: { type?: string; text?: string; annotations?: { type?: string; url?: string; title?: string }[] }[];
};

function readOutput(payload: { output?: ResponseItem[] }): { text: string; sources: WebSource[] } {
  let text = "";
  const seen = new Set<string>();
  const sources: WebSource[] = [];
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type !== "output_text") continue;
      text += part.text ?? "";
      for (const a of part.annotations ?? []) {
        if (a.type === "url_citation" && a.url && !seen.has(a.url)) {
          seen.add(a.url);
          sources.push({ url: a.url, title: a.title ?? "" });
        }
      }
    }
  }
  return { text: text.trim(), sources };
}

/** One question answered with live web results. Models are tried in order: a model that does not
 * offer web search is skipped rather than failing the whole request. */
export async function webSearch(opts: {
  apiKey: string;
  instructions: string;
  input: string;
  models: string[];
  effort?: "low" | "medium" | "high";
  timeoutMs?: number;
}): Promise<WebSearchResult> {
  let lastError = "The web could not be searched just now.";
  for (const model of opts.models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 100_000);
    try {
      const call = () =>
        fetch(OPENAI_RESPONSES_URL, {
          method: "POST",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            instructions: opts.instructions,
            input: opts.input,
            tools: [{ type: "web_search" }],
            tool_choice: "required",
            reasoning: { effort: opts.effort ?? "low" },
            max_output_tokens: 16000,
          }),
        });
      let res = await call();

      // One patient retry for a transient request limit.
      if (res.status === 429 && !(await isQuota(res))) {
        await new Promise((r) => setTimeout(r, Number(res.headers.get("retry-after")) * 1000 || 2500));
        res = await call();
      }

      if (!res.ok) {
        // 400/404 mean this model does not take these options or does not exist — try the next.
        if ((res.status === 400 || res.status === 404) && model !== opts.models[opts.models.length - 1]) {
          lastError = `${model} is not available for web search.`;
          continue;
        }
        const { openAiFailureMessage } = await import("@/lib/openaiCall.server");
        throw new Error(await openAiFailureMessage(res));
      }
      const payload = (await res.json()) as { output?: ResponseItem[] };
      const { text, sources } = readOutput(payload);
      if (!text) {
        lastError = "The web search came back empty.";
        continue;
      }
      return { text, sources, model };
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        lastError = "The web search took too long.";
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError);
}

async function isQuota(res: Response): Promise<boolean> {
  const payload = (await res
    .clone()
    .json()
    .catch(() => null)) as { error?: { code?: string; type?: string } } | null;
  const code = payload?.error?.code ?? payload?.error?.type;
  return code === "insufficient_quota" || code === "billing_hard_limit_reached";
}
