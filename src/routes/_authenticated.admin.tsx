import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Lock } from "lucide-react";
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
import { issueEvidencePack, downloadEvidencePack } from "@/lib/evidencePack.functions";
import { IntegrationsTab } from "@/components/admin/IntegrationsTab";

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
  last_accessed_at?: string | null;
};

type AdminTab = { value: string; label: string; Component: () => React.JSX.Element; superuserOnly?: boolean };

const ADMIN_GROUPS: { id: string; label: string; tabs: AdminTab[] }[] = [
  {
    id: "platform",
    label: "Platform",
    tabs: [
      { value: "users", label: "Users", Component: UsersTab },
      { value: "api-keys", label: "API Keys", Component: ApiKeysTab },
      { value: "integrations", label: "Integrations", Component: IntegrationsTab, superuserOnly: true },
    ],
  },
  {
    id: "trust-compliance",
    label: "Trust & Compliance",
    tabs: [
      { value: "registry", label: "Registry", Component: RegistryTab },
      { value: "facilitation", label: "Facilitation", Component: FacilitationTab },
      { value: "compliance-cases", label: "Compliance Cases", Component: ComplianceCasesTab },
      { value: "ai-suggestions", label: "AI Suggestions", Component: AiSuggestionsTab },
      { value: "auditors", label: "Auditors", Component: AuditorsTab },
    ],
  },
  {
    id: "money",
    label: "Money",
    tabs: [
      { value: "tokens", label: "Tokens", Component: TokensTab },
      { value: "payments", label: "Payments", Component: PaymentsTab },
    ],
  },
  {
    id: "partners",
    label: "Partners",
    tabs: [{ value: "funders", label: "Funders", Component: FundersTab }],
  },
  {
    id: "operations",
    label: "Operations",
    tabs: [
      { value: "support", label: "Support", Component: SupportTab },
      { value: "reporting", label: "Reporting", Component: ReportingTab },
    ],
  },
];

function AdminPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const isSuperuser = (user?.email ?? "").toLowerCase() === SUPERUSER_EMAIL;

  if (!isAdmin) {
    return (
      <AppShell title="System Admin">
        <p className="text-sm text-muted-foreground">
          This area is for administrators. Your seat does not have that role.
        </p>
      </AppShell>
    );
  }

  const groups = ADMIN_GROUPS.map((g) => ({
    ...g,
    tabs: g.tabs.filter((t) => !t.superuserOnly || isSuperuser),
  })).filter((g) => g.tabs.length > 0);

  return (
    <AppShell title="System Admin" description="Users, tokens and reporting for the whole book">
      <Tabs defaultValue="platform">
        <TabsList>
          {groups.map((g) => (
            <TabsTrigger key={g.id} value={g.id}>
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {groups.map((g) => (
          <TabsContent key={g.id} value={g.id} className="mt-6">
            <Tabs defaultValue={g.tabs[0]!.value}>
              <TabsList>
                {g.tabs.map((t) => (
                  <TabsTrigger key={t.value} value={t.value}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {g.tabs.map((t) => (
                <TabsContent key={t.value} value={t.value} className="mt-6">
                  <t.Component />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}

const SUPERUSER_EMAIL = "georgia.adams@smartify.co.za";

function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

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

  async function toggleAdmin(userId: string, isCurrentlyAdmin: boolean, email: string | null) {
    if (isCurrentlyAdmin && email === SUPERUSER_EMAIL) {
      toast.error("This account is locked as a permanent administrator.");
      return;
    }
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

  const q = search.trim().toLowerCase();
  const filteredUsers = q
    ? users.filter((u) => (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q))
    : users;

  return (
    <div>
      <div className="mb-3">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="overflow-hidden rounded-md border border-border">
      {filteredUsers.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">{users.length === 0 ? "No users yet." : "No users match your search."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {filteredUsers.map((u) => {
            const isUserAdmin = adminIds.has(u.id);
            const isSuperuser = u.email === SUPERUSER_EMAIL;
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
                  {isSuperuser ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-warning/40 bg-warning/10 font-normal text-warning-foreground"
                      title="This account is locked as a permanent administrator"
                    >
                      <Lock className="h-3 w-3" /> Locked admin
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => toggleAdmin(u.id, isUserAdmin, u.email)}>
                      {isUserAdmin ? "Revoke admin" : "Make admin"}
                    </Button>
                  )}
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

function TokensTab() {
  const qc = useQueryClient();
  const [issue, setIssue] = useState({ orgId: "", amount: "1" });
  const [nudge, setNudge] = useState({ orgId: "", title: "", body: "" });
  const [countryFilter, setCountryFilter] = useState("");
  const [orgSearch, setOrgSearch] = useState("");

  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organisations").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const countries = Array.from(new Set(orgs.map((o) => o.country).filter(Boolean))) as string[];
  const orgQ = orgSearch.trim().toLowerCase();
  const filteredOrgs = orgs
    .filter((o) => !countryFilter || o.country === countryFilter)
    .filter((o) => !orgQ || o.name.toLowerCase().includes(orgQ));

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
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Search</Label>
              <Input
                placeholder="Search organisations…"
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                className="h-9 w-56"
              />
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
      ...(reason ? { p_reason: reason } : {}),
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
      p_state: state as
        | "seed_only"
        | "sample_only"
        | "demo_only"
        | "licence_pending"
        | "provider_pending"
        | "quarantined"
        | "duplicate_unresolved"
        | "disputed"
        | "privacy_hold"
        | "public_search_ready"
        | "demo_ready",
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
      p_status: status as
        | "new_unassigned"
        | "triage_in_progress"
        | "more_information_needed"
        | "compliance_review_required"
        | "outreach_approved"
        | "contact_attempted"
        | "counterparty_responded"
        | "profile_verification_in_progress"
        | "ready_for_poi"
        | "closed",
      ...(note ? { p_note: note } : {}),
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
      ...(reason ? { p_reason: reason } : {}),
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
      p_outcome: outcome as
        | "converted_to_known_counterparty"
        | "ready_for_next_step"
        | "ready_for_poi_review"
        | "counterparty_declined"
        | "no_response"
        | "invalid_details"
        | "duplicate_merged"
        | "blocked_by_compliance"
        | "cancelled_by_requester"
        | "closed_by_admin"
        | "unable_to_contact",
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
      p_suggestion_type: form.type as "suggested_buyer" | "suggested_supplier" | "public_source_research_note",
      // The RPC's transaction id param is nullable in SQL but the generated type omits `| null` —
      // a known Supabase type-gen gap for nullable params without a default.
      p_related_transaction_id: (form.transactionId || null) as unknown as string,
      p_suggested_name: form.name,
      p_summary: form.summary,
      p_confidence: form.confidence as "low" | "medium" | "high",
      p_source_summary: form.sourceSummary,
      p_reason: form.reason,
      ...(form.sourceReferences ? { p_source_references: form.sourceReferences } : {}),
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
      p_reason: reason as
        | "duplicate"
        | "weak_source"
        | "wrong_jurisdiction"
        | "poor_counterparty_fit"
        | "compliance_concern"
        | "insufficient_evidence"
        | "already_known"
        | "not_commercially_useful"
        | "other",
      ...(note ? { p_note: note } : {}),
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

function EvidencePackPanel({
  sourceType,
  id,
}: {
  sourceType: "compliance_case" | "funder_release";
  id: string;
}) {
  const qc = useQueryClient();
  const issue = useServerFn(issueEvidencePack);
  const download = useServerFn(downloadEvidencePack);
  const [busy, setBusy] = useState(false);

  const { data: packs = [] } = useQuery({
    queryKey: ["evidence-packs", sourceType, id],
    queryFn: async () => {
      const column = sourceType === "compliance_case" ? "compliance_case_id" : "funder_release_id";
      const { data, error } = await supabase
        .from("evidence_packs")
        .select("*")
        .eq(column, id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleIssue(supersedesPackId?: string) {
    setBusy(true);
    try {
      await issue({ data: { sourceType, id, ...(supersedesPackId ? { supersedesPackId } : {}) } });
      toast.success("Evidence pack issued");
      await qc.invalidateQueries({ queryKey: ["evidence-packs", sourceType, id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(packId: string) {
    try {
      const { url } = await download({ data: { packId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleRevoke(packId: string) {
    const reason = window.prompt("Revocation reason (required) — the original stays preserved, never edited:");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_revoke_evidence_pack", { p_id: packId, p_reason: reason });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pack revoked");
    await qc.invalidateQueries({ queryKey: ["evidence-packs", sourceType, id] });
  }

  const activePack = packs.find((p) => !p.revoked_at);

  return (
    <div className="mt-2 rounded-md bg-muted/40 p-2.5 text-xs">
      <p className="font-medium text-muted-foreground">Evidence pack</p>
      {packs.length === 0 ? (
        <Button size="sm" variant="outline" className="mt-1.5" disabled={busy} onClick={() => handleIssue()}>
          Issue evidence pack
        </Button>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {packs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-1.5">
              <span>
                {p.pack_version} · {p.sha256_hash.slice(0, 12)}… · issued {new Date(p.issued_at).toLocaleDateString()}
              </span>
              {p.revoked_at ? (
                <Badge variant="secondary" className="font-normal">
                  revoked
                </Badge>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(p.id)}>
                    Download
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRevoke(p.id)}>
                    Revoke
                  </Button>
                </>
              )}
            </li>
          ))}
          {!activePack && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleIssue(packs[0]?.id)}>
              Issue replacement pack
            </Button>
          )}
        </ul>
      )}
    </div>
  );
}

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
      p_case_type: form.caseType as "kyc_review" | "aml_alert" | "counterparty_dispute" | "transaction_review" | "other",
      p_title: form.title,
      p_summary: form.summary,
      p_priority: form.priority as "low" | "medium" | "high" | "urgent",
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
      p_decision: decision as "approve" | "reject" | "no_action",
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
    const note = window.prompt("Note (optional):");
    const { error } = await supabase.rpc("admin_case_approve_decision", {
      p_id: id,
      ...(note ? { p_note: note } : {}),
    });
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
                      {["closed_approved", "closed_rejected", "closed_no_action"].includes(c.status) && (
                        <EvidencePackPanel sourceType="compliance_case" id={c.id} />
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

const RELEASE_FIELDS = [
  "legal_name",
  "trading_name",
  "registration_number",
  "country_of_incorporation",
  "role_in_transaction",
  "verified_status",
  "business_contact",
] as const;

function FundersTab() {
  const qc = useQueryClient();
  const [newOrgName, setNewOrgName] = useState("");
  const [memberForm, setMemberForm] = useState({ funderOrgId: "", email: "", funderRole: "funder_user" });
  const [releaseForm, setReleaseForm] = useState({
    funderOrgId: "",
    counterpartyId: "",
    fields: [] as string[],
    consentBasis: "",
    reason: "",
    expiryDays: "30",
    permissions: "view",
    verifiedStatus: "",
    riskBand: "",
  });

  const { data: funderOrgs = [] } = useQuery({
    queryKey: ["admin-funder-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funder_orgs").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: releases = [] } = useQuery({
    queryKey: ["admin-funder-releases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funder_releases")
        .select("*, counterparties(name), funder_orgs(name)")
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

  async function refreshOrgs() {
    await qc.invalidateQueries({ queryKey: ["admin-funder-orgs"] });
  }
  async function refreshReleases() {
    await qc.invalidateQueries({ queryKey: ["admin-funder-releases"] });
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    const { error } = await supabase.rpc("admin_funder_create_org", { p_name: newOrgName });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Funder org created");
    setNewOrgName("");
    await refreshOrgs();
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberForm.funderOrgId || !memberForm.email.trim()) {
      toast.error("Select a funder org and enter the user's email.");
      return;
    }
    const { data: profileRow, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", memberForm.email.trim())
      .maybeSingle();
    if (lookupError) {
      toast.error(lookupError.message);
      return;
    }
    if (!profileRow) {
      toast.error("No user found with that email — they must sign up first.");
      return;
    }
    const { error } = await supabase.rpc("admin_funder_add_member", {
      p_funder_org_id: memberForm.funderOrgId,
      p_user_id: profileRow.id,
      p_funder_role: memberForm.funderRole,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Funder member added");
    setMemberForm({ funderOrgId: "", email: "", funderRole: "funder_user" });
  }

  async function createRelease(e: React.FormEvent) {
    e.preventDefault();
    if (!releaseForm.funderOrgId || !releaseForm.counterpartyId || releaseForm.fields.length === 0) {
      toast.error("Funder org, counterparty and at least one field are required.");
      return;
    }
    if (!releaseForm.consentBasis.trim() || !releaseForm.reason.trim()) {
      toast.error("Consent basis and reason are required.");
      return;
    }
    const fieldsObj = Object.fromEntries(releaseForm.fields.map((f) => [f, true]));
    const summary: Record<string, string> = {};
    if (releaseForm.verifiedStatus.trim()) summary["verification_status"] = releaseForm.verifiedStatus.trim();
    if (releaseForm.riskBand.trim()) summary["risk_band"] = releaseForm.riskBand.trim();
    const expiry = new Date(Date.now() + Number(releaseForm.expiryDays) * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.rpc("admin_funder_create_release", {
      p_funder_org_id: releaseForm.funderOrgId,
      p_counterparty_id: releaseForm.counterpartyId,
      p_released_fields: fieldsObj,
      p_consent_basis: releaseForm.consentBasis,
      p_reason: releaseForm.reason,
      p_expiry: expiry,
      p_compliance_summary: summary,
      p_permissions: releaseForm.permissions as "view" | "view_and_download",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Release created");
    setReleaseForm({
      funderOrgId: "",
      counterpartyId: "",
      fields: [],
      consentBasis: "",
      reason: "",
      expiryDays: "30",
      permissions: "view",
      verifiedStatus: "",
      riskBand: "",
    });
    await refreshReleases();
  }

  async function revokeRelease(id: string) {
    const reason = window.prompt("Revocation reason (required):");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_funder_revoke_release", { p_id: id, p_reason: reason });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Release revoked");
    await refreshReleases();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        Counterparty information is hidden from every funder until it is explicitly released here,
        field by field. There is no "release everything" shortcut. Funders can never see another
        funder's deals or anything outside their own workspace.
      </div>

      <div>
        <h2 className="text-sm font-semibold">Funder organisations</h2>
        <form onSubmit={createOrg} className="mt-2 flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label>New funder org name</Label>
            <Input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
          </div>
          <Button type="submit" size="sm">
            Create
          </Button>
        </form>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {funderOrgs.map((o) => (
            <Badge key={o.id} variant="secondary" className="font-normal">
              {o.name}
            </Badge>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Add a funder org member</h2>
        <form onSubmit={addMember} className="mt-2 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Funder org</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={memberForm.funderOrgId}
              onChange={(e) => setMemberForm({ ...memberForm, funderOrgId: e.target.value })}
            >
              <option value="">— select —</option>
              {funderOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Funder-side role</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={memberForm.funderRole}
              onChange={(e) => setMemberForm({ ...memberForm, funderRole: e.target.value })}
            >
              <option value="funder_user">Funder user</option>
              <option value="funder_admin">Funder admin (own org only)</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>User email (must already have an Izenzo account)</Label>
            <Input value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} />
          </div>
          <div className="sm:col-span-2 text-right">
            <Button type="submit" size="sm">
              Add member
            </Button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Release counterparty information</h2>
        <form onSubmit={createRelease} className="mt-2 space-y-3 rounded-md border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Funder org</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={releaseForm.funderOrgId}
                onChange={(e) => setReleaseForm({ ...releaseForm, funderOrgId: e.target.value })}
              >
                <option value="">— select —</option>
                {funderOrgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Counterparty</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={releaseForm.counterpartyId}
                onChange={(e) => setReleaseForm({ ...releaseForm, counterpartyId: e.target.value })}
              >
                <option value="">— select —</option>
                {cpOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>Fields to release (explicit, minimum necessary only)</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {RELEASE_FIELDS.map((f) => (
                <label key={f} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={releaseForm.fields.includes(f)}
                    onChange={(e) =>
                      setReleaseForm({
                        ...releaseForm,
                        fields: e.target.checked
                          ? [...releaseForm.fields, f]
                          : releaseForm.fields.filter((x) => x !== f),
                      })
                    }
                  />
                  {f.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Verified status (compliance summary, optional)</Label>
              <Input
                value={releaseForm.verifiedStatus}
                onChange={(e) => setReleaseForm({ ...releaseForm, verifiedStatus: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Risk band (compliance summary, optional)</Label>
              <Input
                value={releaseForm.riskBand}
                onChange={(e) => setReleaseForm({ ...releaseForm, riskBand: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Permissions</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={releaseForm.permissions}
                onChange={(e) => setReleaseForm({ ...releaseForm, permissions: e.target.value })}
              >
                <option value="view">View only</option>
                <option value="view_and_download">View and download</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Expiry (days from now)</Label>
              <Input
                type="number"
                min={1}
                value={releaseForm.expiryDays}
                onChange={(e) => setReleaseForm({ ...releaseForm, expiryDays: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Consent basis</Label>
              <Input
                value={releaseForm.consentBasis}
                onChange={(e) => setReleaseForm({ ...releaseForm, consentBasis: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={releaseForm.reason} onChange={(e) => setReleaseForm({ ...releaseForm, reason: e.target.value })} />
            </div>
          </div>

          <div className="text-right">
            <Button type="submit" size="sm">
              Create release
            </Button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Active and past releases</h2>
        {releases.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No releases yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {releases.map((r) => {
              const cpName = (r as { counterparties?: { name?: string } | null }).counterparties?.name;
              const orgName = (r as { funder_orgs?: { name?: string } | null }).funder_orgs?.name;
              const expired = new Date(r.expiry).getTime() < Date.now();
              return (
                <li key={r.id} className="rounded-md border border-border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{orgName}</span> ← {cpName} · expires{" "}
                      {new Date(r.expiry).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {r.revoked_at ? (
                        <Badge variant="secondary" className="font-normal">
                          revoked
                        </Badge>
                      ) : expired ? (
                        <Badge variant="secondary" className="font-normal">
                          expired
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="outline" className="font-normal">
                            active
                          </Badge>
                          <Button size="sm" variant="ghost" onClick={() => revokeRelease(r.id)}>
                            Revoke
                          </Button>
                        </>
                      )}
                    </span>
                  </div>
                  {!r.revoked_at && !expired && r.permissions === "view_and_download" && (
                    <EvidencePackPanel sourceType="funder_release" id={r.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

const API_SCOPES = [
  "api:status_read",
  "counterparty:lookup",
  "counterparty:summary_read",
  "usage:read",
  "webhook:test",
  "webhook:events_read",
] as const;

const GATEWAY_URL = "https://<project-ref>.functions.supabase.co/api-gateway";

function ApiKeysTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    orgId: "",
    environment: "sandbox",
    name: "",
    scopes: [...API_SCOPES] as string[],
    commercialOwner: "",
    complianceOwner: "",
  });
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  const { data: keys = [] } = useQuery({
    queryKey: ["admin-api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*, organisations(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orgOptions = [] } = useQuery({
    queryKey: ["admin-org-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organisations").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-api-keys"] });
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!form.orgId || !form.name.trim()) {
      toast.error("Org and key name are required.");
      return;
    }
    const { data, error } = await supabase.rpc("admin_api_create_key", {
      p_org_id: form.orgId,
      p_environment: form.environment as "sandbox" | "production",
      p_name: form.name,
      p_scopes: form.scopes,
      ...(form.commercialOwner ? { p_commercial_owner: form.commercialOwner } : {}),
      ...(form.complianceOwner ? { p_compliance_owner: form.complianceOwner } : {}),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setIssuedKey(row?.raw_key ?? null);
    toast.success("Key created — copy it now, it will not be shown again");
    setForm({ orgId: "", environment: "sandbox", name: "", scopes: [...API_SCOPES], commercialOwner: "", complianceOwner: "" });
    await refresh();
  }

  async function suspend(id: string) {
    const { error } = await supabase.rpc("admin_api_suspend_key", { p_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Key suspended");
    await refresh();
  }

  async function reactivate(id: string) {
    const { error } = await supabase.rpc("admin_api_reactivate_key", { p_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Key reactivated");
    await refresh();
  }

  async function revoke(id: string) {
    const reason = window.prompt("Revocation reason (required):");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_api_revoke_key", { p_id: id, p_reason: reason });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Key revoked");
    await refresh();
  }

  async function rotate(id: string) {
    const { data, error } = await supabase.rpc("admin_api_rotate_key", { p_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setIssuedKey(row?.raw_key ?? null);
    toast.success("Key rotated — copy the new key now, it will not be shown again");
    await refresh();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        Only platform admins can create, suspend, revoke or rotate API keys. A production key
        requires a named commercial owner and compliance owner. Sandbox keys expire in 90 days,
        production in 12 months — there are no perpetual keys. Gateway base:{" "}
        <code className="rounded bg-black/10 px-1">{GATEWAY_URL}/&lt;sandbox|production&gt;/v1/...</code>
      </div>

      {issuedKey && (
        <div className="rounded-md border border-info/40 bg-info/10 p-3 text-sm">
          <p className="font-medium">Copy this key now — it will not be shown again:</p>
          <code className="mt-1 block break-all rounded bg-black/10 p-2 text-xs">{issuedKey}</code>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setIssuedKey(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold">Issue a new key</h2>
        <form onSubmit={createKey} className="mt-2 space-y-3 rounded-md border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Client org</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.orgId}
                onChange={(e) => setForm({ ...form, orgId: e.target.value })}
              >
                <option value="">— select —</option>
                {orgOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.environment}
                onChange={(e) => setForm({ ...form, environment: e.target.value })}
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Key name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Scopes</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {API_SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={form.scopes.includes(s)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        scopes: e.target.checked ? [...form.scopes, s] : form.scopes.filter((x) => x !== s),
                      })
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {form.environment === "production" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Commercial owner (required for production)</Label>
                <Input
                  value={form.commercialOwner}
                  onChange={(e) => setForm({ ...form, commercialOwner: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Compliance owner (required for production)</Label>
                <Input
                  value={form.complianceOwner}
                  onChange={(e) => setForm({ ...form, complianceOwner: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="text-right">
            <Button type="submit" size="sm">
              Create key
            </Button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Keys</h2>
        {keys.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No keys yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {keys.map((k) => {
              const orgName = (k as { organisations?: { name?: string } | null }).organisations?.name;
              return (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-xs">
                  <span>
                    <span className="font-medium">{k.name}</span> ({orgName}) ·{" "}
                    <code className="rounded bg-muted px-1">{k.key_prefix}…</code> · {k.environment} · expires{" "}
                    {new Date(k.expires_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge variant={k.status === "active" ? "outline" : "secondary"} className="font-normal">
                      {k.status}
                    </Badge>
                    {k.status === "active" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => suspend(k.id)}>
                          Suspend
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => rotate(k.id)}>
                          Rotate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}>
                          Revoke
                        </Button>
                      </>
                    )}
                    {k.status === "suspended" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => reactivate(k.id)}>
                          Reactivate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}>
                          Revoke
                        </Button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

const TICKET_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_customer: "Waiting on customer",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

function SupportTab() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyVisibility, setReplyVisibility] = useState<"customer" | "internal">("customer");
  const [ticketSearch, setTicketSearch] = useState("");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, organisations(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-support-ticket-messages", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", selectedId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: channelSettings } = useQuery({
    queryKey: ["admin-notification-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .in("key", ["sms_channel", "whatsapp_channel"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    if (selectedId) await qc.invalidateQueries({ queryKey: ["admin-support-ticket-messages", selectedId] });
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    const { error } = await supabase.rpc("support_agent_reply", {
      p_ticket_id: selectedId,
      p_body: reply,
      p_visibility: replyVisibility,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReply("");
    toast.success(replyVisibility === "internal" ? "Internal note added" : "Reply sent to customer");
    await refresh();
  }

  async function assignToMe(id: string) {
    if (!profile) return;
    const { error } = await supabase.rpc("support_assign", { p_ticket_id: id, p_agent_id: profile.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assigned to you");
    await refresh();
  }

  async function escalate(id: string) {
    const reason = window.prompt("Escalation reason (required):");
    if (!reason) return;
    const { error } = await supabase.rpc("support_escalate", { p_ticket_id: id, p_reason: reason });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Escalated to engineer on call");
    await refresh();
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.rpc("support_set_status", {
      p_ticket_id: id,
      p_status: status as "open" | "in_progress" | "waiting_on_customer" | "escalated" | "resolved" | "closed",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status updated");
    await refresh();
  }

  function exportCsv() {
    const rows = [
      ["id", "org", "subject", "priority", "status", "sla_due_at", "created_at"],
      ...tickets.map((t) => [
        t.id,
        (t as { organisations?: { name?: string } | null }).organisations?.name ?? "",
        t.subject,
        t.priority,
        t.status,
        t.sla_due_at,
        t.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "support_tickets.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const selected = tickets.find((t) => t.id === selectedId);
  const ticketQ = ticketSearch.trim().toLowerCase();
  const filteredTickets = tickets.filter((t) => {
    if (!ticketQ) return true;
    const orgName = (t as { organisations?: { name?: string } | null }).organisations?.name ?? "";
    return t.subject.toLowerCase().includes(ticketQ) || orgName.toLowerCase().includes(ticketQ);
  });

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border p-3 text-sm">
        <p className="font-medium">Notification channels</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {(channelSettings ?? []).map((s) => (
            <Badge key={s.key} variant="secondary" className="font-normal">
              {s.key === "sms_channel" ? "SMS" : "WhatsApp"}: Not Configured
            </Badge>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          All notifications fall back to in-app/email. Skipped sends are audited in
          notification_skip_events. Nothing blocks or unlocks based on notification status.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Support Tickets</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by subject or org…"
            value={ticketSearch}
            onChange={(e) => setTicketSearch(e.target.value)}
            className="h-8 w-56"
          />
          <Button size="sm" variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {selected ? (
        <div className="space-y-4">
          <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
            ← Back to tickets
          </Button>
          <div className="rounded-md border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{selected.subject}</p>
                <p className="text-xs text-muted-foreground">
                  SLA due {new Date(selected.sla_due_at).toLocaleString()}
                  {new Date(selected.sla_due_at) < new Date() && !["resolved", "closed"].includes(selected.status) && (
                    <span className="ml-1 text-destructive">— breached</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="font-normal">
                  {TICKET_STATUS_LABEL[selected.status] ?? selected.status}
                </Badge>
                {!selected.assigned_agent_id && (
                  <Button size="sm" variant="outline" onClick={() => assignToMe(selected.id)}>
                    Assign to me
                  </Button>
                )}
                {selected.status !== "escalated" && (
                  <Button size="sm" variant="outline" onClick={() => escalate(selected.id)}>
                    Escalate
                  </Button>
                )}
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={selected.status}
                  onChange={(e) => setStatus(selected.id, e.target.value)}
                >
                  {Object.keys(TICKET_STATUS_LABEL).map((s) => (
                    <option key={s} value={s}>
                      {TICKET_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ul className="mt-4 space-y-3">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.visibility === "internal"
                      ? "rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
                      : "rounded-md bg-muted/40 p-3 text-sm"
                  }
                >
                  {m.visibility === "internal" && (
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warning">
                      Internal note — never visible to the customer
                    </p>
                  )}
                  <p>{m.body}</p>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={replyVisibility === "customer"}
                    onChange={() => setReplyVisibility("customer")}
                  />
                  Reply to customer
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={replyVisibility === "internal"}
                    onChange={() => setReplyVisibility("internal")}
                  />
                  Internal note
                </label>
              </div>
              <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="text-right">
                <Button size="sm" onClick={sendReply}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filteredTickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tickets.length === 0 ? "No tickets yet." : "No tickets match your search."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredTickets.map((t) => {
            const orgName = (t as { organisations?: { name?: string } | null }).organisations?.name;
            const breached = new Date(t.sla_due_at) < new Date() && !["resolved", "closed"].includes(t.status);
            return (
              <li
                key={t.id}
                className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm hover:bg-muted/40"
                onClick={() => setSelectedId(t.id)}
              >
                <span>
                  <span className="font-medium">{t.subject}</span> ({orgName}) · {t.priority}
                </span>
                <span className="flex items-center gap-1.5">
                  {breached && (
                    <Badge variant="destructive" className="font-normal">
                      SLA breached
                    </Badge>
                  )}
                  <Badge variant="outline" className="font-normal">
                    {TICKET_STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AuditorsTab() {
  const qc = useQueryClient();
  const [grantForm, setGrantForm] = useState({ email: "", purpose: "", isStanding: false, expiryDays: "30" });
  const [recordForm, setRecordForm] = useState({
    entityType: "",
    entityId: "",
    reason: "",
    legalHoldApplied: false,
    legalHoldReference: "",
    completedCorrectly: true,
    failureDetail: "",
  });
  const [findingDrafts, setFindingDrafts] = useState<Record<string, string>>({});

  const { data: grants = [] } = useQuery({
    queryKey: ["admin-auditor-grants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditor_access_grants").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["admin-forensic-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deletion_forensic_records")
        .select("*, deletion_forensic_findings(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function grantAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!grantForm.email.trim() || !grantForm.purpose.trim()) {
      toast.error("Email and purpose are required.");
      return;
    }
    const { data: profileRow, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", grantForm.email.trim())
      .maybeSingle();
    if (lookupError) {
      toast.error(lookupError.message);
      return;
    }
    if (!profileRow) {
      toast.error("No user found with that email — they must sign up first.");
      return;
    }
    const expiresAt = grantForm.isStanding
      ? null
      : new Date(Date.now() + Number(grantForm.expiryDays) * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.rpc("admin_grant_auditor_access", {
      p_auditor_id: profileRow.id,
      p_purpose: grantForm.purpose,
      p_is_standing: grantForm.isStanding,
      ...(expiresAt ? { p_expires_at: expiresAt } : {}),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Auditor access granted");
    setGrantForm({ email: "", purpose: "", isStanding: false, expiryDays: "30" });
    await qc.invalidateQueries({ queryKey: ["admin-auditor-grants"] });
  }

  async function revokeGrant(id: string) {
    const reason = window.prompt("Revocation reason (required):");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_revoke_auditor_access", { p_grant_id: id, p_reason: reason });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Access revoked");
    await qc.invalidateQueries({ queryKey: ["admin-auditor-grants"] });
  }

  async function recordDeletion(e: React.FormEvent) {
    e.preventDefault();
    if (!recordForm.entityType.trim() || !recordForm.entityId.trim() || !recordForm.reason.trim()) {
      toast.error("Entity type, entity ID and reason are required.");
      return;
    }
    const { error } = await supabase.rpc("admin_log_deletion_forensic_event", {
      p_entity_type: recordForm.entityType,
      p_entity_id: recordForm.entityId,
      p_reason: recordForm.reason,
      p_legal_hold_applied: recordForm.legalHoldApplied,
      p_completed_correctly: recordForm.completedCorrectly,
      ...(recordForm.legalHoldReference ? { p_legal_hold_reference: recordForm.legalHoldReference } : {}),
      ...(recordForm.failureDetail ? { p_failure_detail: recordForm.failureDetail } : {}),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deletion forensic record created");
    setRecordForm({
      entityType: "",
      entityId: "",
      reason: "",
      legalHoldApplied: false,
      legalHoldReference: "",
      completedCorrectly: true,
      failureDetail: "",
    });
    await qc.invalidateQueries({ queryKey: ["admin-forensic-records"] });
  }

  async function addFinding(recordId: string) {
    const finding = findingDrafts[recordId];
    if (!finding?.trim()) return;
    const { error } = await supabase.rpc("admin_add_forensic_finding", { p_record_id: recordId, p_finding: finding });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Finding added — original record left unedited");
    setFindingDrafts({ ...findingDrafts, [recordId]: "" });
    await qc.invalidateQueries({ queryKey: ["admin-forensic-records"] });
  }

  return (
    <div className="space-y-8">
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        Deletion forensic records are immutable — nothing here can ever be edited or deleted, only
        added to via a linked finding. Auditor access is either standing (designated platform
        auditors) or purpose-bound with a mandatory expiry.
      </div>

      <div>
        <h2 className="text-sm font-semibold">Grant auditor access</h2>
        <form onSubmit={grantAccess} className="mt-2 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>User email (must already have an Izenzo account)</Label>
            <Input value={grantForm.email} onChange={(e) => setGrantForm({ ...grantForm, email: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Purpose (required)</Label>
            <Input value={grantForm.purpose} onChange={(e) => setGrantForm({ ...grantForm, purpose: e.target.value })} />
          </div>
          <label className="flex items-center gap-1.5 text-xs sm:col-span-2">
            <input
              type="checkbox"
              checked={grantForm.isStanding}
              onChange={(e) => setGrantForm({ ...grantForm, isStanding: e.target.checked })}
            />
            Standing access (designated platform auditor — no expiry)
          </label>
          {!grantForm.isStanding && (
            <div className="space-y-1.5">
              <Label>Expiry (days from now)</Label>
              <Input
                type="number"
                min={1}
                value={grantForm.expiryDays}
                onChange={(e) => setGrantForm({ ...grantForm, expiryDays: e.target.value })}
              />
            </div>
          )}
          <div className="sm:col-span-2 text-right">
            <Button type="submit" size="sm">
              Grant access
            </Button>
          </div>
        </form>

        <ul className="mt-3 space-y-1.5">
          {grants.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2.5 text-xs">
              <span>
                {g.auditor_id} · {g.is_standing ? "standing" : `expires ${g.expires_at ? new Date(g.expires_at).toLocaleDateString() : "n/a"}`} · {g.purpose}
              </span>
              {g.revoked_at ? (
                <Badge variant="secondary" className="font-normal">
                  revoked
                </Badge>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => revokeGrant(g.id)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Record a deletion forensic event</h2>
        <form onSubmit={recordDeletion} className="mt-2 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Entity type</Label>
            <Input value={recordForm.entityType} onChange={(e) => setRecordForm({ ...recordForm, entityType: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Entity ID</Label>
            <Input value={recordForm.entityId} onChange={(e) => setRecordForm({ ...recordForm, entityId: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Reason</Label>
            <Textarea rows={2} value={recordForm.reason} onChange={(e) => setRecordForm({ ...recordForm, reason: e.target.value })} />
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={recordForm.legalHoldApplied}
              onChange={(e) => setRecordForm({ ...recordForm, legalHoldApplied: e.target.checked })}
            />
            Legal hold applied
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={recordForm.completedCorrectly}
              onChange={(e) => setRecordForm({ ...recordForm, completedCorrectly: e.target.checked })}
            />
            Completed correctly
          </label>
          {recordForm.legalHoldApplied && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Legal hold reference</Label>
              <Input
                value={recordForm.legalHoldReference}
                onChange={(e) => setRecordForm({ ...recordForm, legalHoldReference: e.target.value })}
              />
            </div>
          )}
          {!recordForm.completedCorrectly && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Failure detail</Label>
              <Textarea
                rows={2}
                value={recordForm.failureDetail}
                onChange={(e) => setRecordForm({ ...recordForm, failureDetail: e.target.value })}
              />
            </div>
          )}
          <div className="sm:col-span-2 text-right">
            <Button type="submit" size="sm">
              Record event
            </Button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Deletion forensic records</h2>
        {records.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No records yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {records.map((r) => {
              const findings = (r as { deletion_forensic_findings?: { id: string; finding: string }[] }).deletion_forensic_findings ?? [];
              return (
                <li key={r.id} className="rounded-md border border-border p-3 text-xs">
                  <p className="font-medium">
                    {r.entity_type} · {r.entity_id}
                  </p>
                  <p className="mt-1 text-muted-foreground">{r.reason}</p>
                  {findings.map((f) => (
                    <p key={f.id} className="mt-1 rounded bg-muted/40 p-1.5">
                      {f.finding}
                    </p>
                  ))}
                  <div className="mt-1.5 flex gap-1.5">
                    <Input
                      className="h-7 text-xs"
                      placeholder="Add a finding (never edits the original)…"
                      value={findingDrafts[r.id] ?? ""}
                      onChange={(e) => setFindingDrafts({ ...findingDrafts, [r.id]: e.target.value })}
                    />
                    <Button size="sm" variant="outline" onClick={() => addFinding(r.id)}>
                      Add
                    </Button>
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

function PaymentsTab() {
  const qc = useQueryClient();
  const [mismatchForm, setMismatchForm] = useState({ description: "", izenzoAmount: "", payfastAmount: "", evidence: "" });
  const [candidateForm, setCandidateForm] = useState({ entityType: "", entityId: "", eligibleReason: "" });

  const { data: refunds = [] } = useQuery({
    queryKey: ["admin-refund-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("refund_requests")
        .select("*, organisations(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: mismatches = [] } = useQuery({
    queryKey: ["admin-settlement-mismatches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settlement_mismatches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["admin-archive-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("archive_move_candidates")
        .select("*, archive_moves(*)")
        .order("flagged_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function refreshRefunds() {
    await qc.invalidateQueries({ queryKey: ["admin-refund-requests"] });
  }
  async function refreshMismatches() {
    await qc.invalidateQueries({ queryKey: ["admin-settlement-mismatches"] });
  }
  async function refreshCandidates() {
    await qc.invalidateQueries({ queryKey: ["admin-archive-candidates"] });
  }

  async function approveForProcessing(id: string) {
    const { error } = await supabase.rpc("admin_approve_refund_for_processing", { p_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Approved for processing — not yet complete");
    await refreshRefunds();
  }

  async function confirmComplete(id: string) {
    const method = window.prompt("Confirmation method (e.g. PayFast dashboard, bank statement):");
    if (!method) return;
    const reference = window.prompt("PayFast reference (optional):");
    const { error } = await supabase.rpc("admin_confirm_refund_complete", {
      p_id: id,
      p_confirmation_method: method,
      ...(reference ? { p_payfast_reference: reference } : {}),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Refund confirmed complete");
    await refreshRefunds();
  }

  async function rejectRefund(id: string) {
    const reason = window.prompt("Rejection reason (required):");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_reject_refund", { p_id: id, p_reason: reason });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Refund rejected");
    await refreshRefunds();
  }

  async function reportMismatch(e: React.FormEvent) {
    e.preventDefault();
    if (!mismatchForm.description.trim() || !mismatchForm.izenzoAmount || !mismatchForm.payfastAmount) {
      toast.error("Description and both amounts are required.");
      return;
    }
    const { error } = await supabase.rpc("admin_report_settlement_mismatch", {
      p_description: mismatchForm.description,
      p_izenzo_amount: Number(mismatchForm.izenzoAmount),
      p_payfast_amount: Number(mismatchForm.payfastAmount),
      ...(mismatchForm.evidence ? { p_evidence: mismatchForm.evidence } : {}),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Settlement mismatch recorded — admin review required");
    setMismatchForm({ description: "", izenzoAmount: "", payfastAmount: "", evidence: "" });
    await refreshMismatches();
  }

  async function setUnderReview(id: string) {
    const { error } = await supabase.rpc("admin_set_mismatch_under_review", { p_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked under review");
    await refreshMismatches();
  }

  async function resolveMismatch(id: string) {
    const note = window.prompt("Resolution note (required):");
    if (!note) return;
    const { error } = await supabase.rpc("admin_resolve_settlement_mismatch", { p_id: id, p_resolution_note: note });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mismatch resolved");
    await refreshMismatches();
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

  return (
    <div className="space-y-8">
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        Nothing here moves money automatically. A refund is only "complete" once a named admin
        explicitly confirms it — never inferred from approval alone. Settlement mismatches always
        require a human decision; there is no auto-refund or auto-credit path anywhere.
      </div>

      <div>
        <h2 className="text-sm font-semibold">Refund requests</h2>
        {refunds.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No refund requests yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {refunds.map((r) => {
              const orgName = (r as { organisations?: { name?: string } | null }).organisations?.name;
              return (
                <li key={r.id} className="rounded-md border border-border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{orgName}</span> · {r.currency} {r.amount} — {r.reason}
                    </span>
                    <Badge variant="outline" className="font-normal">
                      {r.status}
                    </Badge>
                  </div>
                  {r.status === "confirmed_complete" && (
                    <p className="mt-1 text-muted-foreground">
                      Confirmed via {r.confirmation_method} {r.payfast_reference ? `(ref ${r.payfast_reference})` : ""}
                    </p>
                  )}
                  {r.status === "requested" && (
                    <div className="mt-1.5 flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => approveForProcessing(r.id)}>
                        Approve for processing
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => rejectRefund(r.id)}>
                        Reject
                      </Button>
                    </div>
                  )}
                  {r.status === "approved_for_processing" && (
                    <div className="mt-1.5 flex gap-1.5">
                      <Button size="sm" onClick={() => confirmComplete(r.id)}>
                        Confirm complete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => rejectRefund(r.id)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold">Settlement mismatches</h2>
        <form onSubmit={reportMismatch} className="mt-2 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea rows={2} value={mismatchForm.description} onChange={(e) => setMismatchForm({ ...mismatchForm, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Izenzo amount</Label>
            <Input type="number" step="0.01" value={mismatchForm.izenzoAmount} onChange={(e) => setMismatchForm({ ...mismatchForm, izenzoAmount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>PayFast amount</Label>
            <Input type="number" step="0.01" value={mismatchForm.payfastAmount} onChange={(e) => setMismatchForm({ ...mismatchForm, payfastAmount: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Evidence (optional)</Label>
            <Textarea rows={2} value={mismatchForm.evidence} onChange={(e) => setMismatchForm({ ...mismatchForm, evidence: e.target.value })} />
          </div>
          <div className="sm:col-span-2 text-right">
            <Button type="submit" size="sm">
              Record mismatch
            </Button>
          </div>
        </form>

        {mismatches.length > 0 && (
          <ul className="mt-3 space-y-2">
            {mismatches.map((m) => (
              <li key={m.id} className="rounded-md border border-border p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {m.description} — Izenzo {m.izenzo_amount} vs PayFast {m.payfast_amount}
                  </span>
                  <Badge variant={m.status === "resolved" ? "secondary" : "destructive"} className="font-normal">
                    {m.status}
                  </Badge>
                </div>
                {m.resolution_note && <p className="mt-1 text-muted-foreground">Resolution: {m.resolution_note}</p>}
                {m.status === "detected" && (
                  <Button size="sm" variant="outline" className="mt-1.5" onClick={() => setUnderReview(m.id)}>
                    Mark under review
                  </Button>
                )}
                {m.status === "under_review" && (
                  <Button size="sm" className="mt-1.5" onClick={() => resolveMismatch(m.id)}>
                    Resolve
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold">Cold-storage archiving</h2>
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

        {candidates.length > 0 && (
          <ul className="mt-3 space-y-2">
            {candidates.map((c) => {
              const moves = (c as { archive_moves?: { id: string; approved_at: string }[] }).archive_moves ?? [];
              const moved = moves.length > 0;
              return (
                <li key={c.id} className="rounded-md border border-border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {c.entity_type} · {c.entity_id} — {c.eligible_reason}
                    </span>
                    {moved ? (
                      <Badge variant="secondary" className="font-normal">
                        moved
                      </Badge>
                    ) : c.dismissed_at ? (
                      <Badge variant="secondary" className="font-normal">
                        dismissed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        pending
                      </Badge>
                    )}
                  </div>
                  {!moved && !c.dismissed_at && (
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
