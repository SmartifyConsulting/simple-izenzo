import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Sparkles, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [{ title: "Discover Counterparties — Izenzo" }],
  }),
  component: Discover,
});

const SUGGESTIONS = ["buyers for cashew in India", "copper cathode suppliers", "hemp fibre wholesalers South Africa"];

type Party = "buyer" | "seller";

type Result = {
  id: string;
  name: string;
  detail: string;
  source: "registry" | "web";
  matchPct?: number;
};

function Discover() {
  const [role, setRole] = useState<Party>("buyer");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [webResults, setWebResults] = useState<Result[] | null>(null);
  const [webLoading, setWebLoading] = useState(false);

  const { data: dbResults = [], isFetching } = useQuery({
    queryKey: ["discover-db", submittedQuery],
    enabled: submittedQuery.length > 0,
    queryFn: async () => {
      const like = `%${submittedQuery}%`;
      const [{ data: cps }, { data: rcs }] = await Promise.all([
        supabase.from("counterparties").select("*").or(`name.ilike.${like},sector.ilike.${like}`).limit(10),
        supabase
          .from("registry_companies")
          .select("*")
          .or(`legal_name.ilike.${like},sector.ilike.${like}`)
          .limit(10),
      ]);
      const fromCounterparties: Result[] = (cps ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        detail: [c.jurisdiction, c.sector].filter(Boolean).join(" · "),
        source: "registry",
        matchPct: c.score ?? undefined,
      }));
      const fromRegistry: Result[] = (rcs ?? []).map((r) => ({
        id: r.id,
        name: r.legal_name,
        detail: [r.country, r.sector].filter(Boolean).join(" · "),
        source: "registry",
      }));
      return [...fromCounterparties, ...fromRegistry];
    },
  });

  async function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSubmittedQuery(trimmed);
    setWebLoading(true);
    setWebResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("counterparty-discovery", {
        body: { query: trimmed, role },
      });
      if (error) throw error;
      setWebResults((data?.results ?? []) as Result[]);
    } catch {
      // Live web discovery isn't configured yet — registry results still show below.
      setWebResults([]);
    } finally {
      setWebLoading(false);
    }
  }

  const results = [...dbResults, ...(webResults ?? [])];

  return (
    <AppShell
      title="Discover Counterparties"
      description="Search counterparties and company-register records in one place, then propose reviewed links where the data overlaps."
    >
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4 text-primary" /> Find Counterparties + Company Register
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          One search checks counterparties and the company register together.
        </p>

        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-border text-sm">
          {(["buyer", "seller"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "py-2 text-center font-medium capitalize transition-colors",
                role === r ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {r === "buyer" ? "Buyer — looking to purchase" : "Seller — looking to supply"}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
            placeholder="Search counterparties and registered companies"
          />
          <Button onClick={() => runSearch(query)} disabled={isFetching || webLoading} className="gap-2">
            <Search className="h-4 w-4" /> Search
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Try:{" "}
          {SUGGESTIONS.map((s, i) => (
            <span key={s}>
              <button className="underline hover:text-foreground" onClick={() => { setQuery(s); runSearch(s); }}>
                "{s}"
              </button>
              {i < SUGGESTIONS.length - 1 ? "  " : ""}
            </span>
          ))}
        </p>
      </div>

      {submittedQuery && (
        <div className="mt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Searching:</span>
            <span className="font-medium text-foreground">{submittedQuery}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-primary">
              {role}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-6 text-sm">
            <Stat label="Registry" value={dbResults.length} />
            <Stat label="Web" value={webResults?.length ?? 0} icon={<Sparkles className="h-3.5 w-3.5" />} />
            <Stat label="Total" value={results.length} />
          </div>

          <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {(isFetching || webLoading) && (
              <p className="p-6 text-sm text-muted-foreground">Searching…</p>
            )}
            {!isFetching && !webLoading && results.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">No matches yet — try a different search.</p>
            )}
            {results.map((r) => (
              <div key={`${r.source}-${r.id}`} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {r.name}
                    {r.source === "web" && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Sparkles className="h-2.5 w-2.5" /> Web discovered
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.detail}
                    {r.matchPct != null ? ` · ${r.matchPct}% match` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={() => toast.success(`${r.name} shortlisted — open it from Facilitation to start a case.`)}
                >
                  Select
                </Button>
              </div>
            ))}
          </div>

          {webResults !== null && webResults.length === 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" /> Live web discovery isn't connected yet — showing registry
              results only.
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
