import { useState } from "react";
import { isRelevant } from "@/lib/relevance";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search, Users, Package, Plus, Check, X, Sparkles, Globe, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { discoverCounterpartiesByQuery, checkCandidateProducts } from "@/lib/izenzo.functions";
import { useScreenList, type ScreenListItem } from "@/lib/screenList";
import { useRecentDeals } from "@/lib/recentDeals";
import { useAuth } from "@/lib/auth";
import { fallbackReference, type Transaction } from "@/lib/tx";
import { cn } from "@/lib/utils";

/** Search for traders (registry companies and known counterparties) or items to trade, ask AI and
 * AI+ to propose further counterparties, and check candidate websites live through Firecrawl —
 * every match carries a closeness rating and can be added to a personal Screen List. */
type MatchSource = "records" | "ai" | "ai_plus" | "web";

type Match = ScreenListItem & {
  source: MatchSource;
  /** 0-100 closeness rating; higher is a closer match to the search. */
  closeness?: number | undefined;
  url?: string | undefined;
  note?: string | undefined;
};

type DealMatch = {
  id: string;
  reference: string;
  title: string;
  direction: "bid" | "offer" | null;
  stage: string;
  step: string;
};

/** Live site checks are real page fetches — only worth running for the top few candidates. */
const MAX_SITE_CHECKS = 4;

const SOURCE_LABEL: Record<MatchSource, string> = {
  records: "Our records",
  ai: "AI",
  ai_plus: "AI+",
  web: "Web · Firecrawl",
};

