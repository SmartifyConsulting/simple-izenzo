import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { when } from "@/lib/tx";
import { TOKEN_PRICE_USD } from "@/lib/spine";
import { cn } from "@/lib/utils";

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

function Credits() {
  const { org, refresh } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pack, setPack] = useState("1");
  const [customAmount, setCustomAmount] = useState("");

  const { data: ledger = [] } = useQuery({
    queryKey: ["credit_ledger", org?.id],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];

      const txIds = Array.from(
        new Set(rows.map((r) => r.transaction_id).filter((id): id is string => Boolean(id))),
      );
      let dealTitles = new Map<string, string>();
      if (txIds.length > 0) {
        const { data: txs, error: txErr } = await supabase
          .from("transactions")
          .select("id, title")
          .in("id", txIds);
        if (txErr) throw txErr;
        dealTitles = new Map((txs ?? []).map((t) => [t.id, t.title]));
      }

      return rows.map((r) => ({
        ...r,
        dealTitle: r.transaction_id ? (dealTitles.get(r.transaction_id) ?? null) : null,
      }));
    },
  });

  const currentYear = new Date().getFullYear();
  const spentThisYear = ledger
    .filter((r) => r.delta < 0 && new Date(r.created_at).getFullYear() === currentYear)
    .reduce((sum, r) => sum + Math.abs(r.delta), 0);

  const selectedAmount = pack === "custom" ? Number(customAmount) || 0 : Number(pack);

  async function buy() {
    if (!org) return;
    const n = selectedAmount;
    if (n <= 0) {
      toast.error("Enter how many tokens to buy.");
      return;
    }
    setBusy(true);
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
      setCustomAmount("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
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

          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm font-semibold">Buy tokens</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Amount</label>
                <Select value={pack} onValueChange={setPack}>
                  <SelectTrigger className="h-9 w-[160px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} token{n === 1 ? "" : "s"} — USD {n * TOKEN_PRICE_USD}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom amount…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pack === "custom" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tokens</label>
                  <Input
                    type="number"
                    min="1"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="h-9 w-28 text-sm"
                  />
                </div>
              )}
              <Button size="sm" disabled={busy || !org || selectedAmount <= 0} onClick={buy}>
                Buy {selectedAmount > 0 ? `— USD ${selectedAmount * TOKEN_PRICE_USD}` : ""}
              </Button>
            </div>
            {!org && (
              <p className="mt-3 text-sm text-muted-foreground">
                Add your organisation details before buying tokens.
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Token ledger</h2>
            <p className="text-xs text-muted-foreground">
              Total spent this year:{" "}
              <span className="font-mono font-semibold text-destructive">
                USD {spentThisYear * TOKEN_PRICE_USD}
              </span>
            </p>
          </div>
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            {ledger.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <Accordion type="multiple" defaultValue={[monthKey(new Date().toISOString())]}>
                {groupByMonth(ledger).map(([month, rows]) => {
                  const net = rows.reduce((sum, r) => sum + r.delta, 0);
                  return (
                    <AccordionItem key={month} value={month} className="border-border last:border-b-0">
                      <AccordionTrigger className="bg-sidebar px-4 py-3 text-sm font-medium text-white hover:no-underline [&>svg]:text-white/70">
                        <span className="flex flex-1 items-center justify-between pr-3">
                          <span>{month}</span>
                          <span className="font-mono text-xs tabular-nums text-white/70">
                            {net > 0 ? `+${net}` : net} tokens (USD {Math.abs(net) * TOKEN_PRICE_USD}) ·{" "}
                            {rows.length} movement{rows.length === 1 ? "" : "s"}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-0 pb-0">
                        <table className="w-full text-sm">
                          <thead className="border-y border-border bg-muted/50 text-left">
                            <tr>
                              <th className="px-4 py-2 font-medium">Movement</th>
                              <th className="px-4 py-2 font-medium">Value</th>
                              <th className="px-4 py-2 font-medium">Reason</th>
                              <th className="px-4 py-2 font-medium">Deal</th>
                              <th className="px-4 py-2 font-medium">When</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {rows.map((row) => (
                              <tr key={row.id}>
                                <td
                                  className={cn(
                                    "px-4 py-2.5 font-mono tabular-nums",
                                    row.delta > 0 ? "text-success" : "text-destructive",
                                  )}
                                >
                                  {row.delta > 0 ? `+${row.delta}` : row.delta}
                                </td>
                                <td
                                  className={cn(
                                    "px-4 py-2.5 font-mono tabular-nums",
                                    row.delta > 0 ? "text-success" : "text-destructive",
                                  )}
                                >
                                  {row.delta < 0 ? "-" : "+"}USD {Math.abs(row.delta) * TOKEN_PRICE_USD}
                                </td>
                                <td className="px-4 py-2.5">{row.reason}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{row.dealTitle ?? "—"}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{when(row.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
