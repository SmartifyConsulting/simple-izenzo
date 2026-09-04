import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const Route = createFileRoute("/glossary")({
  head: () => ({
    meta: [
      { title: "Terms & Glossary — Izenzo" },
      {
        name: "description",
        content:
          "Plain definitions of the Izenzo terms: the Trading Gateway, Proof of Intent, WaD, finality, memory and the token gates.",
      },
      { property: "og:title", content: "Terms & Glossary — Izenzo" },
      {
        property: "og:description",
        content: "Plain definitions of the Izenzo terms used across the Izenzo Trading Gateway.",
      },
    ],
  }),
  component: Glossary,
});

const TERMS: { term: string; body: string }[] = [
  {
    term: "The Izenzo Trading Gateway",
    body: "The single ordered path a transaction follows: Trading Gate, Compliance Gate, Execution Gate, Finality Gate, Memory Gate. Steps are written once and never rewritten.",
  },
  {
    term: "Bid / Offer",
    body: "The opening position: direction, price, quantity, unit and terms. Counter-bids are new entries, not edits.",
  },
  {
    term: "Other Docs",
    body: "Supporting documents attached to the transaction. Each is versioned and fingerprinted so a later reader can prove what was seen.",
  },
  {
    term: "Social / News Media Scan",
    body: "A scan of open media for signals about the deal, the commodity and the parties. Findings are recorded, not acted on automatically.",
  },
  {
    term: "AI / AI+",
    body: "AI reads the record and proposes. AI+ goes deeper on risk, pricing sanity and jurisdiction. Neither adopts a choice; a person always confirms, and that confirmation is an event.",
  },
  {
    term: "Choice",
    body: "The moment a person selects a counterparty. It is attributed, timestamped and immutable.",
  },
  {
    term: "Intent",
    body: "A stated willingness to transact on the recorded terms. Intent precedes the seal.",
  },
  {
    term: "Proof of Intent (POI)",
    body: "The sealed record of intent, carrying a fingerprint of the transaction state at that moment. It is a hard gate: nothing beyond Trading opens without it. It costs 1 token (USD 10).",
  },
  {
    term: "Token",
    body: "The unit of account for gated actions. One token is USD 10. Tokens are drawn from the organisation's balance and every movement is written to the ledger.",
  },
  {
    term: "WaD — Without a Doubt",
    body: "The compliance and governance control: KYC, KYB, UBO, sanctions and PEP screening, plus authority to act. It costs 3 further tokens (USD 30) and must clear before Execution opens.",
  },
  {
    term: "Execution",
    body: "Entry, execution and exit, with project preparation running Concept, Pre-Feasibility, Feasibility, Bankability and Implementation.",
  },
  {
    term: "Finality",
    body: "The recorded end state of the transaction: its type, its evidence, any change or value event, and its validation and acceptance.",
  },
  {
    term: "Memory",
    body: "The transaction read forward from first bid to finality, and backward from finality to first bid. Sealed once finality is recorded.",
  },
  {
    term: "Seat",
    body: "The capacity a person acts in: party, counterparty or administrator. Seats determine what is visible and what can be recorded.",
  },
];

function Glossary() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="label-caps">Reference</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Terms & Glossary</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The words below mean exactly one thing inside Izenzo. Where a term is a gate, the gate is
          enforced on the server, not in the interface.
        </p>
        <dl className="mt-10 divide-y divide-border border-y border-border">
          {TERMS.map((t) => (
            <div key={t.term} className="grid gap-2 py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
              <dt className="text-sm font-semibold">{t.term}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{t.body}</dd>
            </div>
          ))}
        </dl>
      </main>
      <SiteFooter />
    </div>
  );
}
