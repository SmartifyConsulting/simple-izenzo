/** The requester's own terms (quantity, price, delivery terms, dates) are what a search MATCHES ON.
 * They are never facts about an organisation the search surfaces — so they are recognised here and
 * kept out of anything written about a counterparty unless that counterparty's own source says the
 * same thing. Pure and shared, so the search and the screens apply the same rule. */

const norm = (s: string) => s.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/\s+/g, " ");

/** Numbers and delivery phrases in what the requester submitted. */
export function bidTermTokens(parts: (string | number | null | undefined)[]): string[] {
  const text = norm(parts.filter((p) => p !== null && p !== undefined).join(" \n "));
  const tokens = new Set<string>();
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
    // A lone digit is too common to mean anything; two or more is a quantity, price or date.
    if (m[0].replace(/\D/g, "").length >= 2) tokens.add(m[0]);
  }
  for (const m of text.matchAll(/\b(delivered|delivery|dap|ddp|cif|cfr|fob|exw|fca|cip)\b(?:\s+[a-z]{3,}){0,2}/g)) {
    tokens.add(m[0].trim());
  }
  return [...tokens];
}

const has = (haystack: string, token: string): boolean =>
  /^\d/.test(token) ? new RegExp(`(?<![\\d.])${token.replace(/\./g, "\\.")}(?![\\d])`).test(haystack) : haystack.includes(token);

/** Drops every sentence that states one of the requester's terms as if it were a fact about the
 * organisation — unless the organisation's own source text (when known) carries that same term.
 * Returns undefined when nothing is left. */
export function stripBidTerms(text: string | null | undefined, tokens: string[], sourceText?: string): string | undefined {
  if (!text) return undefined;
  if (tokens.length === 0) return text.trim() || undefined;
  const source = sourceText === undefined ? null : norm(sourceText);
  const kept = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      if (!sentence) return false;
      const n = norm(sentence);
      return !tokens.some((t) => has(n, t) && !(source !== null && has(source, t)));
    });
  const out = kept.join(" ").trim();
  return out.length > 0 ? out : undefined;
}

/** For text handed to a model as background: the requester's terms replaced by a marker, so they
 * cannot be echoed back as something a counterparty is said to have done or offered. */
export function redactBidTerms(text: string, tokens: string[]): string {
  let out = text;
  for (const t of tokens) {
    const pattern = /^\d/.test(t) ? new RegExp(`(?<![\\d.])${t.replace(/\./g, "\\.")}(?![\\d])`, "gi") : new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(pattern, "[requester's term]");
  }
  return out;
}
