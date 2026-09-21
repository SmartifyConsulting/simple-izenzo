import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Download, Handshake, LayoutGrid, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fallbackReference, type Transaction } from "@/lib/tx";
import { SPINE, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";

type Direction = "bid" | "offer";
type TxRow = Transaction & {
  direction: Direction;
  counterpartyName: string | null;
  /** The person who registered the bid/offer, and the company they registered it for. */
  bidderName: string | null;
  bidderCompany: string | null;
};

/** Coarse relative age ("5 days ago", "2 months ago") — the report reads at a glance, not to the
 * exact minute. */
function ageLabel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

type GateTone = "neutral" | "progress" | "warning" | "danger" | "success";

const GATE_TONE_CLASS: Record<GateTone, string> = {
  neutral: "border-border text-muted-foreground",
  progress: "border-info/40 bg-info/10 text-info",
  warning: "border-warning/40 bg-warning/10 text-[oklch(0.5_0.14_78)]",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  success: "border-success/40 bg-success/10 text-success",
};

function GatePill({ label, tone }: { label: string; tone: GateTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        GATE_TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
}

/** A gate that hasn't opened yet for this deal at all — a plain outline circle with a dash,
 * distinguishing "not applicable yet" from any actual pending/expired/complete state. */
function GateDash() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground">
      –
    </span>
  );
}

/** Every gate a trade passes through, read off the same persisted facts the Live Workspace's own
 * pulse uses — never a separate/duplicated notion of "done". */
function gateStates(t: TxRow) {
  const ageDays = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
  const search: { label: string; tone: GateTone } | null =
    t.stage === "trading" && !t.counterpartyName && t.step === "documents" ? null : { label: "Direct", tone: "success" };
  const match: { label: string; tone: GateTone } | null = t.counterpartyName
    ? { label: "committed", tone: "success" }
    : t.stage === "trading"
      ? { label: "discovery", tone: "progress" }
      : null;
  const poi = t.poi_sealed_at
    ? { label: "COMPLETED", tone: "success" as GateTone }
    : t.stage === "trading" && (t.step === "poi" || t.step === "intent")
      ? ageDays(t.created_at) > 21
        ? { label: "EXPIRED", tone: "danger" as GateTone }
        : { label: "DRAFT", tone: "warning" as GateTone }
      : null;
  const wad = t.wad_completed_at
    ? { label: "COMPLETED", tone: "success" as GateTone }
    : t.poi_sealed_at
      ? ageDays(t.poi_sealed_at) > 21
        ? { label: "EXPIRED", tone: "danger" as GateTone }
        : { label: "DRAFT", tone: "warning" as GateTone }
      : null;
  const execution =
    t.stage === "execution" || t.stage === "finality" || t.stage === "memory"
      ? { label: t.stage === "execution" ? "In progress" : "Done", tone: (t.stage === "execution" ? "progress" : "success") as GateTone }
      : null;
  return { search, match, poi, wad, execution };
}

/** A trade with a chosen counterparty — the moment a match becomes real, not just a candidate
 * list. */
function isMatched(t: TxRow) {
  return gateStates(t).match?.label === "committed";
}

/** Gold handshake mark for matched trades — matches the client's supplied reference icon. */
function MatchIcon() {
  return (
    <Handshake
      className="h-3.5 w-3.5 shrink-0"
      style={{ color: "oklch(0.75 0.14 85)" }}
      aria-label="Matched"
    />
  );
}

