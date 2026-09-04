import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { when } from "@/lib/tx";
import { TOKEN_PRICE_USD } from "@/lib/spine";

export const Route = createFileRoute("/_authenticated/credits")({
  head: () => ({
    meta: [
      { title: "Tokens — Izenzo" },
      {
        name: "description",
        content: "Buy tokens and read every token movement against your organisation.",
      },
      { property: "og:title", content: "Tokens — Izenzo" },
      { property: "og:description", content: "Buy tokens and read the token ledger." },
    ],
  }),
  component: Credits,
});

const PACKS = [1, 4, 10, 25];

function Credits() {
  const { org, refresh } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<number | null>(null);

  const { data: ledger = [] } = useQuery({
    queryKey: ["credit_ledger", org?.id],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function buy(n: number) {
    if (!org) return;
    setBusy(n);
    try {
      const { error } = await supabase
        .from("organisations")
        .update({ credits: (org.credits ?? 0) + n })
        .eq("id", org.id);
      if (error) throw error;
      const { error: lErr } = await supabase.from("credit_ledger").insert({
        org_id: org.id,
        delta: n,
        reason: `Purchased ${n} token${n === 1 ? "" : "s"}`,
      });
      if (lErr) throw lErr;
      await refresh();
      await qc.invalidateQueries({ queryKey: ["credit_ledger"] });
      toast.success(`${n} token${n === 1 ? "" : "s"} added`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Tokens" description="One token is USD 10">
      <div className="max-w-3xl space-y-8">
        <div className="rounded-md border border-border p-5">
          <p className="label-caps">Balance</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{org?.credits ?? 0}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A Proof of Intent costs 1 token. A WaD case costs 3.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Buy tokens</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {PACKS.map((n) => (
              <div key={n} className="rounded-md border border-border p-4">
                <p className="text-lg font-semibold tabular-nums">{n}</p>
                <p className="text-xs text-muted-foreground">
                  USD {n * TOKEN_PRICE_USD}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                  disabled={busy !== null || !org}
                  onClick={() => buy(n)}
                >
                  Buy
                </Button>
              </div>
            ))}
          </div>
          {!org && (
            <p className="mt-3 text-sm text-muted-foreground">
              Add your organisation details before buying tokens.
            </p>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold">Token ledger</h2>
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            {ledger.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Movement</th>
                    <th className="px-4 py-2.5 font-medium">Reason</th>
                    <th className="px-4 py-2.5 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ledger.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 font-mono tabular-nums">
                        {row.delta > 0 ? `+${row.delta}` : row.delta}
                      </td>
                      <td className="px-4 py-2.5">{row.reason}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{when(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
