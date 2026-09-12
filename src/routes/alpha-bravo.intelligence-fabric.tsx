import { createFileRoute } from "@tanstack/react-router";
import { Search, Sparkles, Radio, Gauge } from "lucide-react";
import { SubmitBidButton } from "@/components/marketing/SubmitBidButton";

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