function toCsv(rows: TxRow[]) {
  const header = ["Reference", "Title", "Commodity", "Bidder", "Company", "Counterparty", "Stage", "Step", "Created"];
  const lines = rows.map((t) =>
    [
      t.reference ?? fallbackReference(t.id, t.direction),
      t.title,
      t.commodity ?? "",
      t.bidderName ?? "",
      t.bidderCompany ?? "",
      t.counterpartyName ?? "",
      t.stage,
      t.step,
      t.created_at,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

type ScopeFilter = "all" | "mine";
const SCOPE_FILTERS: ScopeFilter[] = ["all", "mine"];
const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(
  SPINE.map((s) => [s.key, s.label.replace(/ Gate$/, "")]),
) as Record<StageKey, string>;
const STAGE_FILTERS: StageKey[] = SPINE.map((s) => s.key);

/** The "nav menu view" of a deal list — search/filter/list-or-card, identical between /trades and
 * the Dashboard's canvas/list toggle so both surfaces behave the same way. */
export function TradesListView() {
  const { org } = useAuth();
  const [query, setQuery] = useState("");
  // "All" and "My Trades" are mutually exclusive — one is always selected, never both and never
  // neither, so this reads as a single choice rather than two independent toggles.
  const [scope, setScope] = useState<ScopeFilter>("all");
  // Empty set = no stage constraint (show every stage) — same "neutral means unconstrained" idea
  // as scope above, so stage filtering is additive on top of All/My Trades rather than exclusive.
  const [stages, setStages] = useState<Set<StageKey>>(new Set());
  function toggleStage(s: StageKey) {
    setStages((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }
  const [view, setView] = useState<"list" | "card">("list");

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["my-trades", org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, bid_offers(direction, created_at)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as (Transaction & {
        bid_offers: { direction: string; created_at: string }[];
      })[];

      // Whoever's been chosen as the counterparty on each deal — shown alongside it in the list
      // so "who is this trade actually with" doesn't require opening the deal.
      const ids = rows.map((t) => t.id);
      const { data: chosen } = ids.length
        ? await supabase
            .from("counterparties")
            .select("transaction_id, name")
            .in("transaction_id", ids)
            .eq("status", "chosen")
        : { data: [] as { transaction_id: string; name: string }[] };
      const counterpartyByTx = new Map((chosen ?? []).map((c) => [c.transaction_id, c.name]));

      // Who registered each deal and for which company — the bidder, not just the counterparty.
      const orgIds = [...new Set(rows.map((t) => t.org_id).filter(Boolean))];
      const userIds = [
        ...new Set(rows.map((t) => (t as unknown as { created_by?: string | null }).created_by).filter(Boolean)),
      ] as string[];
      const [{ data: orgRows }, { data: peopleRows }] = await Promise.all([
        orgIds.length
          ? supabase.from("organisations").select("id, name").in("id", orgIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        userIds.length
          ? supabase.from("profiles").select("id, full_name, last_name").in("id", userIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string | null; last_name: string | null }[] }),
      ]);
      const companyById = new Map((orgRows ?? []).map((o) => [o.id, o.name]));
      const personById = new Map(
        (peopleRows ?? []).map((p) => [p.id, [p.full_name, p.last_name].filter(Boolean).join(" ").trim() || null]),
      );

      return rows.map((t): TxRow => {
        // A transaction can pick up more than one bid_offers row over its life (e.g. a
        // counter-offer) — the earliest one is the side that actually opened this deal.
        const earliest = [...t.bid_offers].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))[0];
        const direction: Direction = earliest?.direction === "offer" ? "offer" : "bid";
        const createdBy = (t as unknown as { created_by?: string | null }).created_by ?? null;
        return {
          ...t,
          direction,
          counterpartyName: counterpartyByTx.get(t.id) ?? null,
          bidderName: (createdBy ? personById.get(createdBy) : null) ?? null,
          bidderCompany: companyById.get(t.org_id) ?? (t.org_id === org?.id ? (org?.name ?? null) : null),
        };
      });
    },
  });

  const filtered = useMemo(() => {
    let rows = txs;
    // "My Trades" — the ones this org itself registered (as opposed to every deal it can see
    // because it was picked as somebody else's counterparty).
    if (scope === "mine") rows = rows.filter((t) => t.org_id === org?.id);
    if (stages.size > 0) rows = rows.filter((t) => stages.has(t.stage));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (t) =>
          (t.commodity ?? "").toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (t.counterpartyName ?? "").toLowerCase().includes(q) ||
          (t.bidderName ?? "").toLowerCase().includes(q) ||
          (t.bidderCompany ?? "").toLowerCase().includes(q) ||
          (t.reference ?? fallbackReference(t.id, t.direction)).toLowerCase().includes(q),
      );
    }
    return rows;
  }, [txs, scope, stages, query, org?.id]);

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

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            {SCOPE_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => setScope(s)}
                className={cn(
                  "label-caps rounded-full border px-3 py-1 text-[11px] transition-colors",
                  scope === s
                    ? "border-transparent bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? "All" : "My Trades"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STAGE_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={stages.has(s)}
                onClick={() => toggleStage(s)}
                className={cn(
                  "label-caps rounded-full border px-3 py-1 text-[11px] transition-colors",
                  stages.has(s)
                    ? "border-transparent bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {STAGE_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by commodity, title, bidder, counterparty, or Bid/Offer ID…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            title="List view"
            className={cn(
              "rounded-full p-1.5 transition-colors",
              view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setView("card")}
            aria-pressed={view === "card"}
            title="Card view"
            className={cn(
              "rounded-full p-1.5 transition-colors",
              view === "card" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
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
      ) : view === "list" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Match</th>
                <th className="px-4 py-2 font-medium">Bidder / Counterparty</th>
                <th className="px-4 py-2 font-medium">Search</th>
                <th className="px-4 py-2 font-medium">Match</th>
                <th className="px-4 py-2 font-medium">POI</th>
                <th className="px-4 py-2 font-medium">WaD</th>
                <th className="px-4 py-2 font-medium">Execution</th>
                <th className="px-4 py-2 text-right font-medium">Age</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      {isMatched(t) && <MatchIcon />}
                      <Link to="/live-deal-engine" search={{ tx: t.id }} className="font-mono text-xs font-semibold hover:underline">
                        {t.reference ?? fallbackReference(t.id, t.direction)}
                      </Link>
                    </span>
                    <p className="mt-0.5 max-w-[220px] truncate text-xs text-muted-foreground">
                      {t.commodity || t.title}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-medium text-foreground">{t.bidderCompany ?? "—"}</p>
                    {t.bidderName && <p className="text-muted-foreground">{t.bidderName}</p>}
                    <p className="text-muted-foreground">↔ {t.counterpartyName ?? "Not yet chosen"}</p>
                  </td>
                  <GateColumns t={t} />
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{ageLabel(t.created_at)}</td>
                  <td className="w-8 px-2">
                    <Link to="/live-deal-engine" search={{ tx: t.id }} title="Open">
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Link
              key={t.id}
              to="/live-deal-engine"
              search={{ tx: t.id }}
              className="flex flex-col gap-2 rounded-xl border border-border p-3.5 transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {isMatched(t) && <MatchIcon />}
                  <span className="font-mono text-xs font-semibold">{t.reference ?? fallbackReference(t.id, t.direction)}</span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{ageLabel(t.created_at)}</span>
              </div>
              <p className="truncate text-sm font-medium">{t.commodity || t.title}</p>
              <p className="text-xs text-muted-foreground">
                {[t.bidderCompany, t.bidderName].filter(Boolean).join(" · ") || "—"} ↔{" "}
                {t.counterpartyName ?? "Not yet chosen"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <GateStack t={t} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** The five gate columns as separate `<td>`s, one per header column, for the list/table layout. */
function GateColumns({ t }: { t: TxRow }) {
  const g = gateStates(t);
  return (
    <>
      <td className="px-4 py-3">{g.search ? <GatePill {...g.search} /> : <GateDash />}</td>
      <td className="px-4 py-3">{g.match ? <GatePill {...g.match} /> : <GateDash />}</td>
      <td className="px-4 py-3">{g.poi ? <GatePill {...g.poi} /> : <GateDash />}</td>
      <td className="px-4 py-3">{g.wad ? <GatePill {...g.wad} /> : <GateDash />}</td>
      <td className="px-4 py-3">{g.execution ? <GatePill {...g.execution} /> : <GateDash />}</td>
    </>
  );
}

/** The same five gates as a wrapping row of pills, for the card layout. */
function GateStack({ t }: { t: TxRow }) {
  const g = gateStates(t);
  const entries: { key: string; cell: { label: string; tone: GateTone } | null }[] = [
    { key: "Search", cell: g.search },
    { key: "Match", cell: g.match },
    { key: "POI", cell: g.poi },
    { key: "WaD", cell: g.wad },
    { key: "Execution", cell: g.execution },
  ];
  return (
    <>
      {entries.map((e) =>
        e.cell ? (
          <span key={e.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {e.key}: <GatePill {...e.cell} />
          </span>
        ) : null,
      )}
    </>
  );
}
