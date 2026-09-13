/** Shared rule for collapsing the same organisation found more than once, so the shortlist in the
 * workflow and the full match list behave identically. Company suffixes and punctuation are
 * ignored, so "Deloitte & Touche" and "Deloitte Touche LLP" read as one result. */

const SUFFIXES =
  /\b(inc|llc|llp|pllc|ltd|limited|plc|pty|pte|gmbh|bv|nv|sa|srl|co|corp|corporation|company|group|holdings|holding|partners|associates|advisors|advisers|attorneys|law|legal|services|africa|international|global)\b/g;

export function nameKey(name: string) {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hostKey(url: string | null | undefined) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

type Base = { id: string; name: string; score?: number | null };

/** Keeps the highest-scoring row per organisation and remembers every page it was found on. */
export function dedupeOrgs<T extends Base>(
  rows: T[],
  sourceUrlOf: (row: T) => string | null | undefined,
): (T & { sourceUrls?: string[] })[] {
  const byKey = new Map<string, T & { sourceUrls?: string[] }>();
  const hostToKey = new Map<string, string>();
  for (const row of rows) {
    const host = hostKey(sourceUrlOf(row));
    const key = (host && hostToKey.get(host)) || nameKey(row.name) || row.id;
    if (host && !hostToKey.has(host)) hostToKey.set(host, key);
    const existing = byKey.get(key);
    const url = sourceUrlOf(row);
    const urls = Array.from(new Set([...(existing?.sourceUrls ?? []), ...(url ? [url] : [])]));
    if (!existing) {
      byKey.set(key, { ...row, sourceUrls: urls });
      continue;
    }
    const better = (row.score ?? 0) > (existing.score ?? 0) ? row : existing;
    byKey.set(key, { ...better, sourceUrls: urls });
  }
  return Array.from(byKey.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
