import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Sparkles, Radio, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/alpha-bravo/intelligence-fabric")({
  head: () => ({
    meta: [{ title: "The Intelligence Fabric — Izenzo Alpha-Bravo" }],
  }),
  component: IntelligenceFabric,
});

const LAYERS = [
  {
    icon: Search,
    title: "Search",
    body: "Runs a structured search for possible counterparties against Izenzo's network — the first pass, before any AI reasoning is applied.",
  },
  {
    icon: Sparkles,
    title: "AI",
    body: "Reads the record and proposes matches. It never decides — every proposal is surfaced for a person to review, not auto-executed.",
  },
  {
    icon: Gauge,
    title: "AI+",
    body: "Deeper analysis on the shortlist: risk signals, pricing sanity checks, and jurisdiction notes — context a person needs to choose well, not just quickly.",
  },
  {
    icon: Radio,
    title: "Online Media Screening",
    body: "Scans LinkedIn, Facebook, TikTok, marketplaces and news for each shortlisted counterparty, plus a Social/News Media scan on the deal itself — required before a Proof of Intent can be sealed.",
  },
];

const PRINCIPLES = [
  {
    n: "01",
    title: "AI proposes, a person chooses",
    body: "The Choice step is always a human action, recorded as an event. AI narrows the field — it doesn't pick the counterparty.",
  },
  {
    n: "02",
    title: "Every score has a rationale",
    body: "Counterparty ratings (trusted, neutral, flagged) come with a computed score and a written rationale, not a black-box number.",
  },
  {
    n: "03",
    title: "Screening compounds, it doesn't reset",
    body: "A counterparty's rating and screening history carry across the matches they're surfaced in, so the same background work isn't repeated from zero every time.",
  },
];

function IntelligenceFabric() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          The Intelligence Fabric
        </p>
        <Link to="/auth" search={{ mode: "signup", next: undefined }} className="shrink-0">
          <Button size="sm" className="rounded-full">
            Submit a Bid
          </Button>
        </Link>
      </div>
      <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-foreground sm:text-5xl">
        The layers that find your match, before you ever see a name.
      </h1>
      <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
        Every opportunity runs through the same four layers inside the Trading Gate — search,
        AI, deeper AI analysis, and background screening — before a shortlist ever reaches you.
      </p>

      <div className="mt-16 grid gap-8 sm:grid-cols-2">
        {LAYERS.map((l) => (
          <div key={l.title}>
            <l.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-base font-medium tracking-tight text-foreground">
              {l.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{l.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        How it stays accountable
      </p>
      <h2 className="mt-3 max-w-2xl text-2xl tracking-tight text-foreground sm:text-3xl">
        Intelligence that assists — it doesn't decide.
      </h2>
      <div className="mt-10 grid gap-10 sm:grid-cols-3">
        {PRINCIPLES.map((p) => (
          <div key={p.n}>
            <p className="text-sm font-semibold text-primary">{p.n}</p>
            <h3 className="mt-3 text-lg font-medium tracking-tight text-foreground">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