export function SearchButton() {
  const { org } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [deepQuery, setDeepQuery] = useState("");
  const [deepMatches, setDeepMatches] = useState<Match[]>([]);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepNote, setDeepNote] = useState<string | null>(null);
  const screenList = useScreenList();
  const recentDeals = useRecentDeals();

  // Every deal this account can see, with its opening direction — so a Bid/Offer ID (real or the
  // deterministic fallback shown for deals without a stored reference yet) can be matched entirely
  // client-side, without querying a `reference` column that may not exist on every environment
  // yet. Used to share the Trades list's own ["my-trades", org?.id] cache entry directly, but this
  // query's shape is much narrower (no created_at/updated_at, no joined bidder/counterparty
  // fields) — sharing one cache slot meant whichever query fetched last silently overwrote the
  // other's shape for every other subscriber, which is why the Trades screen would intermittently
  // render this component's stripped-down rows. Own key now, same ["my-trades"] prefix so it still
  // gets refreshed by the existing `invalidateQueries({ queryKey: ["my-trades"] })` calls.
  const { data: myDeals = [] } = useQuery({
    queryKey: ["my-trades", "search", org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, bid_offers(direction, created_at)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (
        (data ?? []) as unknown as (Transaction & {
          bid_offers: { direction: string; created_at: string }[];
        })[]
      ).map((t): DealMatch => {
        const earliest = [...t.bid_offers].sort(
          (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
        )[0];
        const direction: "bid" | "offer" = earliest?.direction === "offer" ? "offer" : "bid";
        return {
          id: t.id,
          reference: t.reference ?? fallbackReference(t.id, direction),
          title: t.title,
          direction,
          stage: t.stage,
          step: t.step,
        };
      });
    },
    staleTime: 60_000,
  });

  const dealMatches = (() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return myDeals
      .filter((d) => d.reference.toLowerCase().includes(q) || d.title.toLowerCase().includes(q))
      .slice(0, 8);
  })();

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", query],
    enabled: query.trim().length > 1,
    queryFn: async () => {
      const like = `%${query.trim()}%`;
      const [{ data: companies }, { data: counterparties }, { data: txs }] = await Promise.all([
        supabase.from("registry_companies").select("id, legal_name, country, sector").or(`legal_name.ilike.${like},sector.ilike.${like}`).limit(8),
        supabase.from("counterparties").select("id, name, jurisdiction, sector, score").or(`name.ilike.${like},sector.ilike.${like}`).limit(8),
        supabase.from("transactions").select("commodity").ilike("commodity", like).not("commodity", "is", null).limit(30),
      ]);

      const traders: Match[] = [
        ...(companies ?? []).map((c) => ({
          id: `company-${c.id}`,
          type: "trader" as const,
          name: c.legal_name,
          meta: [c.country, c.sector].filter(Boolean).join(" · "),
          source: "records" as const,
        })),
        ...(counterparties ?? []).map((c) => ({
          id: `counterparty-${c.id}`,
          type: "trader" as const,
          name: c.name,
          meta: [c.jurisdiction, c.sector].filter(Boolean).join(" · "),
          source: "records" as const,
          closeness: c.score ?? undefined,
        })),
      ];

      const seenItems = new Set<string>();
      const items: Match[] = [];
      for (const t of txs ?? []) {
        const name = t.commodity?.trim();
        if (!name || seenItems.has(name.toLowerCase())) continue;
        seenItems.add(name.toLowerCase());
        items.push({
          id: `item-${name.toLowerCase()}`,
          type: "item",
          name,
          meta: "Item to trade",
          source: "records",
        });
      }

      return { traders, items };
    },
  });

  /** Asks AI and AI+ for counterparty candidates and looks for further ones on the open web
   * (Firecrawl), then rates the closest of them by reading their site. */
  async function runDeepSearch() {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    setDeepQuery(trimmed);
    setDeepLoading(true);
    setDeepNote(null);
    setDeepMatches([]);
    try {
      const [ai, aiPlus, web] = await Promise.allSettled([
        discoverCounterpartiesByQuery({ data: { query: trimmed, role: "buyer", kind: "ai" } }),
        discoverCounterpartiesByQuery({ data: { query: trimmed, role: "buyer", kind: "ai_plus" } }),
        supabase.functions.invoke("counterparty-discovery", { body: { query: trimmed, role: "buyer" } }),
      ]);

      const collected: Match[] = [];
      const push = (source: MatchSource, list: { name: string; jurisdiction?: string | undefined; sector?: string | undefined; score?: number | undefined; url?: string | undefined }[]) => {
        for (const c of list) {
          if (!c.name) continue;
          collected.push({
            id: `${source}-${c.name.toLowerCase()}`,
            type: "trader",
            name: c.name,
            meta: [c.jurisdiction, c.sector].filter(Boolean).join(" · "),
            source,
            closeness: c.score,
            url: c.url,
          });
        }
      };

      if (ai.status === "fulfilled") push("ai", ai.value.candidates);
      if (aiPlus.status === "fulfilled") push("ai_plus", aiPlus.value.candidates);
      if (web.status === "fulfilled" && !web.value.error) {
        // The open-web branch returns whatever pages matched loosely — keep only what actually
        // relates to what was searched for.
        const webResults = ((web.value.data?.results ?? []) as { name: string; url?: string; detail?: string }[]).filter(
          (r) => isRelevant({ name: r.name ?? "", rationale: r.detail ?? "" }, trimmed),
        );
        push("web", webResults);
      }

      if (ai.status === "rejected" && aiPlus.status === "rejected") {
        setDeepNote((ai.reason as Error)?.message ?? "AI matching is unavailable right now.");
      }

      // Drop duplicates by name, keeping the highest-rated version of each.
      const byName = new Map<string, Match>();
      for (const m of collected) {
        const key = m.name.toLowerCase();
        const prev = byName.get(key);
        if (!prev || (m.closeness ?? 0) > (prev.closeness ?? 0)) byName.set(key, m);
      }
      const unique = [...byName.values()].sort((a, b) => (b.closeness ?? 0) - (a.closeness ?? 0));
      setDeepMatches(unique);

      // Live site reads for the closest few candidates that have a website; each result updates
      // on its own so the list doesn't wait for all of them.
      for (const m of unique.filter((c) => c.url).slice(0, MAX_SITE_CHECKS)) {
        checkCandidateProducts({ data: { url: m.url!, query: trimmed } })
          .then((r) => {
            setDeepMatches((prev) =>
              prev
                .map((p) =>
                  p.id === m.id
                    ? {
                        ...p,
                        closeness:
                          p.closeness != null
                            ? Math.round((p.closeness + r.matchScore) / 2)
                            : r.matchScore,
                        note: `${r.matchScore}% site match`,
                      }
                    : p,
                )
                .sort((a, b) => (b.closeness ?? 0) - (a.closeness ?? 0)),
            );
          })
          .catch(() => {
            /* a failed site read just leaves the AI rating in place */
          });
      }
    } finally {
      setDeepLoading(false);
    }
  }

  const traders = data?.traders ?? [];
  const items = data?.items ?? [];

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="Search"
        aria-label="Search"
        className="h-9 w-9 shrink-0 rounded-full border border-border bg-muted"
      >
        <Search className="h-5 w-5 shrink-0" strokeWidth={2.25} />
      </Button>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass max-h-[85vh] w-[min(680px,94vw)] overflow-y-auto sm:max-w-[min(680px,94vw)]">
          <DialogTitle className="text-base tracking-tight">Search</DialogTitle>
          <DialogDescription className="text-[13px]">
            Find traders or items to trade, match with AI, AI+ and the open web, and add any result
            to your Screen List.
          </DialogDescription>

          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search traders, commodities, or a Bid/Offer ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runDeepSearch()}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => runDeepSearch()}
              disabled={deepLoading || query.trim().length < 2}
              className="shrink-0 gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {deepLoading ? "Matching…" : "Match with AI"}
            </Button>
          </div>

          {query.trim().length > 1 && (
            <div className="mt-4 space-y-4">
              {isFetching && <p className="text-sm text-muted-foreground">Searching…</p>}

              {dealMatches.length > 0 && (
                <div>
                  <p className="label-caps flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Your deals
                  </p>
                  <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                    {dealMatches.map((d) => (
                      <li key={d.id}>
                        <Link
                          to="/live-deal-engine"
                          search={{ tx: d.id }}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-accent/40"
                        >
                          <span className="min-w-0">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium",
                                  d.direction === "bid"
                                    ? "bg-primary/12 text-primary"
                                    : "bg-muted text-foreground",
                                )}
                              >
                                {d.reference}
                              </span>
                              <span className="truncate text-sm font-medium">{d.title}</span>
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {d.stage} · {d.step}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!isFetching && traders.length === 0 && items.length === 0 && dealMatches.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nothing in our records matches "{query}" — try matching with AI.
                </p>
              )}

              {traders.length > 0 && (
                <ResultGroup title="Traders" icon={Users} results={traders} screenList={screenList} />
              )}
              {items.length > 0 && (
                <ResultGroup title="Items to trade" icon={Package} results={items} screenList={screenList} />
              )}
            </div>
          )}

          {query.trim().length < 2 && recentDeals.length > 0 && (
            <div className="mt-4">
              <p className="label-caps flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Recent
              </p>
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {recentDeals.map((d) => (
                  <li key={d.id}>
                    <Link
                      to="/live-deal-engine"
                      search={{ tx: d.id }}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent/40"
                    >
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium",
                          d.direction === "bid" ? "bg-primary/12 text-primary" : "bg-muted text-foreground",
                        )}
                      >
                        {d.reference}
                      </span>
                      <span className="min-w-0 truncate text-sm">{d.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(deepLoading || deepMatches.length > 0 || deepNote) && (
            <div className="mt-4 space-y-2">
              <p className="label-caps flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Matches for "{deepQuery}" · closest first
              </p>
              {deepLoading && (
                <p className="text-sm text-muted-foreground">
                  Searching using AI…
                </p>
              )}
              {!deepLoading && deepMatches.length === 0 && !deepNote && (
                <p className="text-sm text-muted-foreground">No further matches found.</p>
              )}
              {deepMatches.length > 0 && (
                <ResultGroup
                  title=""
                  icon={Sparkles}
                  results={deepMatches}
                  screenList={screenList}
                  hideTitle
                />
              )}
              {deepNote && <p className="text-xs text-muted-foreground">{deepNote}</p>}
              {deepMatches.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  These are proposals — a person still decides who to approach.
                </p>
              )}
            </div>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <p className="label-caps">
              Screen List{screenList.items.length > 0 ? ` · ${screenList.items.length}` : ""}
            </p>
            {screenList.items.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing added yet — search above and add traders or items you want to keep an eye on.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {screenList.items.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {i.type === "trader" ? (
                        <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <Package className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                      <span className="min-w-0 truncate font-medium">{i.name}</span>
                      {i.meta && <span className="shrink-0 text-xs text-muted-foreground">{i.meta}</span>}
                    </span>
                    <button
                      onClick={() => screenList.remove(i.id)}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResultGroup({
  title,
  icon: Icon,
  results,
  screenList,
  hideTitle,
}: {
  title: string;
  icon: typeof Users;
  results: Match[];
  screenList: ReturnType<typeof useScreenList>;
  hideTitle?: boolean;
}) {
  return (
    <div>
      {!hideTitle && (
        <p className="label-caps flex items-center gap-1.5">
          <Icon className="h-3 w-3" /> {title}
        </p>
      )}
      <ul className="mt-2 divide-y divide-border rounded-md border border-border">
        {results.map((r) => {
          const added = screenList.has(r.id);
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  {r.source !== "records" && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {SOURCE_LABEL[r.source]}
                    </span>
                  )}
                  {r.closeness != null && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        r.closeness >= 60
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-muted text-muted-foreground",
                      )}
                      title={r.note ?? "How closely this matches your search"}
                    >
                      {r.closeness}% match
                    </span>
                  )}
                </span>
                {(r.meta || r.note) && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {[r.meta, r.note].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <Button
                size="sm"
                variant={added ? "secondary" : "outline"}
                className="shrink-0 gap-1.5"
                onClick={() =>
                  added
                    ? screenList.remove(r.id)
                    : screenList.add({ id: r.id, type: r.type, name: r.name, ...(r.meta ? { meta: r.meta } : {}) })
                }
              >
                {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {added ? "Added" : "Add"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
