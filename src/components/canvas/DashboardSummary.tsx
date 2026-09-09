import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Transaction } from "@/lib/tx";

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function when(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Live figures for the signed-in organisation, drawn from records already in the database. */
export function DashboardSummary({ txs }: { txs: Transaction[] }) {
  const { org } = useAuth();

  const { data: ledger = [] } = useQuery({
    queryKey: ["dash-ledger", org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("delta, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["dash-events", org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_events")
        .select("id, transaction_id, actor_name, action, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: registryCount = 0 } = useQuery({
    queryKey: ["dash-registry"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("registry_companies")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: openCases = 0 } = useQuery({
    queryKey: ["dash-cases"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("compliance_cases")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const open = txs.filter((t) => t.status === "open").length;
  const sealed = txs.filter((t) => !!t.finality_sealed_at).length;
  const spent = ledger.reduce((sum, r) => sum + (r.delta < 0 ? -r.delta : 0), 0);
  const recentDeals = txs.slice(0, 5);

  return (
    <section className="mb-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Tile label="Open deals" value={String(open)} />
        <Tile label="Sealed" value={String(sealed)} />
        <Tile label="All deals" value={String(txs.length)} />
        <Tile label="Token balance" value={String(org?.credits ?? 0)} />
        <Tile label="Tokens spent" value={String(spent)} />
        <Tile label="Registry / cases" value={`${registryCount} / ${openCases}`} hint="Counterparties / compliance" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your deals
          </h2>
          {recentDeals.length === 0 ? (
            <p className="text-xs text-muted-foreground">No deals yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recentDeals.map((t) => (
                <li key={t.id} className="py-2">
                  <Link
                    to="/deal/$id"
                    params={{ id: t.id }}
                    className="flex items-center justify-between gap-3 text-sm hover:underline"
                  >
                    <span className="truncate">{t.title ?? "Untitled deal"}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {t.status} · {when(t.updated_at ?? t.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent activity
          </h2>
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {events.map((e) => (
                <li key={e.id} className="py-2 text-sm">
                  <Link
                    to="/deal/$id"
                    params={{ id: e.transaction_id }}
                    className="flex items-center justify-between gap-3 hover:underline"
                  >
                    <span className="truncate">
                      {e.summary ?? e.action}
                      {e.actor_name ? ` — ${e.actor_name}` : ""}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {when(e.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
