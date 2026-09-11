import { createFileRoute, Link } from "@tanstack/react-router";
import { INSIGHT_ARTICLES } from "@/lib/alphaBravoInsights";

export const Route = createFileRoute("/alpha-bravo/insights/")({
  head: () => ({
    meta: [{ title: "Insights — Izenzo Alpha-Bravo" }],
  }),
  component: Insights,
});

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
          {INSIGHT_ARTICLES.map((a) => (
            <Link
              key={a.slug}
              to="/alpha-bravo/insights/$slug"
              params={{ slug: a.slug }}
              className="block py-6"
            >
              <article>
                <p className="text-xs font-medium text-muted-foreground">{a.date}</p>
                <h2 className="mt-2 text-lg font-medium tracking-tight text-foreground hover:underline">
                  {a.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.teaser}</p>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
