import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { money, when, type Transaction } from "@/lib/tx";
import { SPINE, stageOf, stepDef } from "@/lib/spine";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Izenzo" },
      { name: "description", content: "Your live transactions and where each one sits on the spine." },
      { property: "og:title", content: "Dashboard — Izenzo" },
      { property: "og:description", content: "Your live transactions across the Izenzo spine." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { org, profile } = useAuth();

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

      <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        <div className="bg-background p-4">
          <p className="label-caps">Tokens</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{org?.credits ?? 0}</p>
        </div>
        {counts.map((c) => (
          <div key={c.stage} className="bg-background p-4">
            <p className="label-caps truncate">{c.stage}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{c.n}</p>
          </div>
        ))}
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
                  <th className="px-4 py-2.5 font-medium">Transaction</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Value</th>
                  <th className="px-4 py-2.5 font-medium">On the spine</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Opened</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txs.map((t) => (
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
                      <Badge variant="secondary" className="font-normal">
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
