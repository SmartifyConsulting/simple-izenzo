import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alpha-bravo/trades")({
  head: () => ({
    meta: [{ title: "Trades — Izenzo Alpha-Bravo" }],
  }),
  component: Trades,
});

type Stage = "Trading" | "Compliance" | "Execution" | "Finality";

const MATCHES: { name: string; sector: string; stage: Stage; status: string; body: string }[] = [
  { name: "Meridian Grain Co.", sector: "Agriculture", stage: "Trading", status: "Matched", body: "Agricultural commodities sourcing, West Africa corridor." },
  { name: "Solera Logistics", sector: "Logistics", stage: "Execution", status: "In progress", body: "Cross-border freight capacity, verified carrier network." },
  { name: "Northbridge Metals", sector: "Metals", stage: "Finality", status: "Settled", body: "Structured metals offtake, settled and closed." },
  { name: "Kalahari Energy", sector: "Energy", stage: "Compliance", status: "Under review", body: "Renewable power offtake, KYB and risk assessment in progress." },
  { name: "Fenwick Manufacturing", sector: "Manufacturing", stage: "Execution", status: "In progress", body: "Contract manufacturing capacity, multi-site verification." },
  { name: "Delta Cocoa Traders", sector: "Agriculture", stage: "Finality", status: "Settled", body: "Cocoa export contract, payment processed and closed." },
  { name: "Ridgeline Mining", sector: "Metals", stage: "Trading", status: "Matched", body: "Base metals supply agreement, counterparty discovery complete." },
  { name: "Coastal Freight Alliance", sector: "Logistics", stage: "Compliance", status: "Under review", body: "Port handling capacity, authority verification in progress." },
  { name: "Vantage Grid Partners", sector: "Energy", stage: "Trading", status: "Matched", body: "Grid infrastructure component sourcing, opportunity matched." },
  { name: "Highland Textiles", sector: "Manufacturing", stage: "Finality", status: "Settled", body: "Textile production run, contract finalised." },
  { name: "Baobab AgriTrade", sector: "Agriculture", stage: "Execution", status: "In progress", body: "Grain storage and distribution, implementation underway." },
  { name: "Sterling Alloys", sector: "Metals", stage: "Compliance", status: "Under review", body: "Specialty alloy supply, evidence review in progress." },
];

const STAGES: readonly ("All" | Stage)[] = ["All", "Trading", "Compliance", "Execution", "Finality"];

function Trades() {
  const [filter, setFilter] = useState<(typeof STAGES)[number]>("All");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = MATCHES.filter((m) => {
    if (filter !== "All" && m.stage !== filter) return false;
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.sector.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q)
    );
  });

  return (
    <section className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Trades
      </p>
      <h1 className="mt-3 max-w-2xl text-3xl tracking-tight text-foreground sm:text-4xl">
        Bidders and Responders we've matched.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Live and completed matches across Trading, Compliance, Execution and Finality.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search matches…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">No matches found for "{query}".</p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => (
          <div key={m.name} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
              {m.stage} · {m.status}
            </p>
            <h3 className="mt-1.5 text-sm font-medium tracking-tight text-foreground">{m.name}</h3>
            <p className="text-xs text-muted-foreground">{m.sector}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{m.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-border bg-card p-6 text-center">
        <h2 className="text-lg font-medium tracking-tight text-foreground">Want to be matched?</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Post an opportunity and get verified Responders.
        </p>
        <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-4 inline-block">
          <Button size="sm" className="rounded-full">
            Submit a Bid
          </Button>
        </Link>
      </div>
    </section>
  );
}
