import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/auditor")({
  head: () => ({
    meta: [
      { title: "Auditor Access — Izenzo" },
      { name: "description", content: "Deletion and forensic event records for granted auditors." },
    ],
  }),
  component: AuditorPage,
});

function AuditorPage() {
  const { roles, profile } = useAuth();
  const qc = useQueryClient();
  const isAuditor = roles.includes("auditor") || roles.includes("admin");
  const [exported, setExported] = useState(false);

  const { data: myGrant } = useQuery({
    queryKey: ["my-auditor-grant"],
    enabled: isAuditor && Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditor_access_grants")
        .select("*")
        .eq("auditor_id", profile!.id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["deletion-forensic-records"],
    enabled: isAuditor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deletion_forensic_records")
        .select("*, deletion_forensic_findings(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!myGrant?.id) return;
    supabase
      .rpc("log_auditor_access_use", { p_grant_id: myGrant.id, p_event_type: "viewed" })
      .then(({ error }) => {
        if (error) console.error("[auditor] failed to log view:", error.message);
      });
  }, [myGrant?.id]);

  async function exportCsv() {
    if (myGrant?.id) {
      const { error } = await supabase.rpc("log_auditor_access_use", {
        p_grant_id: myGrant.id,
        p_event_type: "exported",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    const rows = [
      ["id", "entity_type", "entity_id", "reason", "legal_hold_applied", "completed_correctly", "created_at"],
      ...records.map((r) => [
        r.id,
        r.entity_type,
        r.entity_id,
        r.reason,
        String(r.legal_hold_applied),
        String(r.completed_correctly),
        r.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deletion_forensic_records.csv";
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    toast.success("Export logged");
  }

  if (!isAuditor) {
    return (
      <AppShell title="Auditor Access">
        <p className="text-sm text-muted-foreground">You do not have an active auditor access grant.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Auditor Access"
      description="Deletion and forensic event records — read-only, immutable"
      actions={
        <Button size="sm" variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      }
    >
      {myGrant && (
        <div className="mb-4 rounded-md border border-border p-3 text-xs">
          <p>
            Your access: <span className="font-medium">{myGrant.is_standing ? "Standing (designated auditor)" : "Purpose-bound"}</span>
            {" — "}
            {myGrant.purpose}
          </p>
          {!myGrant.is_standing && myGrant.expires_at && (
            <p className="mt-0.5 text-muted-foreground">Expires {new Date(myGrant.expires_at).toLocaleString()}</p>
          )}
          {exported && <p className="mt-0.5 text-muted-foreground">Export logged to your access record.</p>}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deletion forensic records yet.</p>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => {
            const findings = (r as { deletion_forensic_findings?: { id: string; finding: string; created_at: string }[] })
              .deletion_forensic_findings ?? [];
            return (
              <li key={r.id} className="rounded-md border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {r.entity_type} · {r.entity_id}
                  </span>
                  {r.legal_hold_applied && (
                    <Badge variant="secondary" className="font-normal">
                      legal hold: {r.legal_hold_reference ?? "applied"}
                    </Badge>
                  )}
                  {!r.completed_correctly && (
                    <Badge variant="destructive" className="font-normal">
                      completion issue
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Method: {r.deletion_method} · Recorded {new Date(r.created_at).toLocaleString()}
                </p>
                {r.redacted_fields.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Redacted: {r.redacted_fields.join(", ")} — {r.redaction_justification}
                  </p>
                )}
                {findings.length > 0 && (
                  <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs">
                    <p className="font-medium text-muted-foreground">Findings (linked, original record unedited)</p>
                    {findings.map((f) => (
                      <p key={f.id} className="mt-0.5">
                        {f.finding}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
