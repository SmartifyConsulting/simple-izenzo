import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowUpRight, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { money, whenDate, type Transaction } from "@/lib/tx";
import { SPINE, stageOf, stepDef, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";

function monthKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function groupByMonth<T extends { created_at: string }>(rows: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = monthKey(row.created_at);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups.entries());
}

const STAGE_BADGE_CLASS: Record<StageKey, string> = {
  trading: "bg-info text-white",
  compliance: "bg-warning text-white",
  execution: "bg-[oklch(0.55_0.14_310)] text-white",
  finality: "bg-[oklch(0.5_0.13_35)] text-white",
  memory: "bg-success text-white",
};

const STALE_DAYS = 14;
const RECENT_DAYS = 7;

function daysSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

/** A deterministic summary computed from the loaded transactions — not a live model call. */
function buildOverview(txs: Transaction[]) {
  const changed = txs.filter((t) => daysSince(t.created_at) <= RECENT_DAYS);
  const stale = txs.filter((t) => t.stage === "trading" && daysSince(t.created_at) > STALE_DAYS);
  const sealed = txs.filter((t) => t.poi_sealed_at && daysSince(t.poi_sealed_at) <= RECENT_DAYS);

  const byStage = SPINE.map((s) => ({ label: s.label, n: txs.filter((t) => t.stage === s.key).length }));
  const busiest = byStage.reduce((a, b) => (b.n > a.n ? b : a), byStage[0]!);

  const changes: string[] = [];
  if (changed.length > 0) {
    changes.push(`${changed.length} trade${changed.length === 1 ? "" : "s"} opened in the last ${RECENT_DAYS} days.`);
  }
  if (sealed.length > 0) {
    changes.push(`${sealed.length} Proof of Intent seal${sealed.length === 1 ? "" : "s"} completed this week.`);
  }
  if (changes.length === 0) changes.push("No new activity in the last week.");

  const attention: string[] = [];
  if (stale.length > 0) {
    attention.push(
      `${stale.length} trade${stale.length === 1 ? "" : "s"} ha${stale.length === 1 ? "s" : "ve"} sat in Trading Gate for over ${STALE_DAYS} days without a Proof of Intent.`,
    );
  }
  if (attention.length === 0) attention.push("Nothing is stalled right now.");

  const recommendation =
    busiest.n > 0
      ? `Focus on ${busiest.label} next — it holds the most open trades (${busiest.n}).`
      : "Open your first trade to get started.";

  return { changes, attention, recommendation };
}

const ORG_BADGE_PALETTE = [
  "bg-[oklch(0.5_0.19_260)] text-white",
  "bg-[oklch(0.55_0.2_150)] text-white",
  "bg-[oklch(0.6_0.2_35)] text-white",
  "bg-[oklch(0.55_0.22_310)] text-white",
  "bg-[oklch(0.6_0.19_95)] text-white",
  "bg-[oklch(0.5_0.16_200)] text-white",
];

