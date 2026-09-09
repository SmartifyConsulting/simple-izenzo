import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fallbackReference, money, whenDate, type Transaction } from "@/lib/tx";
import { stepDef, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";

type Direction = "bid" | "offer";
type TxWithDirection = Transaction & { direction: Direction };

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const parts = key.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

const STAGE_ABBR: Record<StageKey, string> = {
  trading: "TG",
  compliance: "CG",
  execution: "EG",
  finality: "FG",
  memory: "MG",
};

const STAGE_BADGE_CLASS: Record<StageKey, string> = {
  trading: "bg-info text-white",
  compliance: "bg-warning text-white",
  execution: "bg-[oklch(0.55_0.14_310)] text-white",
  finality: "bg-[oklch(0.5_0.13_35)] text-white",
  memory: "bg-success text-white",
};

type SortKey = "recent" | "newest" | "oldest" | "volume_desc";

function sortRows(rows: TxWithDirection[], sort: SortKey) {
  const copy = [...rows];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    case "oldest":
      return copy.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    case "volume_desc":
      return copy.sort((a, b) => (b.price ?? 0) * (b.quantity ?? 1) - (a.price ?? 0) * (a.quantity ?? 1));
    case "recent":
    default:
      return copy;
  }
}

function toCsv(rows: TxWithDirection[]) {
  const header = ["Reference", "Title", "Commodity", "Stage", "Step", "Status", "Price", "Currency", "Quantity", "Created"];
  const lines = rows.map((t) =>
    [
      t.reference ?? fallbackReference(t.id, t.direction),
      t.title,
      t.commodity ?? "",
      t.stage,
      t.step,
      t.status,
      t.price ?? "",
      t.currency,
      t.quantity ?? "",
      t.created_at,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** The "nav menu view" of a deal list — search/sort/filter/table, identical between /trades and
 * the Dashboard's canvas/list toggle so both surfaces behave the same way. */
export function TradesListView() {
  const { org } = useAuth();
  const [commodityFilter, setCommodityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["my-trades", org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, bid_offers(direction, created_at)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as (Transaction & { bid_offers: { direction: string; created_at: string }[] })[]).map(
        (t) => {
          // A transaction can pick up more than one bid_offers row over its life (e.g. a
          // counter-offer) — the earliest one is the side that actually opened this deal.
          const earliest = [...t.bid_offers].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))[0];
          const direction: Direction = earliest?.direction === "offer" ? "offer" : "bid";
          return { ...t, direction } as TxWithDirection;
        },
      );
    },
  });

  const filtered = useMemo(() => {
    let rows = txs;
    if (commodityFilter.trim()) {
      const q = commodityFilter.trim().toLowerCase();
      rows = rows.filter(
        (t) =>
          (t.commodity ?? "").toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (t.reference ?? fallbackReference(t.id, t.direction)).toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      rows = rows.filter((t) => t.status === statusFilter);
    }
    return sortRows(rows, sort);
  }, [txs, commodityFilter, statusFilter, sort]);

  const currentMonth = monthKey(new Date().toISOString());
  const grouped = useMemo(() => {
    const map = new Map<string, TxWithDirection[]>();
    for (const t of filtered) {
      const key = monthKey(t.created_at);
      const bucket = map.get(key);
      if (bucket) bucket.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-trades.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3.5">
        <h2 className="text-sm font-semibold">Matches</h2>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-5 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={commodityFilter}
            onChange={(e) => setCommodityFilter(e.target.value)}
            placeholder="Search by commodity, title, or Bid/Offer ID…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Sort: Recently active</SelectItem>
            <SelectItem value="newest">Sort: Newest first</SelectItem>
            <SelectItem value="oldest">Sort: Oldest first</SelectItem>
            <SelectItem value="volume_desc">Sort: Highest volume</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium">No matches yet</p>
          <p className="mt-1 max-w-sm mx-auto text-sm text-muted-foreground">
            Matches appear here when you create one from search results, or when a trading
            partner invites you to a deal. Search for a trading partner to begin.
          </p>
          <Link to="/discover">
            <Button size="sm" className="mt-4 gap-2">
              <Search className="h-3.5 w-3.5" /> Search trading partners
            </Button>
          </Link>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={[currentMonth]}>
          {grouped.map(([key, rows]) => (
            <AccordionItem key={key} value={key} className="border-border px-1">
              <AccordionTrigger className="px-4 text-sm no-underline hover:no-underline">
                <span className="flex items-center gap-2">
                  {monthLabel(key)}
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    {rows.length}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-y border-border bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Reference</th>
                      <th className="px-4 py-2 font-medium">Transaction</th>
                      <th className="hidden px-4 py-2 font-medium sm:table-cell">Value</th>
                      <th className="px-4 py-2 font-medium">Gate</th>
                      <th className="hidden px-4 py-2 font-medium md:table-cell">Updated</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <Link to="/live-deal-engine" search={{ tx: t.id }}>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border-transparent font-mono font-normal",
                                t.direction === "bid" ? "bg-primary/12 text-primary" : "bg-muted text-foreground",
                              )}
                            >
                              {t.reference ?? fallbackReference(t.id, t.direction)}
                            </Badge>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link to="/live-deal-engine" search={{ tx: t.id }} className="font-medium hover:underline">
                            {t.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">{t.commodity ?? "—"}</p>
                        </td>
                        <td className="hidden px-4 py-3 tabular-nums sm:table-cell">{money(t.price, t.currency)}</td>
                        <td className="px-4 py-3">
                          <Link to="/live-deal-engine" search={{ tx: t.id }}>
                            <Badge
                              variant="outline"
                              className={cn("border-transparent font-normal", STAGE_BADGE_CLASS[t.stage])}
                            >
                              {STAGE_ABBR[t.stage]} · {stepDef(t.stage, t.step)?.label ?? t.step}
                            </Badge>
                          </Link>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {whenDate(t.created_at)}
                        </td>
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
