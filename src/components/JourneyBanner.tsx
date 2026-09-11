import { ArrowRight } from "lucide-react";

// The 5-stage journey banner — same stage grouping the workflow itself uses (Trading /
// Compliance & Governance / Execution / Finality / Memory), narrated for a first-time visitor.
const JOURNEY = [
  {
    step: 1,
    title: "Trading",
    tag: "Find. Match. Structure.",
    body: "Source opportunities, match parties, and capture the opportunity.",
  },
  {
    step: 2,
    title: "Compliance & Governance",
    tag: "Verify. Assess. Authorise.",
    body: "Complete KYC/KYB, assess risk, and verify evidence.",
  },
  {
    step: 3,
    title: "Execution",
    tag: "Plan. Implement. Deliver.",
    body: "Turn approved opportunities into executable projects.",
  },
  {
    step: 4,
    title: "Finality",
    tag: "Settle. Complete.",
    body: "Finalise contracts, process payment, and close the transaction.",
  },
  {
    step: 5,
    title: "Memory",
    tag: "Record. Learn. Scale.",
    body: "Store verified outcomes and reuse intelligence for future opportunities.",
  },
];

export function JourneyBanner() {
  return (
    <div>
      <h2 className="text-center text-xl font-semibold tracking-tight sm:text-2xl">
        The Journey to Governance
      </h2>
      <p className="mt-1 text-center text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        A single, integrated flow from opportunity to verified, executed and enduring outcomes.
      </p>
      {/* Boxes share one flex basis so all five come out exactly the same width; items-stretch on
       * the row makes them the same height too. The arrows sit in their own fixed-width cells
       * between them (rotated to point down when stacked). */}
      <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:gap-0">
        {JOURNEY.map((j, i) => (
          <div key={j.step} className="contents">
            <div className="glass-node flex min-w-0 flex-1 basis-0 flex-col p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[13px] font-bold text-primary">
                  {j.step}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold leading-tight tracking-tight">{j.title}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{j.tag}</p>
                </div>
              </div>
              <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{j.body}</p>
            </div>
            {i < JOURNEY.length - 1 && (
              <div
                className="flex w-full shrink-0 items-center justify-center py-1 sm:w-9 sm:py-0"
                aria-hidden
              >
                <ArrowRight className="h-4 w-4 rotate-90 text-primary/70 sm:rotate-0" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
