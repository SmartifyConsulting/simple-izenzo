import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { money, when, type Transaction } from "@/lib/tx";
import { SPINE, stageOf, stepDef, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";

const STAGE_BADGE_CLASS: Record<StageKey, string> = {
  trading: "bg-info/15 text-info",
  compliance: "bg-warning/20 text-warning",
  execution: "bg-[oklch(0.55_0.14_310)]/15 text-[oklch(0.55_0.14_310)]",
  finality: "bg-[oklch(0.5_0.13_35)]/15 text-[oklch(0.5_0.13_35)]",
  memory: "bg-success/15 text-success",
};

export const Route = createFileRoute("/_authenticated/dashboard")({
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
  const { org, profile } = useAuth();
  const [titleFilter, setTitleFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [valueSort, setValueSort] = useState<"none" | "asc" | "desc">("none");

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

  const counts = SPINE.map((s) => ({
    stage: s.label,
    n: txs.filter((t) => t.stage === s.key).length,
  }));

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
    if (valueSort !== "none") {
      rows = [...rows].sort((a, b) => {
        const diff = (a.price ?? 0) - (b.price ?? 0);
        return valueSort === "asc" ? diff : -diff;
      });
    }
    return rows;
  }, [txs, titleFilter, stageFilter, valueSort]);

  return (
    <AppShell
      title="Dashboard"
      description={org?.name ?? "Set up your organisation to begin"}
      actions={
        <Link to="/transactions/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-3.5 w-3.5" /> New transaction
          </Button>
        </Link>
      }
    >
      {!org && (
        <div className="mb-6 rounded-md border border-border bg-muted/40 p-5">
          <h2 className="text-sm font-semibold">Set up your organisation</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Transactions belong to an organisation, not to a person. Add your legal name,
            registration number and domicile before opening the first bid.
          </p>
          <Link to="/account/organisations">
            <Button size="sm" className="mt-4">
              Add organisation details
            </Button>
          </Link>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <div className="grid w-max min-w-full grid-cols-6 divide-x divide-border">
          <div className="min-w-[140px] bg-background p-4">
            <p className="label-caps">Tokens</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{org?.credits ?? 0}</p>
          </div>
          {counts.map((c) => (
            <div key={c.stage} className="min-w-[140px] bg-background p-4">
              <p className="label-caps truncate">{c.stage}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{c.n}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Transactions</h2>
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
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">
                    <span className="block">Transaction</span>
                    <Input
                      value={titleFilter}
                      onChange={(e) => setTitleFilter(e.target.value)}
                      placeholder="Filter…"
                      className="mt-1.5 h-7 w-full max-w-[180px] text-xs font-normal"
                    />
                  </th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                    <span className="block">Value</span>
                    <Select value={valueSort} onValueChange={(v) => setValueSort(v as typeof valueSort)}>
                      <SelectTrigger className="mt-1.5 h-7 w-full max-w-[130px] text-xs font-normal">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unsorted</SelectItem>
                        <SelectItem value="asc">Low to high</SelectItem>
                        <SelectItem value="desc">High to low</SelectItem>
                      </SelectContent>
                    </Select>
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    <span className="block">On the Trading Gateway</span>
                    <Select value={stageFilter} onValueChange={setStageFilter}>
                      <SelectTrigger className="mt-1.5 h-7 w-full max-w-[160px] text-xs font-normal">
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
                  </th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Opened</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTxs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      No transactions match these filters.
                    </td>
                  </tr>
                )}
                {filteredTxs.map((t) => (
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
                      <Badge variant="outline" className={cn("font-normal border-transparent", STAGE_BADGE_CLASS[t.stage])}>
                        {stageOf(t.stage)?.label} · {stepDef(t.stage, t.step)?.label ?? t.step}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {when(t.created_at)}
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
          )}
        </div>
      </section>
    </AppShell>
  );
}
