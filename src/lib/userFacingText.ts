/** People using the app should read about the product or service they asked for — never about how
 * Izenzo works underneath. Anything a model writes passes through here before it is stored or shown,
 * so a sentence that talks about the machinery (AI, AI+, models, scoring, sources, searching) is
 * dropped rather than reaching the person. */

const MECHANICS =
  /\b(AI\+?|A\.I\.|artificial intelligence|Izenzo|GPT[-\w]*|OpenAI|LLM|language model|machine learning|algorithm|prompt|Firecrawl|decision pack|advisory|the sources?|source \d+|scraped|grounding|our (search|scoring|system|platform)|match (score|percentage)|scoring)\b/i;

/** Keeps only the sentences that are about the organisation/product itself. Returns null when
 * nothing user-facing is left. */
export function userFacingText(text: string | null | undefined): string | null {
  if (!text) return null;
  const kept = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !MECHANICS.test(s));
  const out = kept.join(" ").trim();
  return out.length > 0 ? out : null;
}

const SOURCE_LABELS: Record<string, string> = {
  ai_search: "Found for you",
  ai_plus_search: "Found for you",
  ai: "Found for you",
  ai_plus: "Found for you",
  web_search: "Found for you",
  registry: "Registered supplier",
  manual: "Added by you",
};

/** A plain-language replacement for the internal source code a counterparty row carries. */
export function sourceLabel(source: string | null | undefined): string {
  return SOURCE_LABELS[(source ?? "").toLowerCase()] ?? "Found for you";
}
