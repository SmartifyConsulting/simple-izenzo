import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const Route = createFileRoute("/walkthrough")({
  head: () => ({
    meta: [{ title: "System Walkthrough — Izenzo" }],
  }),
  component: Walkthrough,
});

const PHASES = [
  {
    title: "Phase 1 — Entity Onboarding & Due Diligence (~2 min)",
    steps: [
      "Create buyer and seller organisations",
      "Register entities, UBO ownership, and ATB records",
      "Upload KYC documents",
      "Run sanctions/PEP screening",
      "Compute risk scores",
      "Complete approval workflow",
      "Issue Approved-to-Trade certification",
    ],
  },
  {
    title: "Phase 2 — Discovery & Matching (~1.5 min)",
    steps: [
      "Create buyer and seller signals",
      "Run match discovery",
      "Send invite",
      "Send trade request (1 credit burn at $10.00 USD/credit)",
    ],
  },
  {
    title: "Phase 3 — Intent Lifecycle & Collapse (~2 min)",
    steps: [
      "Run pre-flight checks",
      "Compute intent completion probability (must be ≥ 50.1%)",
      "Execute signed intent collapse",
    ],
  },
  {
    title: "Phase 4 — Evidence & Final Output (~1.5 min)",
    steps: [
      "Generate Evidence Pack v1",
      "Confirm Signed Deal with hard-gate validations",
      "Collect buyer + seller attestations",
      "Seal Signed Deal (hash chain)",
      "Export certificate",
      "Export full audit log",
    ],
  },
];

const HARD_GATES = [
  "Signed Deal enforces screening freshness (≤ 30 days)",
  "Signed Deal rejects high/critical risk bands",
  "Governance credit burn is atomic",
  "Collapse requires POI probability ≥ 50.1%",
];

const CHECKLIST = [
  "Screening is clear and within 30 days for both parties",
  "Risk band is not high/critical for both parties",
  "Both parties are Approved to Trade",
  "Intent completion probability is ≥ 50.1%",
  "Collapse ledger entry created and hash-recorded",
  "Signed Deal sealed with attestations",
  "Evidence Pack export generated",
  "Audit trail export contains lifecycle events across the recorded workflow",
];

function Walkthrough() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="label-caps text-primary">System-level walkthrough</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Complete End-to-End Happy Path (5 to 8 min)
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Goal: prove the platform works as one integrated system — from onboarding to
          verification to evidence-backed output.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-4 rounded-xl border border-border bg-muted/40 p-5 text-center text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="mt-1 font-semibold">5 to 8 min</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Steps</p>
            <p className="mt-1 font-semibold">19</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outcome</p>
            <p className="mt-1 font-semibold">Sealed Deal + Evidence Pack</p>
          </div>
        </div>

        <div className="mt-10 space-y-8">
          {PHASES.map((phase) => (
            <div key={phase.title}>
              <h2 className="text-sm font-semibold">{phase.title}</h2>
              <ol className="mt-3 space-y-2">
                {phase.steps.map((s, i) => (
                  <li key={s} className="flex items-start gap-3 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-sm font-semibold">Hard-gates confirmed in this walkthrough</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {HARD_GATES.map((g) => (
            <li key={g}>• {g}</li>
          ))}
        </ul>

        <h2 className="mt-10 text-sm font-semibold">Verification checklist</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {CHECKLIST.map((c) => (
            <li key={c}>☐ {c}</li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
