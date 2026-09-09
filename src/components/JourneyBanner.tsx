import { ArrowRight } from "lucide-react";

// The 5-stage journey banner — same stage grouping the workflow itself uses (Trading /
// Compliance & Governance / Execution / Finality / Memory), narrated for a first-time visitor.
const JOURNEY = [
  {
    step: 1,
    title: "Trading",
    tag: "Find. Match. Structure.",
    body: "Source opportunities, load deal documents, search with AI/AI+, discover counterparties, make a choice and record a Proof of Intent (POI).",
  },
  {
    step: 2,
    title: "Compliance & Governance",
    tag: "Verify. Assess. Authorise.",
    body: "Run WaD (non-waivable hard gate), complete KYC/KYB, confirm authority and review supporting evidence.",
  },
  {
    step: 3,
    title: "Execution",
    tag: "Plan. Implement. Deliver.",
    body: "Move through project preparation (concept, pre-feasibility, feasibility, bankability) to implementation and execution.",
  },
  {
    step: 4,
    title: "Finality",
    tag: "Settle. Complete.",
    body: "Finalise contracts, process payment and complete the transaction.",
  },
  {
    step: 5,
    title: "Memory",
    tag: "Record. Learn. Scale.",
    body: "Store a verified record, capture insights and reuse intelligence for future opportunities.",
  },
];

export function JourneyBanner() {
  return (
    <div>
      <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
        The Journey to Governance
      </h2>
      <p className="mt-2 text-center text-sm uppercase tracking-[0.12em] text-muted-foreground">
        A single, integrated flow from opportunity to verified, executed and enduring outcomes.
      </p>
      {/* Boxes share one flex basis so all five come out exactly the same width; items-stretch on
       * the row makes them the same height too. The arrows sit in their own fixed-width cells
       * between them (rotated to point down when stacked). */}
      <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:gap-0">
        {JOURNEY.map((j, i) => (
          <div key={j.step} className="contents">
            <div className="glass-node flex min-w-0 flex-1 basis-0 flex-col p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {j.step}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold tracking-tight">{j.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{j.tag}</p>
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{j.body}</p>
            </div>
            {i < JOURNEY.length - 1 && (
              <div
                className="flex w-full shrink-0 items-center justify-center py-1 sm:w-12 sm:py-0"
                aria-hidden
              >
                <ArrowRight className="h-5 w-5 rotate-90 text-primary/70 sm:rotate-0" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
