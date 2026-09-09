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
      <h2 className="text-center text-xl font-semibold tracking-tight sm:text-2xl">
        The Journey to Governance
      </h2>
      <p className="mt-1 text-center text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        A single, integrated flow from opportunity to verified, executed and enduring outcomes.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-5 sm:gap-2">
        {JOURNEY.map((j, i) => (
          <div key={j.step} className="flex items-stretch gap-2">
            <div className="glass-node flex-1 p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                  {j.step}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold tracking-tight">{j.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{j.tag}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{j.body}</p>
            </div>
            {i < JOURNEY.length - 1 && (
              <div className="hidden shrink-0 items-center text-muted-foreground/40 sm:flex" aria-hidden>
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
