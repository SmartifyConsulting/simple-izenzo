import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/alpha-bravo/insights")({
  head: () => ({
    meta: [{ title: "Insights — Izenzo Alpha-Bravo" }],
  }),
  component: Insights,
});

const ARTICLES = [
  {
    date: "September 2026",
    title: "Why the Compliance Gate Can't Be a Checkbox",
    body: "A non-waivable gate only means something if it's actually non-waivable. What that looks like in practice, and why most platforms fake it.",
  },
  {
    date: "August 2026",
    title: "Matching Is a Trust Problem Before It's a Trading Problem",
    body: "Speed doesn't fix a bad match. Notes on why we verify before we introduce, not after.",
  },
  {
    date: "July 2026",
    title: "What a Hash-Sealed Record Actually Buys You",
    body: "Tamper-evident isn't a buzzword — it's a specific set of guarantees. Here's what they are and what they aren't.",
  },
  {
    date: "June 2026",
    title: "Anatomy of a Match That Falls Apart at Finality",
    body: "Most failed matches don't fail at introduction — they fail at settlement. A look at where the real risk hides.",
  },
  {
    date: "May 2026",
    title: "The Cost of Re-verifying the Same Counterparty Twice",
    body: "Every re-verification is friction someone pays for. Why a shared, portable verification record changes the economics.",
  },
  {
    date: "April 2026",
    title: "Why We Built Memory as a Stage, Not a Log",
    body: "A completed match that teaches you nothing is a wasted match. How the Memory stage turns outcomes into reusable intelligence.",
  },
];

function Insights() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-5 py-20 sm:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Writing
        </p>
        <h1 className="mt-4 text-4xl tracking-tight text-foreground sm:text-5xl">
          Notes on matching, governance, and trust at scale.
        </h1>
        <p className="mt-6 leading-relaxed text-muted-foreground">
          Essays on what makes a Bidder-Responder match hold up once money moves.
        </p>

        <div className="mt-12 divide-y divide-border border-t border-border">
          {ARTICLES.map((a) => (
            <article key={a.title} className="py-6">
              <p className="text-xs font-medium text-muted-foreground">{a.date}</p>
              <h2 className="mt-2 text-lg font-medium tracking-tight text-foreground">{a.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
