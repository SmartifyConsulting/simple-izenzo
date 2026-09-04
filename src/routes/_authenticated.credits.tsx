import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Handshake, FileCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { when } from "@/lib/tx";
import { TOKEN_PRICE_USD } from "@/lib/spine";
import { cn } from "@/lib/utils";
import { formatHomeCurrency } from "@/lib/currency";

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

function TokenDonut({ used, available }: { used: number; available: number }) {
  const total = used + available;
  const pct = total > 0 ? used / total : 0;
  const r = 40;
  const c = 2 * Math.PI * r;
  const usedLen = c * pct;

  return (
    <svg viewBox="0 0 100 100" className="h-20 w-20">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="14" />
      {usedLen > 0 && (
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--color-sidebar)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${usedLen} ${c - usedLen}`}
          transform="rotate(-90 50 50)"
        />
      )}
    </svg>
  );
}

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
  const [amount, setAmount] = useState(1);

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

  const homeValue = formatHomeCurrency((org?.credits ?? 0) * TOKEN_PRICE_USD, org?.country);

  const currentYear = new Date().getFullYear();
  const spentThisYear = ledger
    .filter((r) => r.delta < 0 && new Date(r.created_at).getFullYear() === currentYear)
    .reduce((sum, r) => sum + Math.abs(r.delta), 0);

  async function buy() {
    if (!org) return;
    const n = amount;
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
      setAmount(1);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Tokens" description="One token is USD 10">
      <div className="max-w-5xl space-y-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="bg-sidebar px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.09em] text-white">
                Account Status
              </p>
            </div>
            <div className="grid grid-cols-2 gap-5 p-5">
              <div className="text-center">
                <p className="label-caps">Balance</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{org?.credits ?? 0}</p>
                <p className="text-xs text-muted-foreground">Current Tokens</p>
                <div className="mt-3 flex justify-center">
                  <TokenDonut used={spentThisYear} available={org?.credits ?? 0} />
                </div>
                <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sidebar" /> Used
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted" /> Available
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  Usage Costs
                </p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2.5 rounded-md border border-border p-2.5">
                    <Handshake className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-semibold">Proof of Intent (PoI)</p>
                      <p className="text-[11px] text-muted-foreground">1 Token per case</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-md border border-border p-2.5">
                    <FileCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-semibold">WaD Case</p>
                      <p className="text-[11px] text-muted-foreground">3 Tokens per case</p>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Clear your governance gates by starting cases.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              Purchase Tokens
            </p>
            <p className="mt-3 text-sm">
              <span className="font-semibold">Current Rate:</span> 1 Token = USD {TOKEN_PRICE_USD}
              {homeValue && (
                <span className="text-muted-foreground">
                  {" "}
                  (≈ {homeValue.formatted} {homeValue.code})
                </span>
              )}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Number of Tokens to Buy
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setAmount((a) => Math.max(1, a - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
                    className="h-9 text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setAmount((a) => a + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Total USD Cost</label>
                <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-semibold tabular-nums">
                  USD {amount * TOKEN_PRICE_USD}
                </div>
              </div>
            </div>

            <Button className="mt-4 w-full" disabled={busy || !org || amount <= 0} onClick={buy}>
              Complete Purchase — USD {amount * TOKEN_PRICE_USD} for {amount} Token
              {amount === 1 ? "" : "s"}
            </Button>
            {!org && (
              <p className="mt-2 text-xs text-muted-foreground">
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
