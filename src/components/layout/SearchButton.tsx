import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Package, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useScreenList, type ScreenListItem } from "@/lib/screenList";

/** Replaces the old Quick Access launcher: search for traders (registry companies and known
 * counterparties) or items to trade (commodities already recorded on transactions), and add any
 * result straight to a personal Screen List — kept in the same dialog so building the list and
 * searching for more stay in one place. */
export function SearchButton() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const screenList = useScreenList();

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", query],
    enabled: query.trim().length > 1,
    queryFn: async () => {
      const like = `%${query.trim()}%`;
      const [{ data: companies }, { data: counterparties }, { data: txs }] = await Promise.all([
        supabase.from("registry_companies").select("id, legal_name, country, sector").or(`legal_name.ilike.${like},sector.ilike.${like}`).limit(8),
        supabase.from("counterparties").select("id, name, jurisdiction, sector").or(`name.ilike.${like},sector.ilike.${like}`).limit(8),
        supabase.from("transactions").select("commodity").ilike("commodity", like).not("commodity", "is", null).limit(30),
      ]);

      const traders: ScreenListItem[] = [
        ...(companies ?? []).map((c) => ({
          id: `company-${c.id}`,
          type: "trader" as const,
          name: c.legal_name,
          meta: [c.country, c.sector].filter(Boolean).join(" · "),
        })),
        ...(counterparties ?? []).map((c) => ({
          id: `counterparty-${c.id}`,
          type: "trader" as const,
          name: c.name,
          meta: [c.jurisdiction, c.sector].filter(Boolean).join(" · "),
        })),
      ];

      const seenItems = new Set<string>();
      const items: ScreenListItem[] = [];
      for (const t of txs ?? []) {
        const name = t.commodity?.trim();
        if (!name || seenItems.has(name.toLowerCase())) continue;
        seenItems.add(name.toLowerCase());
        items.push({ id: `item-${name.toLowerCase()}`, type: "item", name, meta: "Item to trade" });
      }

      return { traders, items };
    },
  });

  const traders = data?.traders ?? [];
  const items = data?.items ?? [];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 rounded-full border border-border bg-muted px-3"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass max-h-[85vh] w-[min(680px,94vw)] overflow-y-auto sm:max-w-[min(680px,94vw)]">
          <DialogTitle className="text-base tracking-tight">Search</DialogTitle>
          <DialogDescription className="text-[13px]">
            Find traders or items to trade, and add any result to your Screen List.
          </DialogDescription>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search traders or commodities…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {query.trim().length > 1 && (
            <div className="mt-4 space-y-4">
              {isFetching && <p className="text-sm text-muted-foreground">Searching…</p>}

              {!isFetching && traders.length === 0 && items.length === 0 && (
                <p className="text-sm text-muted-foreground">No traders or items match "{query}".</p>
              )}

              {traders.length > 0 && (
                <ResultGroup title="Traders" icon={Users} results={traders} screenList={screenList} />
              )}
              {items.length > 0 && (
                <ResultGroup title="Items to trade" icon={Package} results={items} screenList={screenList} />
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
}: {
  title: string;
  icon: typeof Users;
  results: ScreenListItem[];
  screenList: ReturnType<typeof useScreenList>;
}) {
  return (
    <div>
      <p className="label-caps flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {title}
      </p>
      <ul className="mt-2 divide-y divide-border rounded-md border border-border">
        {results.map((r) => {
          const added = screenList.has(r.id);
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                {r.meta && <span className="block truncate text-xs text-muted-foreground">{r.meta}</span>}
              </span>
              <Button
                size="sm"
                variant={added ? "secondary" : "outline"}
                className="shrink-0 gap-1.5"
                onClick={() => (added ? screenList.remove(r.id) : screenList.add(r))}
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
