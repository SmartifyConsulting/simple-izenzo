import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { when } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/account/billing")({
  head: () => ({
    meta: [
      { title: "Billing history — Izenzo" },
      { name: "description", content: "Every token issued or spent across your organisations." },
    ],
  }),
  component: BillingPage,
});

type LedgerRow = {
  id: string;
  org_id: string;
  delta: number;
  reason: string;
  created_at: string;
};

function BillingPage() {
  const { orgs } = useAuth();
  const orgIds = orgs.map((o) => o.id);
  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? "—";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["billing-history", orgIds],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("*")
        .in("org_id", orgIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LedgerRow[];
    },
  });

  return (
    <AppShell title="Billing history" description="Every token issued or spent, across all your organisations">
      <div className="max-w-3xl overflow-hidden rounded-md border border-border">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No token activity yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">{when(r.created_at)}</TableCell>
                  <TableCell className="text-sm">{orgName(r.org_id)}</TableCell>
                  <TableCell className="text-sm">{r.reason}</TableCell>
                  <TableCell className={`text-right text-sm font-medium ${r.delta < 0 ? "text-destructive" : "text-success"}`}>
                    {r.delta > 0 ? "+" : ""}
                    {r.delta}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AppShell>
  );
}
