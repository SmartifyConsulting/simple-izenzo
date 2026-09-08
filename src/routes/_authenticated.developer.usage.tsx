import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { DeveloperShell } from "@/components/layout/DeveloperShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/developer/usage")({
  head: () => ({
    meta: [{ title: "API Usage — Developer Centre" }],
  }),
  component: ApiUsagePage,
});

function ApiUsagePage() {
  const { org } = useAuth();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["dev-api-usage", org?.id],
    enabled: !!org,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_request_logs")
        .select("*")
        .eq("org_id", org!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = logs.length;
  const errors = logs.filter((l) => l.response_status >= 400).length;
  const avgLatency = total ? Math.round(logs.reduce((s, l) => s + l.latency_ms, 0) / total) : 0;

  return (
    <DeveloperShell title="API Usage" description="Live request traffic against your keys.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Requests (last 50)" value={total} />
        <Stat label="Errors" value={errors} tone={errors > 0 ? "warn" : "ok"} />
        <Stat label="Avg latency" value={`${avgLatency}ms`} />
      </div>

      <div className="mt-6 space-y-1.5">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : logs.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-800 p-8 text-center">
            <Activity className="mx-auto h-5 w-5 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">No API calls recorded yet.</p>
          </div>
        ) : (
          logs.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs">
              <span className="flex items-center gap-2 font-mono text-slate-300">
                <span className="text-slate-500">{l.method}</span> /{l.endpoint}
              </span>
              <span className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "border-transparent text-[10px]",
                    l.response_status < 400 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
                  )}
                >
                  {l.response_status}
                </Badge>
                <span className="text-slate-500">{l.latency_ms}ms</span>
                <span className="text-slate-600">{new Date(l.created_at).toLocaleTimeString()}</span>
              </span>
            </div>
          ))
        )}
      </div>
    </DeveloperShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "ok" }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold",
          tone === "warn" ? "text-amber-400" : tone === "ok" ? "text-emerald-400" : "text-slate-100",
        )}
      >
        {value}
      </p>
    </div>
  );
}
