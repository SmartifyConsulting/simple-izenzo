import { createFileRoute } from "@tanstack/react-router";
import { Compass, EyeOff, Wrench, ShieldCheck, UserCheck, Sparkles } from "lucide-react";
import { SubmitBidButton } from "@/components/marketing/SubmitBidButton";

export const Route = createFileRoute("/alpha-bravo/intelligence-fabric")({
  head: () => ({
    meta: [{ title: "The Intelligence Fabric — Izenzo Alpha-Bravo" }],
  }),
  component: IntelligenceFabric,
});

const TRANSFORMS = [
  {
    icon: Compass,
    title: "Predictive Matchmaking",
    body: "Instead of just searching for existing options, the system calculates what should exist—building invisible bridges between what you have and what you want to achieve.",
  },
  {
    icon: EyeOff,
    title: "Hidden-Opportunity Discovery",
    body: "It scans deep beneath surface-level data to spot quiet market signals, unlisted opportunities, and overlooked combinations that standard search tools miss entirely.",
  },
  {
    icon: Wrench,
    title: "Automated Structure Creation",
    body: "Rather than giving basic advice, the engine actively restructures the deal—adjusting terms, timing, and pathways automatically to make an impossible trade work.",
  },
  {
    icon: ShieldCheck,
    title: "Pre-Vetted Feasibility",
    body: "Every possibility is continuously tested against strict legal, financial, and logistical constraints before it ever reaches your screen.",
  },
  {
    icon: UserCheck,
    title: "Human-In-The-Loop Control",
    body: "The system generates pre-proven, optimal options, but nothing moves forward until you make the final choice.",
  },
];

const WHY_IT_MATTERS = [
  "You no longer have to settle for what is currently on the market—Izenzo uncovers the unseen choices that give you a competitive edge.",
  "It solves multi-variable deal roadblocks simultaneously, closing the distance between buyer and seller in a fraction of the time.",
  "You get creative, high-value deal structures without risking compliance, legal, or operational failure.",
];

function IntelligenceFabric() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/[0.04] to-transparent">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
          <div className="flex items-start justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> The Intelligence Fabric
            </span>
            <SubmitBidButton size="sm" className="hidden shrink-0 sm:inline-flex" />
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            The engine that finds what should be there—before you even hit search.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Izenzo AI+ is an advanced decision engine that works behind the scenes to create
            better choices before you make a commitment.
          </p>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            While traditional AI simply scans existing databases to show you what is already
            there, Izenzo AI+ looks beyond visible data to discover hidden possibilities,
            construct new trade paths, and automatically verify them for real-world execution.
          </p>
          <div className="mt-8 sm:hidden">
            <SubmitBidButton size="sm" />
          </div>
        </div>
      </section>

      {/* How it transforms decision-making, with Why It Matters as a sidebar */}
      <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          How it transforms decision-making
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl tracking-tight text-foreground sm:text-4xl">
          Five ways AI+ works before you ever make a call.
        </h2>

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-10">
            {TRANSFORMS.map((t) => (
              <div key={t.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                  <t.icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-medium tracking-tight text-foreground">
                    {t.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Why it matters
            </p>
            {WHY_IT_MATTERS.map((w) => (
              <blockquote key={w} className="border-l-2 border-primary/40 pl-4">
                <p className="text-sm italic leading-relaxed text-muted-foreground">"{w}"</p>
              </blockquote>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
