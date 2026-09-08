import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { when, type Transaction } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "System Admin — Izenzo" },
      { name: "description", content: "Administer users, tokens and reporting for the whole book." },
      { property: "og:title", content: "System Admin — Izenzo" },
      { property: "og:description", content: "Administer users, tokens and reporting." },
    ],
  }),
  component: AdminPage,
});

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  org_id: string | null;
  created_at: string;
};

function AdminPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  if (!isAdmin) {
    return (
      <AppShell title="System Admin">
        <p className="text-sm text-muted-foreground">
          This area is for administrators. Your seat does not have that role.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="System Admin" description="Users, tokens and reporting for the whole book">
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="registry">Registry</TabsTrigger>
          <TabsTrigger value="facilitation">Facilitation</TabsTrigger>
          <TabsTrigger value="ai-suggestions">AI Suggestions</TabsTrigger>
          <TabsTrigger value="compliance-cases">Compliance Cases</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UsersTab />
        </TabsContent>
        <TabsContent value="tokens" className="mt-6">
          <TokensTab />
        </TabsContent>
        <TabsContent value="registry" className="mt-6">
          <RegistryTab />
        </TabsContent>
        <TabsContent value="facilitation" className="mt-6">
          <FacilitationTab />
        </TabsContent>
        <TabsContent value="ai-suggestions" className="mt-6">
          <AiSuggestionsTab />
        </TabsContent>
        <TabsContent value="compliance-cases" className="mt-6">
          <ComplianceCasesTab />
        </TabsContent>
        <TabsContent value="reporting" className="mt-6">
          <ReportingTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function UsersTab() {
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, org_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const { data: adminIds = new Set<string>() } = useQuery({
    queryKey: ["admin-role-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id as string));
    },
  });

  async function toggleAdmin(userId: string, isCurrentlyAdmin: boolean) {
    try {
      if (isCurrentlyAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["admin-role-ids"] });
      toast.success(isCurrentlyAdmin ? "Admin role revoked" : "Admin role granted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {users.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">No users yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {users.map((u) => {
            const isUserAdmin = adminIds.has(u.id);
            return (
              <li key={u.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.full_name ?? u.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isUserAdmin && (
                    <Badge variant="secondary" className="font-normal">
                      admin
                    </Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => toggleAdmin(u.id, isUserAdmin)}>
                    {isUserAdmin ? "Revoke admin" : "Make admin"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TokensTab() {
  const qc = useQueryClient();
  const [issue, setIssue] = useState({ orgId: "", amount: "1" });
  const [nudge, setNudge] = useState({ orgId: "", title: "", body: "" });
  const [countryFilter, setCountryFilter] = useState("");

  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organisations").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const countries = Array.from(new Set(orgs.map((o) => o.country).filter(Boolean))) as string[];
  const filteredOrgs = countryFilter ? orgs.filter((o) => o.country === countryFilter) : orgs;

  function nudgeRow(orgId: string) {
    setNudge((n) => ({ ...n, orgId }));
    document.getElementById("nudge-message")?.focus();
    document.getElementById("nudge-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function issueTokens(e: React.FormEvent) {
    e.preventDefault();
    try {
      const org = orgs.find((o) => o.id === issue.orgId);
      if (!org) throw new Error("Choose an organisation");
      const n = Number(issue.amount);
      const { error } = await supabase.rpc("atomic_token_adjust", {
        p_org_id: org.id,
        p_delta: n,
        p_reason: "Issued by administrator",
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      toast.success("Tokens issued");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function sendNudge(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { error } = await supabase.from("notifications").insert({
        org_id: nudge.orgId || null,
        title: nudge.title,
        body: nudge.body || null,
      });
      if (error) throw error;
      setNudge({ orgId: "", title: "", body: "" });
      toast.success("Nudge sent");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={issueTokens} className="rounded-md border border-border p-5">
          <h2 className="text-sm font-semibold">Issue tokens</h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Organisation</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={issue.orgId}
                onChange={(e) => setIssue({ ...issue, orgId: e.target.value })}
              >
                <option value="">Choose…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {o.credits} tokens
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Tokens</Label>
              <Input
                type="number"
                min="1"
                value={issue.amount}
                onChange={(e) => setIssue({ ...issue, amount: e.target.value })}
              />
            </div>
            <Button size="sm" type="submit">
              Issue
            </Button>
          </div>
        </form>

        <form id="nudge-form" onSubmit={sendNudge} className="rounded-md border border-border p-5">
          <h2 className="text-sm font-semibold">Nudge</h2>
          <p className="text-xs text-muted-foreground">Sends to everyone, or pick one organisation below.</p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Organisation</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={nudge.orgId}
                onChange={(e) => setNudge({ ...nudge, orgId: e.target.value })}
              >
                <option value="">Everyone</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Input
                id="nudge-message"
                required
                value={nudge.title}
                onChange={(e) => setNudge({ ...nudge, title: e.target.value })}
              />
            </div>
            <Button size="sm" type="submit" variant="outline">
              Send nudge
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-md border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="text-sm font-semibold">Organisations</h2>
            <p className="text-xs text-muted-foreground">{filteredOrgs.length} of {orgs.length}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Filter by country</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filteredOrgs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No organisations match this filter.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredOrgs.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[o.country, o.sector].filter(Boolean).join(" · ") || "No details"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {o.credits} token{o.credits === 1 ? "" : "s"}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => nudgeRow(o.id)}>
                    Nudge
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RegistryTab() {
  const qc = useQueryClient();

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["admin-registry-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registry_claims")
        .select("*, registry_companies(legal_name, country, readiness_state)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["admin-registry-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registry_companies")
        .select("*")
        .order("legal_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function decide(claimId: string, decision: "approved" | "rejected" | "more_information_required") {
    const reason =
      decision === "rejected" ? window.prompt("Rejection reason (required):") : null;
    if (decision === "rejected" && !reason) return;
    const { error } = await supabase.rpc("admin_decide_registry_claim", {
      p_claim_id: claimId,
      p_decision: decision,
      p_reason: reason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Claim updated");
    await qc.invalidateQueries({ queryKey: ["admin-registry-claims"] });
    await qc.invalidateQueries({ queryKey: ["admin-registry-companies"] });
  }

  async function setReadiness(companyId: string, state: string) {
    const { error } = await supabase.rpc("admin_registry_set_readiness", {
      p_company_id: companyId,
      p_state: state,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Readiness updated");
    await qc.invalidateQueries({ queryKey: ["admin-registry-companies"] });
  }

  const pending = claims.filter((c) => c.status === "submitted" || c.status === "more_information_required");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold">Claims awaiting review</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No claims waiting for review.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-md border border-border">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">
                    {(c as { registry_companies?: { legal_name: string } }).registry_companies?.legal_name ??
                      "Unknown company"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Claimant role: {c.claimant_role} · {when(c.created_at)}
                  </p>
                  {c.evidence_note && (
                    <p className="mt-1 text-xs text-muted-foreground">{c.evidence_note}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => decide(c.id, "more_information_required")}>
                    Request info
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide(c.id, "rejected")}>
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => decide(c.id, "approved")}>
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold">Company readiness</h2>
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {companies.map((co) => (
            <li key={co.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">{co.legal_name}</p>
                <p className="text-xs text-muted-foreground">
                  {co.country} · {co.sector ?? "—"} · {co.source_type}
                </p>
              </div>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={co.readiness_state}
                onChange={(e) => setReadiness(co.id, e.target.value)}
              >
                {[
                  "seed_only",
                  "sample_only",
                  "demo_only",
                  "licence_pending",
                  "provider_pending",
                  "quarantined",
                  "duplicate_unresolved",
                  "disputed",
                  "privacy_hold",
                  "public_search_ready",
                  "demo_ready",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const FACILITATION_STATUSES = [
  "new_unassigned",
  "triage_in_progress",
  "more_information_needed",
  "compliance_review_required",
  "outreach_approved",
  "contact_attempted",
  "counterparty_responded",
  "profile_verification_in_progress",
  "ready_for_poi",
] as const;

const FACILITATION_OUTCOMES = [
  "converted_to_known_counterparty",
  "ready_for_next_step",
  "ready_for_poi_review",
  "counterparty_declined",
  "no_response",
  "invalid_details",
  "duplicate_merged",
  "blocked_by_compliance",
  "cancelled_by_requester",
  "closed_by_admin",
  "unable_to_contact",
] as const;

function FacilitationTab() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["admin-facilitation-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facilitation_cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-facilitation-cases"] });
  }

  async function assign(caseId: string) {
    if (!profile) return;
    const { error } = await supabase.rpc("admin_facilitation_assign", {
      p_case_id: caseId,
      p_owner_id: profile.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Case assigned to you");
    await refresh();
  }

  async function setStatus(caseId: string, status: string) {
    let note: string | null = null;
    if (status === "more_information_needed") {
      note = window.prompt("What information is needed?");
      if (!note) return;
    }
    const { error } = await supabase.rpc("admin_facilitation_set_status", {
      p_case_id: caseId,
      p_status: status,
      p_note: note,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status updated");
    await refresh();
  }

  async function toggleHold(caseId: string, hold: boolean) {
    const reason = hold ? window.prompt("Compliance hold reason (required):") : null;
    if (hold && !reason) return;
    const { error } = await supabase.rpc("admin_facilitation_set_compliance_hold", {
      p_case_id: caseId,
      p_hold: hold,
      p_reason: reason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(hold ? "Compliance hold set" : "Compliance hold cleared");
    await refresh();
  }

  async function close(caseId: string) {
    const outcome = window.prompt(
      `Final outcome (${FACILITATION_OUTCOMES.join(" / ")}):`,
    );
    if (!outcome || !(FACILITATION_OUTCOMES as readonly string[]).includes(outcome)) {
      if (outcome) toast.error("Not a valid outcome");
      return;
    }
    const reason = window.prompt("Closure reason (required):");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_facilitation_close", {
      p_case_id: caseId,
      p_outcome: outcome,
      p_reason: reason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Case closed");
    await refresh();
  }

  return (
    <div>
      <h2 className="text-sm font-semibold">Unknown-counterparty facilitation queue</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : cases.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No facilitation cases yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{c.counterparty_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.country ?? "—"} · {c.sector ?? "—"} · contact: {c.contact_identifier}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.source_evidence}</p>
                  {c.compliance_hold && (
                    <Badge variant="secondary" className="mt-1 font-normal text-destructive">
                      Compliance hold: {c.compliance_hold_reason}
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={c.status}
                    onChange={(e) => setStatus(c.id, e.target.value)}
                    disabled={c.status === "closed"}
                  >
                    {FACILITATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    {c.status === "closed" && <option value="closed">closed</option>}
                  </select>
                  <div className="flex gap-1.5">
                    {!c.owner_id && (
                      <Button size="sm" variant="outline" onClick={() => assign(c.id)}>
                        Assign to me
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleHold(c.id, !c.compliance_hold)}
                    >
                      {c.compliance_hold ? "Clear hold" : "Compliance hold"}
                    </Button>
                    {c.status !== "closed" && (
                      <Button size="sm" onClick={() => close(c.id)}>
                        Close
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const AI_SUGGESTION_TYPES = ["suggested_buyer", "suggested_supplier", "public_source_research_note"] as const;
const AI_CONFIDENCE = ["low", "medium", "high"] as const;
const AI_REJECTION_REASONS = [
  "duplicate",
  "weak_source",
  "wrong_jurisdiction",
  "poor_counterparty_fit",
  "compliance_concern",
  "insufficient_evidence",
  "already_known",
  "not_commercially_useful",
  "other",
] as const;
const AI_STALE_DAYS = 30;

function AiSuggestionsTab() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [form, setForm] = useState({
    type: "suggested_buyer",
    transactionId: "",
    name: "",
    summary: "",
    confidence: "low",
    sourceSummary: "",
    sourceReferences: "",
    reason: "",
  });

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["admin-ai-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_suggestions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: txOptions = [] } = useQuery({
    queryKey: ["admin-tx-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-ai-suggestions"] });
  }

  async function createSuggestion(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.summary.trim() || !form.sourceSummary.trim() || !form.reason.trim()) {
      toast.error("Name, summary, source summary and a creation reason are all required.");
      return;
    }
    const { error } = await supabase.rpc("admin_ai_suggestion_create", {
      p_suggestion_type: form.type,
      p_related_transaction_id: form.transactionId || null,
      p_suggested_name: form.name,
      p_summary: form.summary,
      p_confidence: form.confidence,
      p_source_summary: form.sourceSummary,
      p_reason: form.reason,
      p_source_references: form.sourceReferences || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Suggestion created");
    setShowForm(false);
    setForm({
      type: "suggested_buyer",
      transactionId: "",
      name: "",
      summary: "",
      confidence: "low",
      sourceSummary: "",
      sourceReferences: "",
      reason: "",
    });
    await refresh();
  }

  async function approve(id: string) {
    const { error } = await supabase.rpc("admin_ai_suggestion_approve", { p_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Approved — advisory only, requires human review before action");
    await refresh();
  }

  async function reject(id: string) {
    const reason = window.prompt(`Rejection reason (${AI_REJECTION_REASONS.join(" / ")}):`);
    if (!reason || !(AI_REJECTION_REASONS as readonly string[]).includes(reason)) {
      if (reason) toast.error("Not a valid reason");
      return;
    }
    const note = reason === "other" ? window.prompt("Note (required for 'other'):") : window.prompt("Note (optional):");
    if (reason === "other" && !note) return;
    const { error } = await supabase.rpc("admin_ai_suggestion_reject", {
      p_id: id,
      p_reason: reason,
      p_note: note,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rejected");
    await refresh();
  }

  async function needsMoreResearch(id: string) {
    const note = window.prompt("What research is needed? (required)");
    if (!note) return;
    const { error } = await supabase.rpc("admin_ai_suggestion_set_status", {
      p_id: id,
      p_status: "needs_more_research",
      p_note: note,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked as needing more research");
    await refresh();
  }

  async function archive(id: string) {
    const { error } = await supabase.rpc("admin_ai_suggestion_set_status", { p_id: id, p_status: "archived" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Archived");
    await refresh();
  }

  async function assignToMe(id: string) {
    if (!profile) return;
    const { error } = await supabase.rpc("admin_ai_suggestion_set_status", {
      p_id: id,
      p_status: "under_review",
      p_assigned_reviewer_id: profile.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assigned to you");
    await refresh();
  }

  const visible = suggestions.filter((s) => {
    if (statusFilter === "active") return !["rejected", "archived"].includes(s.status);
    if (statusFilter === "all") return true;
    return s.status === statusFilter;
  });

  return (
    <div>
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        AI suggestions are advisory only. They do not create a POI, trigger outreach, modify a
        match, verify a counterparty, or contact any counterparty unless reviewed and approved by
        an authorised human user.
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">AI Suggestion Review Queue</h2>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="under_review">Under review</option>
            <option value="needs_more_research">Needs more research</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "New suggestion"}
          </Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createSuggestion} className="mt-4 space-y-3 rounded-md border border-border p-4">
          <p className="text-xs text-muted-foreground">
            Manual creation by an admin requires a reason — suggestions may not otherwise exist
            without a linked trade.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {AI_SUGGESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Related trade</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.transactionId}
                onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
              >
                <option value="">— none —</option>
                {txOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Suggested name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Summary</Label>
              <Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Confidence</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.confidence}
                onChange={(e) => setForm({ ...form, confidence: e.target.value })}
              >
                {AI_CONFIDENCE.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Source references (optional)</Label>
              <Input
                value={form.sourceReferences}
                onChange={(e) => setForm({ ...form, sourceReferences: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Source summary</Label>
              <Textarea
                rows={2}
                value={form.sourceSummary}
                onChange={(e) => setForm({ ...form, sourceSummary: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Reason for manual creation</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <div className="text-right">
            <Button type="submit" size="sm">
              Create suggestion
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suggestions match this filter.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((s) => {
              const stale =
                ["new", "under_review", "needs_more_research"].includes(s.status) &&
                Date.now() - new Date(s.created_at).getTime() > AI_STALE_DAYS * 24 * 60 * 60 * 1000;
              return (
                <li key={s.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{s.suggested_name}</p>
                        <Badge variant="secondary" className="font-normal">
                          {s.suggestion_type}
                        </Badge>
                        <Badge variant="secondary" className="font-normal capitalize">
                          {s.confidence} confidence
                        </Badge>
                        {stale && (
                          <Badge variant="secondary" className="font-normal text-warning">
                            stale
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{s.summary}</p>
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          Source detail
                        </summary>
                        <div className="mt-1 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
                          <p>{s.source_summary}</p>
                          <p className="mt-1">
                            {s.source_references
                              ? `References: ${s.source_references}`
                              : "Source reference not available."}
                          </p>
                          {s.rejection_reason && (
                            <p className="mt-1 text-destructive">
                              Rejected — {s.rejection_reason}: {s.rejection_note}
                            </p>
                          )}
                          {s.reviewer_note && <p className="mt-1">Reviewer note: {s.reviewer_note}</p>}
                        </div>
                      </details>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="font-normal">
                        {s.status}
                      </Badge>
                      {!["approved", "rejected", "archived"].includes(s.status) && (
                        <>
                          {!s.assigned_reviewer_id && (
                            <Button size="sm" variant="outline" onClick={() => assignToMe(s.id)}>
                              Assign to me
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => needsMoreResearch(s.id)}>
                            Needs research
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => reject(s.id)}>
                            Reject
                          </Button>
                          <Button size="sm" onClick={() => approve(s.id)}>
                            Approve
                          </Button>
                        </>
                      )}
                      {!["archived"].includes(s.status) && s.status !== "new" && (
                        <Button size="sm" variant="ghost" onClick={() => archive(s.id)}>
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

const CASE_TYPES = ["kyc_review", "aml_alert", "counterparty_dispute", "transaction_review", "other"] as const;
const CASE_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function ComplianceCasesTab() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("open");
  const [form, setForm] = useState({
    caseType: "kyc_review",
    priority: "medium",
    title: "",
    summary: "",
    counterpartyId: "",
  });

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["admin-compliance-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cpOptions = [] } = useQuery({
    queryKey: ["admin-cp-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, name")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-compliance-cases"] });
  }

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.summary.trim() || !form.counterpartyId) {
      toast.error("Title, summary and a subject counterparty are required.");
      return;
    }
    const { error } = await supabase.rpc("admin_case_create", {
      p_case_type: form.caseType,
      p_title: form.title,
      p_summary: form.summary,
      p_priority: form.priority,
      p_subject_counterparty_id: form.counterpartyId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Case created");
    setShowForm(false);
    setForm({ caseType: "kyc_review", priority: "medium", title: "", summary: "", counterpartyId: "" });
    await refresh();
  }

  async function assignToMe(id: string) {
    if (!profile) return;
    const { error } = await supabase.rpc("admin_case_assign", { p_id: id, p_analyst_id: profile.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assigned to you");
    await refresh();
  }

  async function proposeDecision(id: string) {
    const decision = window.prompt("Propose decision (approve / reject / no_action):");
    if (!decision || !["approve", "reject", "no_action"].includes(decision)) {
      if (decision) toast.error("Not a valid decision");
      return;
    }
    const note = window.prompt("Note (required):");
    if (!note) return;
    const { error } = await supabase.rpc("admin_case_propose_decision", {
      p_id: id,
      p_decision: decision,
      p_note: note,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Decision proposed — awaiting a different admin to check it");
    await refresh();
  }

  async function approveDecision(id: string) {
    const note = window.prompt("Note (optional):") ?? undefined;
    const { error } = await supabase.rpc("admin_case_approve_decision", { p_id: id, p_note: note || null });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Decision approved — case closed");
    await refresh();
  }

  async function sendBack(id: string) {
    const note = window.prompt("Why is this being sent back? (required)");
    if (!note) return;
    const { error } = await supabase.rpc("admin_case_reject_proposal", { p_id: id, p_note: note });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sent back for rework");
    await refresh();
  }

  const visible = cases.filter((c) => {
    if (statusFilter === "open")
      return !["closed_approved", "closed_rejected", "closed_no_action"].includes(c.status);
    if (statusFilter === "all") return true;
    return c.status === statusFilter;
  });

  return (
    <div>
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        A proposed decision must be checked and approved by a different admin than the one who
        proposed it. The proposing admin cannot approve their own case — this is enforced by the
        database, not just hidden in the UI.
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Compliance Case Management</h2>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="all">All</option>
            <option value="under_review">Under review</option>
            <option value="decision_proposed">Decision proposed</option>
            <option value="closed_approved">Closed — approved</option>
            <option value="closed_rejected">Closed — rejected</option>
            <option value="closed_no_action">Closed — no action</option>
          </select>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "New case"}
          </Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createCase} className="mt-4 space-y-3 rounded-md border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Case type</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.caseType}
                onChange={(e) => setForm({ ...form, caseType: e.target.value })}
              >
                {CASE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {CASE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Subject counterparty</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.counterpartyId}
                onChange={(e) => setForm({ ...form, counterpartyId: e.target.value })}
              >
                <option value="">— select —</option>
                {cpOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Summary</Label>
              <Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
          </div>
          <div className="text-right">
            <Button type="submit" size="sm">
              Create case
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cases match this filter.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((c) => {
              const isProposer = c.proposed_decision_by === profile?.id;
              return (
                <li key={c.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{c.title}</p>
                        <Badge variant="secondary" className="font-normal">
                          {c.case_type}
                        </Badge>
                        <Badge variant="secondary" className="font-normal capitalize">
                          {c.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{c.summary}</p>
                      {c.status === "decision_proposed" && (
                        <div className="mt-1.5 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
                          <p>
                            Proposed decision: <span className="font-medium">{c.proposed_decision}</span>
                          </p>
                          <p className="mt-1">{c.proposed_decision_note}</p>
                          {isProposer && (
                            <p className="mt-1 text-warning">
                              You proposed this decision — a different admin must check it.
                            </p>
                          )}
                        </div>
                      )}
                      {c.final_decision && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Final decision: <span className="font-medium">{c.final_decision}</span> —{" "}
                          {c.final_decision_note}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="font-normal">
                        {c.status}
                      </Badge>
                      {!["closed_approved", "closed_rejected", "closed_no_action"].includes(c.status) && (
                        <>
                          {!c.assigned_analyst_id && (
                            <Button size="sm" variant="outline" onClick={() => assignToMe(c.id)}>
                              Assign to me
                            </Button>
                          )}
                          {c.status !== "decision_proposed" && (
                            <Button size="sm" variant="outline" onClick={() => proposeDecision(c.id)}>
                              Propose decision
                            </Button>
                          )}
                          {c.status === "decision_proposed" && !isProposer && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => sendBack(c.id)}>
                                Send back
                              </Button>
                              <Button size="sm" onClick={() => approveDecision(c.id)}>
                                Approve
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReportingTab() {
  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organisations").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name, org_id, created_at");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["admin-txs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  const totalTokens = orgs.reduce((sum, o) => sum + (o.credits ?? 0), 0);
  const byStage = txs.reduce<Record<string, number>>((acc, t) => {
    acc[t.stage] = (acc[t.stage] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Organisations", value: orgs.length },
          { label: "Users", value: users.length },
          { label: "Tokens in circulation", value: totalTokens },
          { label: "Open transactions", value: txs.length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-md border border-border p-5">
            <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-sm font-semibold">Transactions by stage</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-border">
          {Object.keys(byStage).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {Object.entries(byStage).map(([stage, count]) => (
                <li key={stage} className="flex items-center justify-between p-4 text-sm capitalize">
                  {stage}
                  <Badge variant="secondary" className="font-normal">
                    {count}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Recent transactions</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-border">
          {txs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {txs.slice(0, 10).map((t) => (
                <li key={t.id} className="flex items-center justify-between p-4 text-sm">
                  <span>
                    {t.title}
                    <span className="block text-xs text-muted-foreground">
                      opened {when(t.created_at)}
                    </span>
                  </span>
                  <Badge variant="secondary" className="font-normal capitalize">
                    {t.stage}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
