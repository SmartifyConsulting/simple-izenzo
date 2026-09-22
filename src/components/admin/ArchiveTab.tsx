import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type ArchiveMove = { id: string; approved_at: string; retention_basis?: string | null; retrieval_route?: string | null };
type Candidate = {
  id: string;
  entity_type: string;
  entity_id: string;
  eligible_reason: string;
  flagged_at: string;
  dismissed_at: string | null;
  archive_moves?: ArchiveMove[];
};

/** Cold-storage archiving, moved out of Payments into its own tab: flagging and approving a
 * candidate for long-term (cold) storage is one workflow (Cold-Storage), and the resulting record
 * of what has actually been moved is a separate, standing log worth its own view (Archive) rather
 * than being mixed into the same pending-candidates list. */
export function ArchiveTab() {
  const qc = useQueryClient();
  const [candidateForm, setCandidateForm] = useState({ entityType: "", entityId: "", eligibleReason: "" });

  const { data: candidates = [] } = useQuery({
    queryKey: ["admin-archive-candidates"],
    queryFn: async (): Promise<Candidate[]> => {
      const { data, error } = await supabase
        .from("archive_move_candidates")
        .select("*, archive_moves(*)")
        .order("flagged_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Candidate[];
    },
  });

  async function refreshCandidates() {
    await qc.invalidateQueries({ queryKey: ["admin-archive-candidates"] });
  }

  async function flagCandidate(e: React.FormEvent) {
    e.preventDefault();
    if (!candidateForm.entityType.trim() || !candidateForm.entityId.trim() || !candidateForm.eligibleReason.trim()) {
      toast.error("Entity type, entity ID and eligibility reason are required.");
      return;
    }
    const { error } = await supabase.rpc("admin_flag_archive_candidate", {
      p_entity_type: candidateForm.entityType,
      p_entity_id: candidateForm.entityId,
      p_eligible_reason: candidateForm.eligibleReason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Candidate flagged for archiving — nothing moved yet");
    setCandidateForm({ entityType: "", entityId: "", eligibleReason: "" });
    await refreshCandidates();
  }

  async function approveMove(id: string) {
    const retentionBasis = window.prompt("Retention basis (required):");
    if (!retentionBasis) return;
    const retrievalRoute = window.prompt("Retrieval route (required):");
    if (!retrievalRoute) return;
    const { error } = await supabase.rpc("admin_approve_archive_move", {
      p_candidate_id: id,
      p_retention_basis: retentionBasis,
      p_retrieval_route: retrievalRoute,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Archive move approved and recorded");
    await refreshCandidates();
  }

  async function dismissCandidate(id: string) {
    const reason = window.prompt("Dismissal reason (optional):") ?? undefined;
    const { error } = await supabase.rpc("admin_dismiss_archive_candidate", { p_id: id, p_reason: reason ?? "" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Candidate dismissed");
    await refreshCandidates();
  }

  const pending = candidates.filter((c) => !(c.archive_moves ?? []).length && !c.dismissed_at);
  const dismissed = candidates.filter((c) => !(c.archive_moves ?? []).length && c.dismissed_at);
  const moved = candidates.filter((c) => (c.archive_moves ?? []).length > 0);

  return (
    <Tabs defaultValue="cold-storage">
      <TabsList>
        <TabsTrigger value="cold-storage">Cold-Storage</TabsTrigger>
        <TabsTrigger value="archive">Archive</TabsTrigger>
      </TabsList>

      <TabsContent value="cold-storage" className="mt-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Flag a candidate for cold storage</h2>
          <p className="text-xs text-muted-foreground">
            A dry-run flag only — nothing is moved until an approval below records the retention
            basis and retrieval route.
          </p>
          <form onSubmit={flagCandidate} className="mt-2 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Entity type</Label>
              <Input value={candidateForm.entityType} onChange={(e) => setCandidateForm({ ...candidateForm, entityType: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Entity ID</Label>
              <Input value={candidateForm.entityId} onChange={(e) => setCandidateForm({ ...candidateForm, entityId: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Eligibility reason (dry-run flag)</Label>
              <Textarea rows={2} value={candidateForm.eligibleReason} onChange={(e) => setCandidateForm({ ...candidateForm, eligibleReason: e.target.value })} />
            </div>
            <div className="sm:col-span-2 text-right">
              <Button type="submit" size="sm">
                Flag candidate
              </Button>
            </div>
          </form>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Pending candidates</h2>
          {pending.length === 0 && dismissed.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No candidates flagged yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {[...pending, ...dismissed].map((c) => (
                <li key={c.id} className="rounded-md border border-border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {c.entity_type} · {c.entity_id} — {c.eligible_reason}
                    </span>
                    {c.dismissed_at ? (
                      <Badge variant="secondary" className="font-normal">
                        dismissed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        pending
                      </Badge>
                    )}
                  </div>
                  {!c.dismissed_at && (
                    <div className="mt-1.5 flex gap-1.5">
                      <Button size="sm" onClick={() => approveMove(c.id)}>
                        Approve move
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dismissCandidate(c.id)}>
                        Dismiss
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </TabsContent>

      <TabsContent value="archive" className="mt-4">
        <h2 className="text-sm font-semibold">Archived (moved to cold storage)</h2>
        <p className="text-xs text-muted-foreground">The standing record of every entity actually moved, with its retention basis and retrieval route.</p>
        {moved.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Nothing has been archived yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {moved.map((c) => {
              const move = (c.archive_moves ?? [])[0];
              return (
                <li key={c.id} className="rounded-md border border-border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {c.entity_type} · {c.entity_id} — {c.eligible_reason}
                    </span>
                    <Badge variant="secondary" className="font-normal">
                      moved
                    </Badge>
                  </div>
                  {move && (
                    <p className="mt-1 text-muted-foreground">
                      Approved {new Date(move.approved_at).toLocaleString()}
                      {move.retention_basis ? ` · Retention: ${move.retention_basis}` : ""}
                      {move.retrieval_route ? ` · Retrieval: ${move.retrieval_route}` : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
