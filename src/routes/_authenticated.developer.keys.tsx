import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, ShieldAlert } from "lucide-react";
import { DeveloperShell } from "@/components/layout/DeveloperShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/developer/keys")({
  head: () => ({
    meta: [{ title: "API Keys — Developer Centre" }],
  }),
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const { org } = useAuth();
  const [env, setEnv] = useState<"sandbox" | "production">("sandbox");

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["dev-api-keys", org?.id],
    enabled: !!org,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("org_id", org!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = keys.filter((k) => k.environment === env);

  return (
    <DeveloperShell
      title="API Keys"
      description="Engineers and integration owners issuing credentials and wiring back-office systems to Izenzo."
    >
      <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 p-3">
        <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 p-1 text-xs">
          {(["sandbox", "production"] as const).map((e) => (
            <button
              key={e}
              onClick={() => setEnv(e)}
              className={cn(
                "rounded px-3 py-1.5 font-medium capitalize transition-colors",
                env === e ? "bg-emerald-500/15 text-emerald-400" : "text-slate-400 hover:text-slate-200",
              )}
            >
              {e === "sandbox" ? "Sandbox" : "Live"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">
          {env === "sandbox"
            ? "Synthetic data. No real counterparties contacted, no credits burned."
            : "Live effects real trades, real counterparties, real credit balances."}
        </p>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Only a platform administrator can issue, revoke or rotate keys. Contact your admin to get
        one created for {org?.name ?? "your organisation"} — this page shows what's already
        issued.
      </div>

      <div className="mt-6 space-y-2">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-800 p-8 text-center">
            <KeyRound className="mx-auto h-5 w-5 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">No {env} keys issued yet.</p>
          </div>
        ) : (
          filtered.map((k) => (
            <div key={k.id} className="rounded-md border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-100">{k.name}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-transparent text-[10px] capitalize",
                    k.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-400",
                  )}
                >
                  {k.status}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {k.key_prefix}••••••••••••
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {k.scopes.map((s: string) => (
                  <span key={s} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {s}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-600">
                Expires {new Date(k.expires_at).toLocaleDateString()} · Last used{" "}
                {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "never"}
              </p>
            </div>
          ))
        )}
      </div>
    </DeveloperShell>
  );
}
