import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { GovernanceShell } from "@/components/layout/GovernanceShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/governance/triage")({
  head: () => ({
    meta: [{ title: "Triage Queue — Governance Console" }],
  }),
  component: TriageQueuePage,
});

function TriageQueuePage() {
  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["gov-triage-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_cases")
        .select("*")
        .in("status", ["open", "decision_proposed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: mismatches = [], isLoading: mismatchesLoading } = useQuery({
    queryKey: ["gov-triage-mismatches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settlement_mismatches")
        .select("*")
        .in("status", ["detected", "under_review"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = casesLoading || mismatchesLoading;
  const totalOpen = cases.length + mismatches.length;

  return (
    <GovernanceShell
      title="Triage Queue"
      description="Compliance cases and settlement mismatches waiting on a decision."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : totalOpen === 0 ? (
        <div className="rounded-md border border-border bg-muted/30 p-10 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-success" />
          <p className="mt-2 text-sm font-medium">Triage queue is clear</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No open compliance cases or settlement mismatches right now.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.summary}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {c.case_type.replace(/_/g, " ")}
                </Badge>
                <Badge className={cn(c.priority === "high" ? "bg-destructive text-white" : "bg-warning text-white")}>
                  {c.priority}
                </Badge>
              </div>
            </div>
          ))}
          {mismatches.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Izenzo: {m.izenzo_amount} · PayFast: {m.payfast_amount}
                </p>
              </div>
              <Badge variant="outline" className="flex shrink-0 items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> settlement
              </Badge>
            </div>
          ))}
        </div>
      )}
    </GovernanceShell>
  );
}
