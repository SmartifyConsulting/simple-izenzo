// Picks out the facts a reader actually scans an AI summary for — material terms, amounts,
// quantities, dates and percentages — and renders them in bold so the summary remains scannable.
const KEY_TERM_PATTERN =
  /(?:\b(?:quantity|price|currency|delivery|payment terms?|specifications?|location|jurisdiction|deadline|duration|contract term|incoterms?|units?|scope)\b)|(?:[$€£R]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|k|m|bn))?)|(?:\b(?:USD|EUR|GBP|ZAR|R)\s?\d[\d,]*(?:\.\d+)?\b)|(?:\b\d[\d,]*(?:\.\d+)?\s?(?:MT|kg|tonnes?|tons?|barrels?|units?|bbl|%)\b)|(?:\b\d{1,3}(?:\.\d+)?%\b)|(?:\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)|(?:\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b)/gi;

export function highlightKeyTerms(text: string): React.ReactNode[] {
  const parts = text.split(KEY_TERM_PATTERN);
  const matches = text.match(KEY_TERM_PATTERN) ?? [];
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`t${i}`}>{part}</span>);
    if (matches[i]) {
      nodes.push(
        <span key={`m${i}`} className="font-semibold text-emerald-600">
          {matches[i]}
        </span>,
      );
    }
  });
  return nodes;
}

/** The AI document summary, laid out as a scannable list — section headers (Proposal, Scope,
 * Deliverables, Evaluation Criteria, Due Date) read as their own row, their bullets nest under
 * them, and material terms/amounts/dates are picked out in bold. Same formatting for the bidder
 * and the counterparty, since both are reading the same summary of the same documents. */
export function DocumentSummaryList({ summary, maxChars }: { summary: string; maxChars?: number }) {
  const text = maxChars ? summary.slice(0, maxChars) : summary;
  return (
    <ul className="space-y-1 text-xs leading-relaxed text-foreground">
      {text
        .split("\n")
        .filter((raw) => raw.trim().length > 0)
        .map((raw, i) => {
          // A sub-bullet is indented under the section header directly above it (e.g.
          // Scope/Deliverables/Evaluation Criteria's own items) — nested and disc-marked, but
          // never run through highlightKeyTerms on the header word itself.
          const isSub = /^\s{2,}[-•*]/.test(raw);
          const t = raw.replace(/^\s*[-•*]\s*/, "").trim();
          const headerMatch = !isSub && /^(Proposal|Scope|Deliverables|Evaluation Criteria|Due Date)\s*:?\s*(.*)$/i.exec(t);
          if (isSub) {
            return (
              <li key={i} className="ml-4 list-disc pl-1">
                {highlightKeyTerms(t)}
              </li>
            );
          }
          if (headerMatch) {
            const [, label, rest] = headerMatch;
            return (
              <li key={i} className="list-none pt-1.5 font-semibold text-foreground first:pt-0">
                {label}
                {rest ? <>: {highlightKeyTerms(rest)}</> : null}
              </li>
            );
          }
          return (
            <li key={i} className="ml-4 list-disc pl-1">
              {highlightKeyTerms(t)}
            </li>
          );
        })}
    </ul>
  );
}
