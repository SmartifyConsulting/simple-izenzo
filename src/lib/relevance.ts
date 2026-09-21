/** Decides whether a search result has anything to do with what was searched for. Shared so every
 * screen that lists counterparties applies exactly the same rule. */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "was",
  "our", "their", "have", "has", "will", "can", "all", "not", "who", "what", "how",
  "www", "com", "https", "http", "a", "an", "of", "to", "in", "on", "at", "by", "or",
]);

/** Words that describe the act of searching rather than what is being searched for. */
const GENERIC_TERMS = new Set([
  "looking", "need", "want", "find", "seeking", "search", "supplier", "suppliers", "buyer",
  "buyers", "seller", "sellers", "company", "companies", "trade", "trading", "project", "projects",
  "proposal", "rfp", "rfq", "request", "tender", "service", "services", "solution", "solutions",
  "provider", "providers", "supply", "contract", "document",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** The distinguishing terms of a query, reduced to a stem so a plural or a typo'd ending still
 * matches ("prospcets" → "pros"). */
export function relevanceTerms(text: string): string[] {
  return [
    ...new Set(
      words(text)
        .filter((w) => !GENERIC_TERMS.has(w))
        .map((w) => (w.length >= 5 ? w.slice(0, 4) : w.replace(/s$/, ""))),
    ),
  ];
}

export type Relatable = {
  name: string;
  sector?: string | null | undefined;
  jurisdiction?: string | null | undefined;
  rationale?: string | null | undefined;
};

/** A result only belongs on screen if it has something to do with what was asked for: at least one
 * of the query's terms (two, when the query has three or more) must appear in what is known about
 * the organisation. Anything else is noise and is dropped rather than ranked low. */
export function isRelevant(c: Relatable, query: string, opts: { loose?: boolean } = {}): boolean {
  const terms = relevanceTerms(query);
  if (terms.length === 0) return true;
  const haystack = words([c.name, c.sector ?? "", c.jurisdiction ?? "", c.rationale ?? ""].join(" "));
  const hits = terms.filter((t) => haystack.some((h) => h.startsWith(t))).length;
  // Loose is a last sanity check for results a fuller test has already judged: one shared term.
  return hits >= (!opts.loose && terms.length >= 3 ? 2 : 1);
}
