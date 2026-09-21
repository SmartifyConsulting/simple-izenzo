/** Server-only. A contemporaneous public price benchmark for a commodity, so a pricing
 * recommendation can be checked against something real instead of saying "a benchmark is needed".
 * Tavily is used when connected, OpenAI's own web search otherwise. Returns null when nothing could
 * be retrieved, and callers must then say so rather than supply a figure from memory. */

export type MarketContext = {
  text: string;
  sources: { url: string; title: string }[];
  retrievedAt: string;
};

export async function loadMarketContext(opts: {
  apiKey: string;
  commodity: string | null;
  jurisdiction?: string | null;
}): Promise<MarketContext | null> {
  const commodity = (opts.commodity ?? "").trim();
  if (!commodity) return null;
  const retrievedAt = new Date().toISOString();
  const query = `${commodity} price per tonne USD current market benchmark spot`;

  try {
    const { loadTavilyApiKey, tavilySearch } = await import("@/lib/tavily.server");
    const tavilyKey = await loadTavilyApiKey();
    if (tavilyKey) {
      const pages = await tavilySearch(tavilyKey, query, { depth: "basic", max: 6, timeoutMs: 25_000 });
      if (pages.length === 0) return null;
      return {
        retrievedAt,
        sources: pages.map((p) => ({ url: p.url, title: p.title })),
        text: pages.map((p) => `- ${p.title} (${p.url}): ${p.content.slice(0, 500)}`).join("\n"),
      };
    }
    const { webSearch } = await import("@/lib/openaiWebSearch.server");
    const r = await webSearch({
      apiKey: opts.apiKey,
      models: ["gpt-6-astra", "gpt-5"],
      effort: "low",
      timeoutMs: 60_000,
      instructions:
        "Find the current publicly reported market benchmark price for the commodity given. Report only figures that your sources actually state, each with its date and the name of the source. " +
        "If no current figure can be found, say so plainly. Never give a price from memory.",
      input: `Commodity: ${commodity}. Query: ${query}`,
    });
    return { retrievedAt, text: r.text, sources: r.sources };
  } catch {
    return null;
  }
}
