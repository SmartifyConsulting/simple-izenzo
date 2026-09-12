import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Webhook } from "lucide-react";
import { DeveloperShell } from "@/components/layout/DeveloperShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/developer/webhooks")({
  head: () => ({
    meta: [{ title: "Webhook Logs — Developer Centre" }],
  }),
  component: WebhookLogsPage,
});

function WebhookLogsPage() {
  const { org } = useAuth();

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["dev-webhook-deliveries", org?.id],
    enabled: !!org,
    queryFn: async () => {
      const { data: keys } = await supabase.from("api_keys").select("id").eq("org_id", org!.id);
      const keyIds = (keys ?? []).map((k) => k.id);
      if (keyIds.length === 0) return [];
      const { data: endpoints } = await supabase
        .from("api_webhook_endpoints")
        .select("id, url, active")
        .in("api_key_id", keyIds);
      const endpointIds = (endpoints ?? []).map((e) => e.id);
      const endpointById = new Map((endpoints ?? []).map((e) => [e.id, e]));
      if (endpointIds.length === 0) return [];
      const { data: rows, error } = await supabase
        .from("api_webhook_deliveries")
        .select("*")
        .in("endpoint_id", endpointIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (rows ?? []).map((r) => ({ ...r, endpoint: endpointById.get(r.endpoint_id) }));
    },
  });

  return (
    <DeveloperShell title="Webhook Logs" description="Signed HTTP callbacks for state changes, with delivery status and retries.">
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : deliveries.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-800 p-8 text-center">
          <Webhook className="mx-auto h-5 w-5 text-slate-600" />
          <p className="mt-2 text-sm text-slate-400">No webhook deliveries yet.</p>
          <p className="mt-1 text-xs text-slate-600">
            Register an endpoint against a key and Izenzo will deliver signed events here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map((d) => (
            <div key={d.id} className="rounded-md border border-slate-800 bg-slate-900 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-slate-300">{d.event_type}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-transparent text-[10px] capitalize",
                    d.status === "delivered" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
                  )}
                >
                  {d.status} · {d.response_status ?? "—"}
                </Badge>
              </div>
              <p className="mt-1 truncate text-slate-500">{d.endpoint?.url ?? "—"}</p>
              <p className="mt-1 text-slate-600">
                Attempt {d.attempt} · {new Date(d.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </DeveloperShell>
  );
}
