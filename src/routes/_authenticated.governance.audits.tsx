import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";
import { GovernanceShell } from "@/components/layout/GovernanceShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/governance/audits")({
  head: () => ({
    meta: [{ title: "Active Audits — Governance Console" }],
  }),
  component: ActiveAuditsPage,
});

const STATUS_TONE: Record<string, string> = {
  open: "bg-info text-white",
  decision_proposed: "bg-warning text-white",
  decided: "bg-success text-white",
  closed: "bg-muted text-muted-foreground",
};

function ActiveAuditsPage() {
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["gov-active-audits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_cases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <GovernanceShell
      title="Active Audits"
      description="Every compliance case on record, from KYC review to closed decisions."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cases.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center">
          <FileSearch className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No compliance cases recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{c.title}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {c.case_type.replace(/_/g, " ")}
                  </Badge>
                  <Badge className={cn(STATUS_TONE[c.status] ?? "bg-muted text-muted-foreground")}>
                    {c.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{c.summary}</p>
              {c.proposed_decision && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Proposed: <span className="font-medium capitalize">{c.proposed_decision}</span>
                  {c.proposed_decision_note ? ` — ${c.proposed_decision_note}` : ""}
                </p>
              )}
              {c.final_decision && (
                <p className="mt-1 text-xs font-medium text-success">
                  Decided: {c.final_decision}
                  {c.final_decision_note ? ` — ${c.final_decision_note}` : ""}
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Priority: {c.priority} · Opened {new Date(c.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </GovernanceShell>
  );
}
