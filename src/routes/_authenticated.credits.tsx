import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Handshake, FileCheck, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { when } from "@/lib/tx";
import { TOKEN_PRICE_USD } from "@/lib/spine";
import { cn } from "@/lib/utils";
import { formatHomeCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/credits")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search["returnTo"] === "string" ? search["returnTo"] : undefined,
  }),
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
          stroke="var(--color-success)"
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
  const { org, orgs, roles, refresh } = useAuth();
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1);
  const [orgFilter, setOrgFilter] = useState("all");
  const isAdmin = roles.includes("admin");

  const { data: allOrgs = [] } = useQuery({
    queryKey: ["all-orgs-for-ledger"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("organisations").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Admins can filter across every organisation; everyone else, only the ones they belong to.
  const selectableOrgs = isAdmin ? allOrgs : orgs;
  const orgIds = selectableOrgs.map((o) => o.id);
  const orgName = useMemo(() => new Map(selectableOrgs.map((o) => [o.id, o.name])), [selectableOrgs]);

  const { data: ledger = [] } = useQuery({
    queryKey: ["credit_ledger", orgIds.join(",")],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("*")
        .in("org_id", orgIds)
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

  const filteredLedger = orgFilter === "all" ? ledger : ledger.filter((r) => r.org_id === orgFilter);

  const currentYear = new Date().getFullYear();
  const spentThisYear = filteredLedger
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
      const { error } = await supabase.rpc("atomic_token_adjust", {
        p_org_id: org.id,
        p_delta: n,
        p_reason: `Purchased ${n} token${n === 1 ? "" : "s"}`,
      });
      if (error) throw error;
      await refresh();
      await qc.invalidateQueries({ queryKey: ["credit_ledger"] });
      toast.success(`${n} token${n === 1 ? "" : "s"} added`);
      setAmount(1);
      // Drop straight back to whatever was waiting on tokens — its gate button is unlocked the
      // moment the balance lands, so there's nothing left to click through here.
      if (returnTo) void navigate({ to: returnTo });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Tokens" description="One token is USD 10">
      <div className="max-w-5xl space-y-8">
        {returnTo && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <p className="text-sm text-primary">
              Buy the tokens you need, then jump straight back to the trade you were working on.
            </p>
            <Link to={returnTo}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to trade
              </Button>
            </Link>
          </div>
        )}
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
                    <span className="h-2 w-2 rounded-full bg-success" /> Used
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Token ledger</h2>
              <p className="text-xs text-muted-foreground">
                Total spent this year:{" "}
                <span className="font-mono font-semibold text-destructive">
                  USD {spentThisYear * TOKEN_PRICE_USD}
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <label className="block text-right text-xs font-medium text-muted-foreground">
                Organisation
              </label>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="h-9 w-[220px] text-sm">
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
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            {filteredLedger.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <Accordion type="multiple" defaultValue={[monthKey(new Date().toISOString())]}>
                {groupByMonth(filteredLedger).map(([month, rows]) => {
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
                              {orgFilter === "all" && selectableOrgs.length > 1 && (
                                <th className="px-4 py-2 font-medium">Organisation</th>
                              )}
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
                                {orgFilter === "all" && selectableOrgs.length > 1 && (
                                  <td className="px-4 py-2.5 text-muted-foreground">
                                    {orgName.get(row.org_id) ?? "—"}
                                  </td>
                                )}
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

        <RefundSection orgId={org?.id ?? null} />
      </div>
    </AppShell>
  );
}

const REFUND_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  approved_for_processing: "Approved — processing",
  confirmed_complete: "Complete",
  rejected: "Rejected",
};

function RefundSection({ orgId }: { orgId: string | null }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: "", reason: "" });

  const { data: refunds = [] } = useQuery({
    queryKey: ["my-refund-requests", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("refund_requests")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    const amount = Number(form.amount);
    if (!amount || amount <= 0 || !form.reason.trim()) {
      toast.error("A positive amount and a reason are required.");
      return;
    }
    const { error } = await supabase.rpc("request_refund", {
      p_org_id: orgId,
      p_amount: amount,
      p_reason: form.reason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Refund requested — an admin will review it");
    setShowForm(false);
    setForm({ amount: "", reason: "" });
    await qc.invalidateQueries({ queryKey: ["my-refund-requests", orgId] });
  }

  if (!orgId) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between bg-sidebar px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.09em] text-white">Refunds</p>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Request refund"}
        </Button>
      </div>
      <div className="p-5">
        {showForm && (
          <form onSubmit={submit} className="mb-4 space-y-3 rounded-md border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Amount (ZAR)</Label>
                <Input type="number" min={0.01} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              A refund is never processed automatically. An admin reviews every request, and it is
              only marked complete once a named admin confirms the money actually moved.
            </p>
            <div className="text-right">
              <Button type="submit" size="sm">
                Submit request
              </Button>
            </div>
          </form>
        )}
        {refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No refund requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-xs">
                <span>
                  {r.currency} {r.amount} — {r.reason}
                </span>
                <Badge variant="secondary" className="font-normal">
                  {REFUND_STATUS_LABEL[r.status] ?? r.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
