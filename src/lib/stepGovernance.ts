export type StepGovernance = {
  responsible: string;
  inputs: string;
  output: string;
  template?: string;
  gate: string;
};

/** Private step contract: who does it, what goes in, what comes out, and what must be done first. */
export const STEP_GOVERNANCE: Record<string, StepGovernance> = {
  "trading/bid-offer": { responsible: "Bidder", inputs: "Commodity, quantity, price, delivery terms", output: "Registered Bid/Offer", gate: "All mandatory bid fields completed" },
  "trading/documents": { responsible: "Bidder", inputs: "Supporting files (specs, certificates)", output: "Fingerprinted document set", template: "Product Specification Sheet", gate: "At least one document uploaded" },
  "trading/search": { responsible: "Bidder", inputs: "Registered bid terms", output: "Search query set", gate: "Search run completed" },
  "trading/ai": { responsible: "System (advisory)", inputs: "Search results, bid terms", output: "Candidate counterparty list", gate: "First-pass results returned" },
  "trading/ai-plus": { responsible: "System (advisory)", inputs: "Shortlisted candidate", output: "Extended relevance report", gate: "Human review of results" },
  "trading/counterparties": { responsible: "Bidder", inputs: "Candidate list", output: "Shortlist", gate: "At least one counterparty shortlisted" },
  "trading/choice": { responsible: "Bidder", inputs: "Shortlist", output: "Recorded choice event", gate: "Attributed human choice recorded" },
  "trading/online-media": { responsible: "Bidder", inputs: "Chosen party names", output: "Online media screening report", gate: "Screening reviewed" },
  "trading/media": { responsible: "Bidder", inputs: "Deal and party names", output: "Media signals summary", gate: "Scan reviewed" },
  "trading/intent": { responsible: "Bidder", inputs: "Final terms", output: "Confirmed intent", gate: "Intent confirmed by bidder" },
  "trading/poi": { responsible: "Bidder", inputs: "Confirmed intent, 1 token", output: "Sealed Intent certificate", template: "Proof of Intent Certificate", gate: "Payment + immutable seal" },
  "compliance/wad": { responsible: "Both Parties", inputs: "KYC/KYB documents, sealed intent", output: "WaD verification record", gate: "All KYC/KYB checks passed (non-waivable)" },
  "execution/business-docs": { responsible: "Both Parties", inputs: "NDA, MOU, contracts", output: "Signed Legal Agreements", template: "NDA / MOU", gate: "Digital signature by both parties on every document" },
  "execution/entry": { responsible: "Bidder", inputs: "Signed agreements", output: "Execution entry position", gate: "Entry recorded" },
  "execution/preparation": { responsible: "Both Parties", inputs: "Concept, pre-feasibility data", output: "Feasibility Study", template: "Feasibility Study", gate: "Document named and uploaded" },
  "execution/bankability": { responsible: "Funder", inputs: "Feasibility Study", output: "Bankability Assessment", template: "Bankability Report", gate: "Assessment recorded" },
  "execution/implementation": { responsible: "Both Parties", inputs: "Approved plan", output: "Implementation progress log", gate: "Progress recorded" },
  "execution/stakeholders": { responsible: "Bidder", inputs: "Party changes", output: "Stakeholder register", gate: "Entries/exits recorded" },
  "finality/entry": { responsible: "Bidder", inputs: "Execution record", output: "Finality record opened", gate: "Entry recorded" },
  "finality/type": { responsible: "Both Parties", inputs: "Outcome", output: "Finality type", gate: "Type selected" },
  "finality/evidence": { responsible: "Both Parties", inputs: "Delivery / payment proof", output: "Finality evidence set", gate: "Evidence uploaded" },
  "finality/change": { responsible: "Both Parties", inputs: "Change details", output: "Change/value event", gate: "Event recorded or none declared" },
  "finality/validation": { responsible: "Counterparty", inputs: "Finality evidence", output: "Acceptance", gate: "Digital acceptance by counterparty" },
  "finality/record": { responsible: "Both Parties", inputs: "Accepted finality", output: "Sealed Finality Record", template: "Finality Certificate", gate: "Digital signature by both parties" },
  "memory/ledger": { responsible: "All (read-only)", inputs: "Full transaction history", output: "Memory ledger", gate: "None — read only" },
};

export const GOVERNANCE_OWNER = "georgia.adams@smartify.co.za";
export function canSeeGovernance(email?: string | null) {
  const e = (email ?? "").toLowerCase();
  return e === GOVERNANCE_OWNER || e.endsWith("@georgiaadams.co.za");
}
