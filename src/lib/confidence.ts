/** How much to trust one AI+ recommendation — shown as High / Medium / Low, worked out from how much
 * of what it rests on is actually confirmed in the record, never as a made-up percentage. Pure and
 * shared so the server that stores a recommendation and the screen that shows it agree. */

export type EvidenceKind = "document" | "extracted_fact" | "bid_record" | "public_web" | "general_knowledge";

export type EvidenceRef = {
  kind: EvidenceKind;
  /** The chain from the source to the fact, e.g. "Assay Certificate → sample CCA-260918-73 → Cu 99.94%". */
  chain: string;
  /** True only when the fact is confirmed in a document on file, the bid record, or a cited web page. */
  verified: boolean;
  url?: string | undefined;
  /** Plain text with no statement of whether it was confirmed (older records, the protected AI+ service). */
  unspecified?: boolean | undefined;
};

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  document: "Source document",
  extracted_fact: "Fact from a document",
  bid_record: "Bid/offer record",
  public_web: "Public web",
  general_knowledge: "General knowledge — not verified",
};

const KINDS = new Set<EvidenceKind>(["document", "extracted_fact", "bid_record", "public_web", "general_knowledge"]);

/** Reads what a recommendation rests on, whether stored as structured items or as plain text lines
 * (older records, and the protected AI+ service, send plain text). Plain text carries no proof that
 * anything was confirmed, so it is treated as unverified. */
export function parseEvidenceRefs(raw: unknown): EvidenceRef[] {
  if (!Array.isArray(raw)) return [];
  const out: EvidenceRef[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (item.trim()) out.push({ kind: "document", chain: item.trim().slice(0, 300), verified: false, unspecified: true });
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const chain = String(o["chain"] ?? "").trim().slice(0, 300);
      if (!chain) continue;
      const kind = KINDS.has(o["kind"] as EvidenceKind) ? (o["kind"] as EvidenceKind) : "general_knowledge";
      const url = typeof o["url"] === "string" && /^https?:\/\//.test(o["url"]) ? o["url"].slice(0, 500) : undefined;
      out.push({ kind, chain, verified: o["verified"] === true && kind !== "general_knowledge", ...(url ? { url } : {}) });
    }
  }
  return out.slice(0, 10);
}

/** The share of what a recommendation rests on that is confirmed (0–1). */
export function evidenceCompleteness(refs: EvidenceRef[]): number {
  if (refs.length === 0) return 0;
  return refs.filter((r) => r.verified).length / refs.length;
}

export type Confidence = "High" | "Medium" | "Low";

export function confidenceOf(refs: EvidenceRef[], fallbackScore?: number | null): Confidence {
  // With no statement of what was confirmed, the recommendation's own stored score is all there is.
  const known = refs.filter((r) => !r.unspecified);
  if (known.length === 0) {
    const f = fallbackScore ?? 0;
    return f >= 0.75 ? "High" : f >= 0.4 ? "Medium" : "Low";
  }
  const score = evidenceCompleteness(known);
  if (known.length >= 2 && score >= 0.75) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}
