import { createFileRoute } from "@tanstack/react-router";
import { Search, Sparkles, Radio, Gauge } from "lucide-react";
import { SubmitBidButton } from "@/components/marketing/SubmitBidButton";

export const Route = createFileRoute("/alpha-bravo/intelligence-fabric")({
  head: () => ({
    meta: [{ title: "The Intelligence Fabric — Izenzo Alpha-Bravo" }],
  }),
  component: IntelligenceFabric,
});

const TRANSFORMS = [
  {
    title: "Predictive Matchmaking",
    body: "Instead of just searching for existing options, the system calculates what should exist—building invisible bridges between what you have and what you want to achieve.",
  },
  {
    title: "Hidden-Opportunity Discovery",
    body: "It scans deep beneath surface-level data to spot quiet market signals, unlisted opportunities, and overlooked combinations that standard search tools miss entirely.",
  },
  {
    title: "Automated Structure Creation",
    body: "Rather than giving basic advice, the engine actively restructures the deal—adjusting terms, timing, and pathways automatically to make an impossible trade work.",
  },
  {
    title: "Pre-Vetted Feasibility",
    body: "Every possibility is continuously tested against strict legal, financial, and logistical constraints before it ever reaches your screen.",
  },
  {
    title: "Human-In-The-Loop Control",
    body: "The system generates pre-proven, optimal options, but nothing moves forward until you make the final choice.",
  },
];

const WHY_IT_MATTERS = [
  {
    title: "Expands Your Options",
    body: "You no longer have to settle for what is currently on the market—Izenzo uncovers the unseen choices that give you a competitive edge.",
  },
  {
    title: "Removes Friction",
    body: "It solves multi-variable deal roadblocks simultaneously, closing the distance between buyer and seller in a fraction of the time.",
  },
  {
    title: "Guaranteed Execution",
    body: "You get creative, high-value deal structures without risking compliance, legal, or operational failure.",
  },
];

const LAYERS = [
  {
    icon: Search,
    title: "Search",
    body: "A structured first pass across Izenzo's network, before any AI reasoning.",
  },
  {
    icon: Sparkles,
    title: "AI",
    body: "Proposes matches for review. It never decides.",
  },
  {
    icon: Gauge,
    title: "AI+",
    body: "Deeper analysis on the shortlist: risk, pricing sanity, jurisdiction.",
  },
  {
    icon: Radio,
    title: "Online Media Screening",
    body: "Scans public media on each shortlisted counterparty before a Proof of Intent can seal.",
  },
];

function IntelligenceFabric() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          The Intelligence Fabric
        </p>
        <SubmitBidButton size="sm" className="shrink-0" />
      </div>
      <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-foreground sm:text-5xl">
        The layers that find your match, before you ever see a name.
      </h1>

      <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
        Izenzo AI+ is an advanced decision engine that works behind the scenes to create better
        choices before you make a commitment.
      </p>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
        While traditional AI simply scans existing databases to show you what is already there,
        Izenzo AI+ looks beyond visible data to discover hidden possibilities, construct new
        trade paths, and automatically verify them for real-world execution.
      </p>

      <h2 className="mt-16 text-2xl tracking-tight text-foreground">
        How It Transforms Decision-Making
      </h2>
      <ul className="mt-8 max-w-2xl space-y-5">
        {TRANSFORMS.map((t) => (
          <li key={t.title} className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{t.title}:</span> {t.body}
          </li>
        ))}
      </ul>

      <h2 className="mt-16 text-2xl tracking-tight text-foreground">Why It Matters</h2>
      <ul className="mt-8 max-w-2xl space-y-5">
        {WHY_IT_MATTERS.map((w) => (
          <li key={w.title} className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{w.title}:</span> {w.body}
          </li>
        ))}
      </ul>

      <p className="mt-16 max-w-2xl leading-relaxed text-muted-foreground">
        Four layers run on every opportunity before a shortlist reaches you.
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
    </section>
  );
}
