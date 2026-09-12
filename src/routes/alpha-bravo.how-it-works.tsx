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
 * actually runs on (trading/compliance/execution/finality/memory), reworded for a marketing
 * audience so nothing exposes internal jargon like "gate", "WaD" or "tokens". */
const STAGE_COPY: Record<(typeof SPINE)[number]["key"], { title: string; body: string }> = {
  trading: {
    title: "Find, Match & Verify",
    body: "Post your opportunity, get matched with the right Responder, and see each candidate checked for identity, ownership, and sanctions/watchlist exposure before you choose. Verification can't be skipped.",
  },
  compliance: {
    title: "Engage",
    body: "Engage the party you've chosen, agree the terms, and sign off on what both sides have committed to — recorded as you go.",
  },
  execution: {
    title: "Deliver",
    body: "Turn the agreed match into a real project — plan it, resource it, and track who's involved as it happens.",
  },
  finality: {
    title: "Finalize",
    body: "Close it out: confirm what happened, record any changes, and get sign-off from everyone involved.",
  },
  memory: {
    title: "Remember",
    body: "Every completed match becomes a searchable record — so the next one goes faster.",
  },
};

const THESIS = [
  "The best outcomes come from pairing the right Bidder with the right Responder — not just the fastest one.",
  "Every match clears KYC/KYB and a non-waivable risk gate before a cent changes hands.",
  "Every completed match becomes reusable intelligence for the next opportunity.",
];

function HowItWorks() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        How it works
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-foreground sm:text-5xl">
        From opportunity to outcome, fully governed.
      </h1>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          Every match runs through the same five stages — no shortcuts, no skipped checks.
        </p>
        <SubmitBidButton size="sm" className="shrink-0" />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ol className="space-y-10">
          {SPINE.map((stage, i) => {
            const copy = STAGE_COPY[stage.key];
            return (
              <li key={stage.key} className="flex gap-5">
                <span className="text-sm font-semibold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="text-lg font-medium tracking-tight text-foreground">
                    {copy.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {copy.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="space-y-8 lg:border-l lg:border-border lg:pl-8">
          <p className="text-lg font-medium italic tracking-tight text-foreground">
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
