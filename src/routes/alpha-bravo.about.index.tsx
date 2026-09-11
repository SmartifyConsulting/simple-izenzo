import { createFileRoute, Link } from "@tanstack/react-router";
import { INSIGHT_ARTICLES } from "@/lib/alphaBravoInsights";

export const Route = createFileRoute("/alpha-bravo/about/")({
  head: () => ({
    meta: [{ title: "About — Izenzo Alpha-Bravo" }],
  }),
  component: About,
});

function About() {
  return (
    <section className="mx-auto max-w-2xl px-5 py-20 sm:py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        About Izenzo
      </p>
      <h1 className="mt-6 text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
        Izenzo means "actions" in isiZulu.
      </h1>
      <p className="mt-6 leading-relaxed text-muted-foreground">
        Because intent is only the beginning. We follow through.
      </p>

      <p className="mt-10 leading-relaxed text-foreground">
        We built Izenzo around a simple idea:{" "}
        <span className="font-medium">
          trade should be driven by what should be there — not just what already is.
        </span>
      </p>

      <p className="mt-6 leading-relaxed text-muted-foreground">
        Most platforms search what exists. <span className="text-foreground">Izenzo looks
        for what should exist.</span>
      </p>

      <p className="mt-6 leading-relaxed text-muted-foreground">
        At its core is <span className="font-medium text-foreground">AI+</span>, our patented
        algorithm developed by Izenzo. Every search runs two models in parallel:{" "}
        <span className="text-foreground">
          AI finds what is there; AI+ looks beyond it — identifying the counterparty, structure
          or opportunity that should be there, then testing whether it is real, plausible and
          compliant.
        </span>
      </p>

      <p className="mt-6 text-lg font-medium text-foreground">The models propose. You decide.</p>

      <p className="mt-6 leading-relaxed text-muted-foreground">
        From counterparty verification and compliance to execution and the permanent memory of
        what was proven, Izenzo closes the gap between "we agree" and "it's done."
      </p>

      <p className="mt-10 leading-relaxed text-muted-foreground">
        We don't make trade faster by cutting corners.
      </p>
      <p className="mt-2 text-lg font-medium text-foreground">
        We make it possible to move faster because the trust behind the trade can be proven.
      </p>

      <p className="mt-10 text-sm font-medium uppercase tracking-[0.1em] text-muted-foreground">
        That's the difference.
      </p>

      <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Writing
      </p>
      <h2 className="mt-3 text-2xl tracking-tight text-foreground sm:text-3xl">
        Notes on matching, governance, and trust at scale.
      </h2>
      <div className="mt-8 divide-y divide-border border-t border-border">
        {INSIGHT_ARTICLES.map((a) => (
          <Link
            key={a.slug}
            to="/alpha-bravo/about/$slug"
            params={{ slug: a.slug }}
            className="block py-6"
          >
            <article>
              <p className="text-xs font-medium text-muted-foreground">{a.date}</p>
              <h3 className="mt-2 text-lg font-medium tracking-tight text-foreground hover:underline">
                {a.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.teaser}</p>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
