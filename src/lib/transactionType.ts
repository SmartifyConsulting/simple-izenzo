/** AI+ orchestration: what a transaction fundamentally is, before any advice is asked for.
 *
 * A generic bid/offer schema (commodity, quantity, price, Incoterms) fits a commodity trade but
 * loses the facts that actually matter for other transaction shapes — a renewable-energy project
 * turns on grid capacity, PPA tenor, EPC timing, battery degradation, land rights and
 * environmental conditions, none of which has a field of its own on `transactions`. Sending the
 * generic schema alone to the model made it reason with generic supplier/buyer logic regardless
 * of what the documents actually said.
 *
 * This module is the fixed, extensible list of transaction types, each with its own fact schema
 * (what `docSummary.functions.ts` extracts from the documents into `structured_facts`) and its
 * own reasoning rule (what `decisionPack.functions.ts` tells the model to focus on). Adding a
 * transaction type means adding one entry here — the extraction prompt, the AI+ system prompt and
 * the stored schema all read from this single list. */

export const TRANSACTION_TYPES = ["commodity_trade", "project_finance", "other"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export function isTransactionType(v: unknown): v is TransactionType {
  return typeof v === "string" && (TRANSACTION_TYPES as readonly string[]).includes(v);
}

export type FactField = { key: string; label: string; hint: string };

/** The type-specific facts worth extracting from documents. Keys are stored verbatim in
 * `transactions.structured_facts`; only the fields for the classified type are ever filled. */
export const FACT_SCHEMA: Record<TransactionType, FactField[]> = {
  commodity_trade: [
    { key: "grade_or_spec", label: "Grade / specification", hint: "assay, purity, grade or technical spec stated" },
    { key: "delivery_window", label: "Delivery window", hint: "loading or delivery dates or period stated" },
    { key: "payment_terms", label: "Payment terms", hint: "LC, advance payment, open account, escrow, retention" },
    { key: "logistics", label: "Logistics", hint: "port, vessel, transport mode, packaging, inspection" },
  ],
  project_finance: [
    { key: "grid_capacity", label: "Grid capacity", hint: "MW/MVA connection capacity, grid code compliance, connection agreement status" },
    { key: "ppa_tenor", label: "PPA tenor and pricing", hint: "power purchase agreement length, offtaker, tariff or pricing mechanism" },
    { key: "epc_timing", label: "EPC timing", hint: "EPC contractor, construction milestones, completion date, delay penalties" },
    { key: "battery_degradation", label: "Battery / storage degradation", hint: "capacity fade over time, augmentation plan, warranty terms" },
    { key: "land_rights", label: "Land rights", hint: "lease, servitude or ownership, term, renewal, encumbrances" },
    { key: "environmental_conditions", label: "Environmental conditions", hint: "EIA status, permits held or pending, conditions of approval" },
    { key: "financing_structure", label: "Financing structure", hint: "debt/equity ratio, tenor, DSCR, sponsors, security package" },
  ],
  other: [],
};

/** All fields across every type, for the single extraction prompt sent to the document-reading
 * model — it is told to fill only the fields belonging to the type it classifies. */
export const ALL_FACT_FIELDS: (FactField & { type: TransactionType })[] = TRANSACTION_TYPES.flatMap((type) =>
  FACT_SCHEMA[type].map((f) => ({ ...f, type })),
);

/** What AI+ is told to focus its reasoning on for each transaction type. Every entry names the
 * generic sourcing logic it must NOT fall back to, and the specific facts it must reason over
 * instead when they are on file — and says plainly when a fact is a gap rather than inventing a
 * typical figure for it. */
export const REASONING_RULES: Record<TransactionType, string> = {
  commodity_trade:
    "This is a commodity trade. Reason over grade/specification conformance, delivery timing, payment security, logistics and counterparty performance risk.",
  project_finance:
    "This is a PROJECT FINANCE transaction, not a commodity trade — do not apply generic supplier/buyer sourcing logic (quality inspection, shipment terms, Incoterms) as the primary lens. " +
    "Reason specifically over, wherever the facts on file allow: grid capacity and connection risk; PPA tenor, offtaker and tariff risk; EPC contractor and completion timing risk; " +
    "battery or storage degradation and warranty risk; land rights, lease and permit risk; environmental approval risk; and the financing structure (gearing, tenor, DSCR, sponsor strength). " +
    "If a fact in this list is not on file, say plainly that it is a gap and what would need to be produced to close it — never assume a typical or industry-standard figure in its place.",
  other:
    "Reason from the facts actually on file for this transaction. Do not force either a commodity-trade or a project-finance framework onto it if the documents describe something else.",
};

/** A quick, deterministic fallback used only when a transaction has never been through document
 * classification (no documents uploaded, or the summarizer has not run yet) — safer than
 * defaulting every transaction to "commodity_trade" and reasoning about shipment terms over a
 * project that was never a trade. Real classification (`docSummary.functions.ts`) always takes
 * precedence when it has run. */
export function classifyTransactionTypeHeuristic(input: {
  commodity?: string | null;
  title?: string | null;
  documentSummary?: string | null;
}): TransactionType {
  const text = [input.commodity, input.title, input.documentSummary].filter(Boolean).join(" ").toLowerCase();
  const PROJECT_FINANCE_HINTS = [
    "solar", "wind", "ppa", "epc", " mw", "mva", "grid", "battery", "bess", "substation",
    "offtake", "offtaker", "renewable", "hydro", "power plant", "transmission", "photovoltaic",
  ];
  if (PROJECT_FINANCE_HINTS.some((h) => text.includes(h))) return "project_finance";
  if (input.commodity) return "commodity_trade";
  return "other";
}

/** Non-empty structured facts as `key: value` lines, for the AI+ prompt. Empty/null fields are
 * left out rather than shown as "not recorded" noise — a gap is handled by the reasoning rule
 * above, not by restating every unset key. */
export function structuredFactsLines(type: TransactionType, facts: unknown): string[] {
  if (!facts || typeof facts !== "object") return [];
  const f = facts as Record<string, unknown>;
  return FACT_SCHEMA[type]
    .map((field) => {
      const v = f[field.key];
      if (v == null || (typeof v === "string" && !v.trim())) return null;
      return `${field.label}: ${String(v).trim()}`;
    })
    .filter((l): l is string => Boolean(l));
}
