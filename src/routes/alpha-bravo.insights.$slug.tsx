import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { findInsightArticle, INSIGHT_ARTICLES } from "@/lib/alphaBravoInsights";

export const Route = createFileRoute("/alpha-bravo/insights/$slug")({
  loader: ({ params }) => {
    const article = findInsightArticle(params.slug);
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.title} — Izenzo Alpha-Bravo` }] : [],
  }),
  component: InsightArticlePage,
});

function InsightArticlePage() {
  const article = Route.useLoaderData();
  const more = INSIGHT_ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <>
      <section className="mx-auto max-w-2xl px-5 py-20 sm:py-24">
        <Link
          to="/alpha-bravo/insights"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Writing
        </Link>

        <p className="mt-8 text-xs font-medium text-muted-foreground">{article.date}</p>
        <h1 className="mt-2 text-3xl tracking-tight text-foreground sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{article.teaser}</p>

        <div className="mt-10 space-y-5 border-t border-border pt-10">
          {article.body.map((p, i) => (
            <p key={i} className="leading-relaxed text-foreground">
              {p}
            </p>
          ))}
        </div>
      </section>

      {more.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-2xl px-5 py-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              More writing
            </p>
            <div className="mt-6 divide-y divide-border border-t border-border">
              {more.map((a) => (
                <Link
                  key={a.slug}
                  to="/alpha-bravo/insights/$slug"
                  params={{ slug: a.slug }}
                  className="block py-5"
                >
                  <p className="text-xs font-medium text-muted-foreground">{a.date}</p>
                  <h2 className="mt-1.5 text-base font-medium tracking-tight text-foreground hover:underline">
                    {a.title}
                  </h2>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
