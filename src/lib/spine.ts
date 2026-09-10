export type StageKey = "trading" | "compliance" | "execution" | "finality" | "memory";

export type StepDef = {
  key: string;
  label: string;
  blurb: string;
};

export type StageDef = {
  key: StageKey;
  label: string;
  steps: StepDef[];
};

export const SPINE: StageDef[] = [
  {
    key: "trading",
    label: "Trading Gate",
    steps: [
      { key: "bid-offer", label: "Bid / Offer", blurb: "Record the opening bid or offer and its terms." },
      { key: "documents", label: "Upload Docs", blurb: "Attach supporting documents with a fingerprint." },
      { key: "search", label: "Search", blurb: "Run a structured search for possible counterparties." },
      { key: "ai", label: "AI", blurb: "AI reads the record and proposes. It never decides." },
      { key: "ai-plus", label: "AI+", blurb: "Deeper analysis: risk, pricing sanity, jurisdiction notes." },
      { key: "counterparties", label: "Counterparties", blurb: "Counterparties surfaced by search and AI." },
      {
        key: "online-media",
        label: "Online Media Checks",
        blurb: "Scan LinkedIn, Facebook, TikTok, marketplaces and news for each shortlisted party.",
      },
      { key: "choice", label: "Choice", blurb: "A person chooses the counterparty. Recorded as an event." },
      { key: "media", label: "Social / News Media", blurb: "Scan open media for signals on the deal and parties." },
      { key: "intent", label: "Intent", blurb: "Confirm the intent to transact on the stated terms." },
      { key: "poi", label: "Proof of Intent", blurb: "Seal the Proof of Intent. Costs 1 token (USD 10)." },
    ],
  },
  {
    key: "compliance",
    label: "Compliance Gate",
    steps: [
      { key: "wad", label: "WaD Case", blurb: "Without a Doubt: KYC, KYB, UBO, sanctions and PEP. 3 tokens (USD 30)." },
    ],
  },
  {
    key: "execution",
    label: "Execution Gate",
    steps: [
      { key: "entry", label: "Execution Entry", blurb: "Open execution and record the entry position." },
      { key: "preparation", label: "Project Preparation", blurb: "Concept, pre-feasibility and feasibility." },
      { key: "bankability", label: "Bankability", blurb: "Record the bankability assessment." },
      { key: "implementation", label: "Implementation", blurb: "Record implementation progress." },
      { key: "stakeholders", label: "Stakeholder Entry / Exit", blurb: "Who joined, who left, and when." },
    ],
  },
  {
    key: "finality",
    label: "Finality Gate",
    steps: [
      { key: "entry", label: "Finality Entry", blurb: "Open the finality record." },
      { key: "type", label: "Finality Type", blurb: "Completion, termination, novation or lapse." },
      { key: "evidence", label: "Finality Evidence", blurb: "Evidence supporting the finality position." },
      { key: "change", label: "Change or Value Event", blurb: "Record any change or value event." },
      { key: "validation", label: "Validation & Acceptance", blurb: "Validate and accept the finality record." },
      { key: "record", label: "Finality Record", blurb: "Seal the finality record." },
    ],
  },
  {
    key: "memory",
    label: "Memory Gate",
    steps: [
      { key: "ledger", label: "Memory Ledger", blurb: "Read the transaction forward and backward." },
    ],
  },
];

export const FLAT_STEPS = SPINE.flatMap((stage) =>
  stage.steps.map((step) => ({ stage: stage.key, ...step })),
);

export function stepIndex(stage: string, step: string) {
  return FLAT_STEPS.findIndex((s) => s.stage === stage && s.key === step);
}

export function stageOf(stage: string) {
  return SPINE.find((s) => s.key === stage);
}

export function stepDef(stage: string, step: string) {
  return stageOf(stage)?.steps.find((s) => s.key === step);
}

export const POI_COST = 1;
export const WAD_COST = 3;
export const TOKEN_PRICE_USD = 10;

/**
 * Reason a step is locked, or null when it is reachable. Gates themselves are not
 * necessarily worked in strict order (compliance/execution/finality open on their own
 * token gates), but the steps within a gate always are: a step is locked until every
 * step before it, in that gate, has been reached.
 */
export function lockReason(
  stage: StageKey,
  step: string,
  tx: { stage: string; step: string; poi_sealed_at: string | null; wad_completed_at: string | null } | null,
): string | null {
  if (!tx) return null;
  const poi = Boolean(tx.poi_sealed_at);
  const wad = Boolean(tx.wad_completed_at);
  if (stage === "compliance" && !poi) return "Proof of Intent required";
  if (stage === "execution" || stage === "finality" || stage === "memory") {
    if (!poi) return "Proof of Intent required";
    if (!wad) return "WaD verification required";
  }

  const targetIdx = stepIndex(stage, step);
  const currentIdx = stepIndex(tx.stage, tx.step);
  if (targetIdx > currentIdx) return "Complete the earlier steps first";
  return null;
}
