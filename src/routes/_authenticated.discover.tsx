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
import { discoverCounterpartiesByQuery, checkCandidateProducts } from "@/lib/izenzo.functions";

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
  source: "registry" | "ai" | "ai_plus" | "web";
  matchPct?: number | undefined;
  url?: string | undefined;
};

type ProductCheck = { matchScore: number; matchedTerms: string[]; loading?: boolean };

/** Only worth checking a handful of sites per search — each is a live scrape. */
const MAX_PRODUCT_CHECKS = 6;

function Discover() {
  const [role, setRole] = useState<Party>("buyer");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [aiResults, setAiResults] = useState<Result[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [productChecks, setProductChecks] = useState<Record<string, ProductCheck>>({});

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
    setAiLoading(true);
    setAiResults(null);
    setAiError(null);
    try {
      const [ai, aiPlus, web] = await Promise.allSettled([
        discoverCounterpartiesByQuery({ data: { query: trimmed, role, kind: "ai" } }),
        discoverCounterpartiesByQuery({ data: { query: trimmed, role, kind: "ai_plus" } }),
        supabase.functions.invoke("counterparty-discovery", { body: { query: trimmed, role } }),
      ]);

      const collected: Result[] = [];
      if (ai.status === "fulfilled") {
        collected.push(
          ...ai.value.candidates.map((c, i) => ({
            id: `ai-${i}-${c.name}`,
            name: c.name,
            detail: [c.jurisdiction, c.sector].filter(Boolean).join(" · "),
            source: "ai" as const,
            matchPct: c.score,
          })),
        );
      }
      if (aiPlus.status === "fulfilled") {
        collected.push(
          ...aiPlus.value.candidates.map((c, i) => ({
            id: `ai-plus-${i}-${c.name}`,
            name: c.name,
            detail: [c.jurisdiction, c.sector].filter(Boolean).join(" · "),
            source: "ai_plus" as const,
            matchPct: c.score,
          })),
        );
      }
      if (web.status === "fulfilled" && !web.value.error) {
        collected.push(...((web.value.data?.results ?? []) as Result[]));
      }

      if (ai.status === "rejected" && aiPlus.status === "rejected") {
        setAiError((ai.reason as Error)?.message ?? "AI discovery is unavailable right now.");
      }

      setAiResults(collected);
      setProductChecks({});
      runProductChecks(collected, trimmed);
    } finally {
      setAiLoading(false);
    }
  }

  /** Fires after results land: for a capped set of results with a real website, fetch the site
   * and score how well it matches the search — runs in the background, each result updates as its
   * check finishes rather than blocking the whole list. */
  function runProductChecks(candidates: Result[], query: string) {
    const withUrl = candidates.filter((c) => c.url).slice(0, MAX_PRODUCT_CHECKS);
    for (const c of withUrl) {
      setProductChecks((prev) => ({ ...prev, [c.id]: { matchScore: 0, matchedTerms: [], loading: true } }));
      checkCandidateProducts({ data: { url: c.url!, query } })
        .then((r) => {
          setProductChecks((prev) => ({
            ...prev,
            [c.id]: { matchScore: r.matchScore, matchedTerms: r.matchedTerms ?? [] },
          }));
        })
        .catch(() => {
          setProductChecks((prev) => {
            const next = { ...prev };
            delete next[c.id];
            return next;
          });
        });
    }
  }

  const results = [...dbResults, ...(aiResults ?? [])];

  return (
    <AppShell
      title="Discover Counterparties"
      description="Search counterparties and company-register records in one place, then propose reviewed links where the data overlaps."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        <div className="rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-20">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Search className="h-4 w-4 text-primary" /> Find Counterparties + Company Register
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            One search checks counterparties and the company register together, then asks AI and AI+ to
            propose further candidates.
          </p>

          <div className="mt-4 grid grid-cols-1 overflow-hidden rounded-lg border border-border text-sm">
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

          <div className="mt-3 flex flex-col gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
              placeholder="Search counterparties and registered companies"
            />
            <Button onClick={() => runSearch(query)} disabled={isFetching || aiLoading} className="w-full gap-2">
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

        <div className="min-w-0">
          {!submittedQuery && (
            <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Results will appear here once you search.
            </div>
          )}

          {submittedQuery && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Searching:</span>
                <span className="font-medium text-foreground">{submittedQuery}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-primary">
                  {role}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-6 text-sm">
                <Stat label="Registry" value={dbResults.length} />
                <Stat
                  label="AI Discovery"
                  value={aiResults?.length ?? 0}
                  icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
                />
                <Stat label="Total" value={results.length} />
              </div>

              <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {(isFetching || aiLoading) && (
                  <p className="p-6 text-sm text-muted-foreground">Searching — asking AI and AI+…</p>
                )}
                {!isFetching && !aiLoading && results.length === 0 && (
                  <p className="p-6 text-sm text-muted-foreground">No matches yet — try a different search.</p>
                )}
                {results.map((r) => (
                  <div key={`${r.source}-${r.id}`} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {r.name}
                        {r.source === "ai" && (
                          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Sparkles className="h-2.5 w-2.5" /> AI
                          </span>
                        )}
                        {r.source === "ai_plus" && (
                          <span className="flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Sparkles className="h-2.5 w-2.5" /> AI+
                          </span>
                        )}
                        {r.source === "web" && (
                          <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Web discovered
                          </span>
                        )}
                        {productChecks[r.id]?.loading && (
                          <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Checking site…
                          </span>
                        )}
                        {productChecks[r.id] && !productChecks[r.id]!.loading && (
                          <span
                            className={cn(
                              "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              productChecks[r.id]!.matchScore >= 30
                                ? "bg-emerald-500/15 text-emerald-600"
                                : "bg-muted text-muted-foreground",
                            )}
                            title={
                              productChecks[r.id]!.matchedTerms.length > 0
                                ? `Matched: ${productChecks[r.id]!.matchedTerms.join(", ")}`
                                : "No matching terms found on their site"
                            }
                          >
                            {productChecks[r.id]!.matchScore}% product match
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

              {aiError && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" /> {aiError} Registry results still show above.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
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
