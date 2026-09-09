import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Package, Plus, Check, X, Sparkles, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { discoverCounterpartiesByQuery, checkCandidateProducts } from "@/lib/izenzo.functions";
import { useScreenList, type ScreenListItem } from "@/lib/screenList";
import { cn } from "@/lib/utils";

/** Search for traders (registry companies and known counterparties) or items to trade, ask AI and
 * AI+ to propose further counterparties, and check candidate websites live through Bright Data —
 * every match carries a closeness rating and can be added to a personal Screen List. */
type MatchSource = "records" | "ai" | "ai_plus" | "web";

type Match = ScreenListItem & {
  source: MatchSource;
  /** 0-100 closeness rating; higher is a closer match to the search. */
  closeness?: number | undefined;
  url?: string | undefined;
  note?: string | undefined;
};

/** Live site checks are real page fetches — only worth running for the top few candidates. */
const MAX_SITE_CHECKS = 4;

const SOURCE_LABEL: Record<MatchSource, string> = {
  records: "Our records",
  ai: "AI",
  ai_plus: "AI+",
  web: "Web · Bright Data",
};

export function SearchButton() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [deepQuery, setDeepQuery] = useState("");
  const [deepMatches, setDeepMatches] = useState<Match[]>([]);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepNote, setDeepNote] = useState<string | null>(null);
  const screenList = useScreenList();

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
   * (Bright Data), then rates the closest of them by reading their site. */
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
        push("web", (web.value.data?.results ?? []) as { name: string; url?: string; detail?: string }[]);
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
        size="sm"
        onClick={() => setOpen(true)}
        className="w-[220px] justify-start gap-2 rounded-full border border-border bg-muted px-3"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Search</span>
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
                placeholder="Search traders or commodities…"
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

              {!isFetching && traders.length === 0 && items.length === 0 && (
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

          {(deepLoading || deepMatches.length > 0 || deepNote) && (
            <div className="mt-4 space-y-2">
              <p className="label-caps flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Matches for "{deepQuery}" · closest first
              </p>
              {deepLoading && (
                <p className="text-sm text-muted-foreground">
                  Asking AI and AI+, and checking the open web…
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
