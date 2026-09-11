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

const PRINCIPLES = [
  {
    n: "01",
    title: "Hash-sealed by design",
    body: "Every match is independently verifiable — tamper-evident from the first handshake to final settlement.",
  },
  {
    n: "02",
    title: "A gate that can't be waived",
    body: "Compliance isn't a checkbox someone can skip under pressure. It clears, or the match doesn't proceed.",
  },
  {
    n: "03",
    title: "Counterparties who can prove it",
    body: "KYC/KYB isn't a formality — it's the difference between an introduction and a liability.",
  },
];

const THESIS = [
  {
    n: "01",
    title: "Matching is the opportunity",
    body: "The best outcomes come from pairing the right Bidder with the right Responder — not just the fastest one.",
  },
  {
    n: "02",
    title: "Verified, before capital moves",
    body: "Every match clears KYC/KYB and a non-waivable risk gate before a cent changes hands.",
  },
  {
    n: "03",
    title: "A record that compounds",
    body: "Every completed match becomes reusable intelligence for the next opportunity.",
  },
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
      <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
        Every match runs through the same five stages — no shortcuts, no skipped checks.
      </p>

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
          {PRINCIPLES.map((p) => (
            <div key={p.n}>
              <p className="text-sm font-semibold text-primary">{p.n}</p>
              <h3 className="mt-2 text-base font-medium tracking-tight text-foreground">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-14 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Every step is recorded and independently verifiable. Verification can't be skipped or
        waived — so speed never comes at the cost of certainty.
      </p>

      <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-8 inline-block">
        <Button size="lg" className="rounded-full">
          Submit a Bid
        </Button>
      </Link>

      <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        The thesis
      </p>
      <h2 className="mt-3 max-w-2xl text-2xl tracking-tight text-foreground sm:text-3xl">
        We back matches that hold up under scrutiny.
      </h2>
      <div className="mt-10 grid gap-8 sm:grid-cols-3">
        {THESIS.map((t) => (
          <div key={t.n}>
            <p className="text-sm font-semibold text-primary">{t.n}</p>
            <h3 className="mt-3 text-base font-medium tracking-tight text-foreground">
              {t.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
