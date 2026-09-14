import { createFileRoute, Link } from "@tanstack/react-router";
import { SubmitBidButton } from "@/components/marketing/SubmitBidButton";
import { INSIGHT_ARTICLES } from "@/lib/alphaBravoInsights";

export const Route = createFileRoute("/alpha-bravo/about/")({
  head: () => ({
    meta: [{ title: "About — Izenzo Alpha-Bravo" }],
  }),
  component: About,
});

function About() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            About Izenzo
          </p>
          <p className="mt-6 leading-relaxed text-muted-foreground">
            From initial search to final agreement, the platform builds a permanent, verified audit
            trail—giving you pre-vetted options so you can close trade deals faster with
            complete trust.{" "}
            <span className="font-medium text-foreground">
              You make the call; Izenzo makes it happen.
            </span>
          </p>

          <p className="mt-6 leading-relaxed text-muted-foreground">
            Behind that speed is <span className="font-medium text-foreground">Izenzo AI+</span>,
            our patented dual-model engine. While standard trade tools only search what's
            already visible on the market, AI+ looks beyond the status quo to predict hidden
            trade opportunities—automatically testing them for real-world viability, legality,
            and compliance in real time.{" "}
            <span className="font-medium text-foreground">
              Standard AI just finds data; Izenzo AI+ proves it,
            </span>{" "}
            delivering fully actionable, compliant deals straight to your desk.
          </p>

          <p className="mt-10 text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">
            That's the difference.
          </p>

          <div className="mt-10">
            <SubmitBidButton size="lg" />
          </div>
        </div>

        <div className="space-y-6 lg:pl-8 lg:pt-[165px]">
          {INSIGHT_ARTICLES.map((a) => (
            <Link key={a.slug} to="/alpha-bravo/about/$slug" params={{ slug: a.slug }} className="block group">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {a.date}
              </p>
              <h3 className="mt-1 text-sm font-medium italic leading-snug text-foreground group-hover:text-primary">
                "{a.title}"
              </h3>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
