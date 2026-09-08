import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
