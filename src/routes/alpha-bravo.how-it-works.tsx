import { createFileRoute } from "@tanstack/react-router";
import { SubmitBidButton } from "@/components/marketing/SubmitBidButton";
import { SPINE } from "@/lib/spine";

export const Route = createFileRoute("/alpha-bravo/how-it-works")({
  head: () => ({
    meta: [{ title: "How It Works — Izenzo Alpha-Bravo" }],
  }),
  component: HowItWorks,
});

/** Plain-language labels and blurbs for each real SPINE stage — same five stages the product
 * actually runs on (trading/compliance/execution/finality/memory). `heading` matches the home
 * page's five-stage frames exactly (Trading, Compliance & Governance, …); `tag` is the same
 * short tagline shown there too, just above the fuller body copy. */
const STAGE_COPY: Record<(typeof SPINE)[number]["key"], { heading: string; tag: string; body: string }> = {
  trading: {
    heading: "Trading",
    tag: "Find. Match. Structure.",
    body: "Source opportunities, load deal documents, search with AI/AI+, discover counterparties, make a choice, and record a Proof of Intent (POI) or generate a Preliminary Information Memorandum / Intent (PRI). The process relies on AI to surface optionality and AI+ to establish a probability framework for both the deal and counterparty, even dynamically handling counteroffers by reloading updated deal parameters to regenerate the PRI.",
  },
  compliance: {
    heading: "Compliance & Governance",
    tag: "Verify. Assess. Authorise.",
    body: "Run Non-Waivable Hardgate (WaD), complete KYC/KYB, confirm authority, and review supporting evidence. This step seamlessly integrates a dedicated document repository where required business documents are automatically surfaced and managed by AI agents.",
  },
  execution: {
    heading: "Execution",
    tag: "Plan. Implement. Deliver.",
    body: "Move through project preparation—from concept, pre-feasibility, and feasibility through to bankability—and advance directly into implementation and execution. Critically positioned between bankability and implementation is a strategic Investor Entry/Exit Point, allowing primary or third parties to optimize value when the project asset reaches peak growth potential.",
  },
  finality: {
    heading: "Finality",
    tag: "Settle. Complete.",
    body: "Finalise contracts, process payment, and complete the transaction. Unlike purely automated steps, this phase intentionally mandates human validation, such as uploading proof of payment, to formally finalize the deal.",
  },
  memory: {
    heading: "Memory",
    tag: "Record. Learn. Scale.",
    body: "Store a verified record, capture insights, and reuse intelligence for future opportunities. The step loops back as a circular compounding memory that continuously feeds data back into the system to guide capital deployment assessments via AI agents and AI+ logic.",
  },
};

const THESIS = [
  "The best outcomes come from pairing the right Bidder with the right Responder — not just the fastest one.",
  "Every match clears KYC/KYB and a non-waivable risk gate before a cent changes hands.",
  "Every completed match becomes reusable intelligence for the next opportunity.",
];

function HowItWorks() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-12 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        How it works
      </p>
      <h1 className="mt-3 max-w-2xl text-3xl tracking-tight text-foreground sm:text-4xl">
        From opportunity to outcome, fully governed.
      </h1>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          Every match runs through the same five stages — no shortcuts, no skipped checks.
        </p>
        <SubmitBidButton size="sm" className="shrink-0" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ol className="space-y-4">
          {SPINE.map((stage, i) => {
            const copy = STAGE_COPY[stage.key];
            return (
              <li
                key={stage.key}
                className="flex animate-in fade-in slide-in-from-left-6 gap-4 fill-mode-both duration-700"
                style={{ animationDelay: `${i * 300}ms` }}
              >
                <span className="text-sm font-semibold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="text-base font-medium tracking-tight text-foreground">
                    {copy.heading}
                  </h2>
                  <p className="text-xs font-medium text-primary">{copy.tag}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {copy.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="space-y-5 lg:border-l lg:border-border lg:pl-8">
          <p className="text-base font-medium italic tracking-tight text-foreground">
            "We back matches that hold up under scrutiny."
          </p>
          {THESIS.map((t) => (
            <blockquote key={t} className="border-l-2 border-primary/40 pl-4">
              <p className="text-sm italic leading-relaxed text-muted-foreground">"{t}"</p>
            </blockquote>
          ))}

          <p className="text-sm leading-relaxed text-muted-foreground">
            Every step is recorded and independently verifiable. Verification can't be skipped or
            waived — so speed never comes at the cost of certainty.
          </p>
        </div>
      </div>
    </section>
  );
}
