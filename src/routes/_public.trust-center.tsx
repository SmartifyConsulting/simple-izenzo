import { createFileRoute } from "@tanstack/react-router";
import { Hash, ShieldCheck, Landmark, Radio } from "lucide-react";
import { WAD_COST } from "@/lib/spine";

export const Route = createFileRoute("/alpha-bravo/trust-center")({
  head: () => ({
    meta: [{ title: "Trust Center — Izenzo" }],
  }),
  component: TrustCenter,
});

const PILLARS = [
  {
    icon: Hash,
    title: "Hash-sealed, tamper-evident",
    body: "Critical transitions — the bid terms, the Proof of Intent, WaD clearance, the Finality record — are sealed with a SHA-256 hash of their state. Anyone holding the original hash can detect if the underlying record changed after the fact.",
  },
  {
    icon: ShieldCheck,
    title: "A compliance gate that can't be waived",
    body: `Every match runs a WaD case — identity, ownership (UBO), sanctions and PEP screening — before it can leave the Compliance Gate. There is no admin override that skips this; it costs ${WAD_COST} tokens and clears, or the match doesn't proceed to Execution.`,
  },
  {
    icon: Radio,
    title: "Background screening before sealing",
    body: "A Proof of Intent can't be sealed until the transaction has run its Social & News Media scan — LinkedIn, Facebook, TikTok, marketplaces and news, screened for signals on the deal and its parties.",
  },
  {
    icon: Landmark,
    title: "Counterparty ratings, not blind trust",
    body: "Counterparties are rated trusted, neutral, or flagged, with a computed score and a written rationale — visible across the matches they're surfaced in, not locked to one transaction.",
  },
];

const AUDIT_LOG = [
  {
    label: "Every stage transition is an event",
    body: "Bid/Offer, Proof of Intent, WaD clearance, Execution milestones, Finality, and Memory are each recorded as a transaction_event — actor, timestamp, and stage/step — building an append-only audit trail per transaction.",
  },
  {
    label: "Nothing skips the sequence",
    body: "A transaction cannot jump from Trading into Execution, Finality, or Memory without a sealed Proof of Intent and a completed WaD case first — enforced by the state machine itself, not by process convention.",
  },
];

function TrustCenter() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Trust Center
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-foreground sm:text-5xl">
        What actually backs a match on Izenzo.
      </h1>
      <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
        Not marketing claims — the specific mechanisms every match runs through, and what they
        do and don't guarantee.
      </p>

      <div className="mt-16 grid gap-8 sm:grid-cols-2">
        {PILLARS.map((p) => (
          <div key={p.title}>
            <p.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-base font-medium tracking-tight text-foreground">
              {p.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        The audit trail
      </p>
      <h2 className="mt-3 max-w-2xl text-2xl tracking-tight text-foreground sm:text-3xl">
        Every step recorded, in order, with no way around it.
      </h2>
      <div className="mt-8 divide-y divide-border border-t border-border">
        {AUDIT_LOG.map((a) => (
          <div key={a.label} className="py-5">
            <p className="text-sm font-medium text-foreground">{a.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-16 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Questions about a specific match, screening result, or record?{" "}
        <a href="mailto:support@izenzo.co.za" className="font-medium text-primary hover:underline">
          Contact support
        </a>
        .
      </p>
    </section>
  );
}
