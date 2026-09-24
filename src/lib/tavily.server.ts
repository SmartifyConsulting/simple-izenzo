/** Server-only. Public internet search through Tavily. The key saved in Admin → Integrations →
 * Tavily is used first; the server secret TAVILY_API_KEY is the fallback. It is read on every call,
 * so saving or rotating the key takes effect immediately. */

import type { AiUsageContext } from "@/lib/aiUsage.server";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export async function loadTavilyApiKey(): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecrets } = await import("@/lib/integrationCrypto.server");
    const { data: row } = await supabaseAdmin
      .from("integration_credentials")
      .select("*")
      .eq("provider", "tavily")
      .maybeSingle();
    if (row) {
      const secrets = await decryptSecrets(row.secrets_encrypted as string | null);
      const apiKey = (secrets["api_key"] ?? "").trim();
      if (apiKey) return apiKey;
    }
  } catch {
    // No saved entry, or it cannot be read — the server secret below still works.
  }
  return process.env["TAVILY_API_KEY"]?.trim() || null;
}

export type TavilyResult = { title: string; url: string; content: string };

/** Plain wording for the ways a Tavily request fails. */
export function tavilyFailureMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "The Tavily API key was rejected — update it in Admin → Integrations, then try again.";
  }
  if (status === 429 || status === 432 || status === 433) {
    return "Tavily's usage limit has been reached — top up or upgrade the Tavily plan, then try again.";
  }
  return `Tavily could not search just now (${status}).`;
}

/** One public-internet search. Returns the result pages with the text Tavily extracted from each. */
export async function tavilySearch(
  apiKey: string,
  query: string,
  opts: {
    depth?: "basic" | "advanced";
    max?: number;
    topic?: "general" | "news";
    includeDomains?: string[];
    timeoutMs?: number;
    /** Records this call's flat per-search-credit cost against a transaction/org for the Expense
     * report — best-effort, optional. */
    usage?: AiUsageContext | undefined;
  } = {},
): Promise<TavilyResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query.slice(0, 400),
        search_depth: opts.depth ?? "basic",
        topic: opts.topic ?? "general",
        max_results: Math.min(Math.max(opts.max ?? 6, 1), 20),
        include_answer: false,
        include_raw_content: false,
        ...(opts.includeDomains && opts.includeDomains.length > 0 ? { include_domains: opts.includeDomains } : {}),
      }),
    });
    if (!res.ok) throw new Error(tavilyFailureMessage(res.status));
    const payload = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    if (opts.usage) {
      const { logAiUsage, tavilySearchCostUsd } = await import("@/lib/aiUsage.server");
      void logAiUsage({
        provider: "tavily",
        operation: opts.usage.operation,
        transactionId: opts.usage.transactionId,
        orgId: opts.usage.orgId,
        costUsd: tavilySearchCostUsd(),
      });
    }
    return (payload.results ?? [])
      .map((r) => ({
        title: String(r.title ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
        url: String(r.url ?? ""),
        content: String(r.content ?? "").replace(/\s+/g, " ").trim().slice(0, 1500),
      }))
      .filter((r) => r.url && (r.title || r.content));
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error("The internet search took too long.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