type Search = { stage?: StageKey | undefined };

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    stage: (["trading", "compliance", "execution", "finality", "memory"] as const).includes(
      search["stage"] as StageKey,
    )
      ? (search["stage"] as StageKey)
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Dashboard — Izenzo" },
      { name: "description", content: "Your live transactions and where each one sits on the Trading Gateway." },
      { property: "og:title", content: "Dashboard — Izenzo" },
      { property: "og:description", content: "Your live transactions across the Izenzo Trading Gateway." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { org, orgs, profile, roles } = useAuth();
  const { stage } = Route.useSearch();
  const [titleFilter, setTitleFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<string>(stage ?? "all");

  useEffect(() => {
    if (stage) setStageFilter(stage);
  }, [stage]);
  const [valueSort, setValueSort] = useState<"none" | "asc" | "desc">("none");
  const [orgFilter, setOrgFilter] = useState("all");
  const isAdmin = roles.includes("admin");

  const { data: allOrgs = [] } = useQuery({
    queryKey: ["all-orgs-for-transactions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("organisations").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectableOrgs = isAdmin ? allOrgs : orgs;
  const orgName = useMemo(() => new Map(selectableOrgs.map((o) => [o.id, o.name])), [selectableOrgs]);
  const orgBadgeClass = useMemo(
    () =>
      new Map(
        selectableOrgs.map((o, i) => [o.id, ORG_BADGE_PALETTE[i % ORG_BADGE_PALETTE.length]]),
      ),
    [selectableOrgs],
  );

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  const overview = useMemo(() => buildOverview(txs), [txs]);

  const filteredTxs = useMemo(() => {
    let rows = txs;
    if (titleFilter.trim()) {
      const q = titleFilter.trim().toLowerCase();
      rows = rows.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.commodity ?? "").toLowerCase().includes(q),
      );
    }
    if (stageFilter !== "all") {
      rows = rows.filter((t) => t.stage === stageFilter);
    }
    if (orgFilter !== "all") {
      rows = rows.filter((t) => t.org_id === orgFilter);
    }
    if (valueSort !== "none") {
      rows = [...rows].sort((a, b) => {
        const diff = (a.price ?? 0) - (b.price ?? 0);
        return valueSort === "asc" ? diff : -diff;
      });
    }
    return rows;
  }, [txs, titleFilter, stageFilter, orgFilter, valueSort]);

  return (
    <AppShell>
      {!org && (
        <div className="mb-6 rounded-md border border-border bg-muted/40 p-5">
          <h2 className="text-sm font-semibold">Set up your organisation</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Transactions belong to an organisation, not to a person. Add your legal name,
            registration number and domicile before opening the first bid.
          </p>
          <Link to="/account/settings">
            <Button size="sm" className="mt-4">
              Add organisation details
            </Button>
          </Link>
        </div>
      )}

      <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>

      <div className="mt-3 overflow-hidden rounded-md border border-border">
        <div className="flex items-center gap-2 bg-sidebar px-5 py-3 text-white">
          <Sparkles className="h-4 w-4" />
          <h2 className="text-sm font-semibold">AI Overview</h2>
        </div>
        <div className="grid gap-5 bg-background p-5 sm:grid-cols-3">
          <div>
            <p className="label-caps">What's changed</p>
            <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
              {overview.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label-caps">Needs your attention</p>
            <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
              {overview.attention.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label-caps">Recommendation</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{overview.recommendation}</p>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold">Trades</h2>
          <Link to="/transactions/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" /> New Trade
            </Button>
          </Link>
        </div>

        {txs.length > 0 && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Transaction</label>
              <Input
                value={titleFilter}
                onChange={(e) => setTitleFilter(e.target.value)}
                placeholder="Filter…"
                className="h-8 w-[180px] text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Value</label>
              <Select value={valueSort} onValueChange={(v) => setValueSort(v as typeof valueSort)}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unsorted</SelectItem>
                  <SelectItem value="asc">Low to high</SelectItem>
                  <SelectItem value="desc">High to low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Gate</label>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All gates</SelectItem>
                  {SPINE.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Organisation</label>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All organisations</SelectItem>
                  {selectableOrgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-md border border-border">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : txs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium">No transactions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Every transaction starts with a bid or an offer.
              </p>
              <Link to="/transactions/new">
                <Button size="sm" className="mt-4">
                  Open the first one
                </Button>
              </Link>
            </div>
          ) : filteredTxs.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No transactions match these filters.
            </p>
          ) : (
            <Accordion type="multiple" defaultValue={[monthKey(new Date().toISOString())]}>
              {groupByMonth(filteredTxs).map(([month, rows]) => (
                <AccordionItem key={month} value={month} className="border-border last:border-b-0">
                  <AccordionTrigger className="bg-sidebar px-4 py-3 text-sm font-medium text-white hover:no-underline [&>svg]:text-white/70">
                    <span className="flex flex-1 items-center justify-between pr-3">
                      <span>{month}</span>
                      <span className="text-xs font-normal text-white/70">
                        {rows.length} transaction{rows.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-0">
                    <table className="w-full text-sm">
                      <thead className="border-y border-border bg-muted/50 text-left">
                        <tr>
                          <th className="px-4 py-2 font-medium">Transaction</th>
                          <th className="hidden px-4 py-2 font-medium sm:table-cell">Value</th>
                          <th className="px-4 py-2 font-medium">Gate</th>
                          {orgFilter === "all" && selectableOrgs.length > 1 && (
                            <th className="hidden px-4 py-2 font-medium lg:table-cell">Organisation</th>
                          )}
                          <th className="hidden px-4 py-2 font-medium md:table-cell">Opened</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows.map((t) => (
                          <tr key={t.id} className="hover:bg-muted/40">
                            <td className="px-4 py-3">
                              <Link
                                to="/tx/$id/$stage/$step"
                                params={{ id: t.id, stage: t.stage, step: t.step }}
                                className="font-medium hover:underline"
                              >
                                {t.title}
                              </Link>
                              <p className="text-xs text-muted-foreground">
                                {t.commodity ?? "—"}
                                {t.org_id !== profile?.org_id ? " · incoming" : ""}
                              </p>
                            </td>
                            <td className="hidden px-4 py-3 tabular-nums sm:table-cell">
                              {money(t.price, t.currency)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={cn("font-normal border-transparent", STAGE_BADGE_CLASS[t.stage])}
                              >
                                {stageOf(t.stage)?.label} · {stepDef(t.stage, t.step)?.label ?? t.step}
                              </Badge>
                            </td>
                            {orgFilter === "all" && selectableOrgs.length > 1 && (
                              <td className="hidden px-4 py-3 lg:table-cell">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "font-normal border-transparent",
                                    orgBadgeClass.get(t.org_id) ?? "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {orgName.get(t.org_id) ?? "—"}
                                </Badge>
                              </td>
                            )}
                            <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                              {whenDate(t.created_at)}
                            </td>
                            <td className="px-2 py-3">
                              <Link
                                to="/tx/$id/$stage/$step"
                                params={{ id: t.id, stage: t.stage, step: t.step }}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </Link>
                            </td>
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
      </section>
    </AppShell>
  );
}
