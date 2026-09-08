import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { GovernanceShell } from "@/components/layout/GovernanceShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/governance/entities")({
  head: () => ({
    meta: [{ title: "Entity Verification — Governance Console" }],
  }),
  component: EntityVerificationPage,
});

const RATING_TONE: Record<string, string> = {
  trusted: "bg-success text-white",
  neutral: "bg-warning text-white",
  flagged: "bg-destructive text-white",
};

function EntityVerificationPage() {
  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["gov-entity-verification"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("*")
        .order("rating_computed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <GovernanceShell
      title="Entity Verification"
      description="Counterparties surfaced across the platform, with their computed rating band."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entities.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center">
          <ShieldCheck className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No counterparties on file yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entities.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[e.jurisdiction, e.sector].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{e.score ?? "—"}</span>
                <Badge
                  variant="outline"
                  className={cn("border-transparent capitalize", RATING_TONE[e.rating_band ?? ""] ?? "bg-muted text-muted-foreground")}
                >
                  {e.rating_band ?? "unrated"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </GovernanceShell>
  );
}
