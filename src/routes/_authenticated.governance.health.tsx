import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { GovernanceShell } from "@/components/layout/GovernanceShell";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/governance/health")({
  head: () => ({
    meta: [{ title: "System Health — Governance Console" }],
  }),
  component: SystemHealthPage,
});

const CHECKS: { label: string; table: "transactions" | "compliance_cases" | "api_request_logs" }[] = [
  { label: "Trading Gateway (transactions)", table: "transactions" },
  { label: "Compliance cases", table: "compliance_cases" },
  { label: "API gateway logs", table: "api_request_logs" },
];

function SystemHealthPage() {
  const { data: results = [], isLoading } = useQuery({
    queryKey: ["gov-system-health"],
    queryFn: async () => {
      return Promise.all(
        CHECKS.map(async (c) => {
          const start = performance.now();
          const { error } = await supabase.from(c.table).select("id", { head: true, count: "exact" }).limit(1);
          return { ...c, ok: !error, latencyMs: Math.round(performance.now() - start) };
        }),
      );
    },
  });

  return (
    <GovernanceShell
      title="System Health"
      description="Live reachability checks against this database, run when you loaded this page."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {results.map((r) => (
            <div key={r.table} className="rounded-md border border-border p-4">
              <div className="flex items-center gap-2">
                <Activity className={cn("h-4 w-4", r.ok ? "text-success" : "text-destructive")} />
                <p className="text-sm font-medium">{r.label}</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {r.ok ? "Reachable" : "Check failed"} · {r.latencyMs}ms
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">
        This is a live check against Supabase, not a historical uptime record — there's no
        incident history stored yet.
      </p>
    </GovernanceShell>
  );
}
