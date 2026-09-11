import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
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
    title: "Find & Match",
    body: "Post your opportunity, get matched with the right Responder, and agree the terms — with AI-assisted counterparty search and background checks along the way.",
  },
  compliance: {
    title: "Verify",
    body: "Every match clears identity, ownership, and sanctions/watchlist checks before anything is signed. This step can't be skipped.",
  },
  execution: {
    title: "Deliver",
    body: "Turn the agreed match into a real project — plan it, resource it, and track who's involved as it happens.",
  },
  finality: {
    title: "Settle",
    body: "Close it out: confirm what happened, record any changes, and get sign-off from everyone involved.",
  },
  memory: {
    title: "Remember",
    body: "Every completed match becomes a searchable record — so the next one goes faster.",
  },
};

function HowItWorks() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-5 py-20 sm:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          How it works
        </p>
        <h1 className="mt-4 text-4xl tracking-tight text-foreground sm:text-5xl">
          From opportunity to outcome, fully governed.
        </h1>
        <p className="mt-6 leading-relaxed text-muted-foreground">
          Every match runs through the same five stages — no shortcuts, no skipped checks.
        </p>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-16">
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

          <p className="mt-14 border-t border-border pt-8 text-sm leading-relaxed text-muted-foreground">
            Every step is recorded and independently verifiable. Verification can't be skipped
            or waived — so speed never comes at the cost of certainty.
          </p>

          <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-8 inline-block">
            <Button size="lg" className="rounded-full">
              Post an Opportunity
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
