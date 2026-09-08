import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { when } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/facilitation")({
  head: () => ({
    meta: [
      { title: "Unknown Counterparty — Izenzo" },
      { name: "description", content: "Request help identifying and reaching an unknown counterparty." },
    ],
  }),
  component: FacilitationPage,
});

const USER_STATUS_LABEL: Record<string, string> = {
  new_unassigned: "Received",
  triage_in_progress: "Being reviewed",
  more_information_needed: "More information required",
  compliance_review_required: "Under compliance review",
  outreach_approved: "Outreach approved",
  contact_attempted: "Contact in progress",
  counterparty_responded: "Counterparty responded",
  profile_verification_in_progress: "Verifying details",
  ready_for_poi: "Ready for next step",
  closed: "Closed",
};

const OUTCOME_LABEL: Record<string, string> = {
  converted_to_known_counterparty: "Counterparty added — ready to proceed",
  ready_for_next_step: "Ready for next step",
  ready_for_poi_review: "Ready for Proof of Intent review",
  counterparty_declined: "Counterparty declined",
  no_response: "No response received",
  invalid_details: "Details could not be confirmed",
  duplicate_merged: "Matched to an existing record",
  blocked_by_compliance: "Blocked — cannot proceed",
  cancelled_by_requester: "Cancelled",
  closed_by_admin: "Closed",
  unable_to_contact: "Unable to contact",
};

type FacilitationCase = {
  id: string;
  counterparty_name: string;
  country: string | null;
  status: string;
  final_outcome: string | null;
  created_at: string;
};

function FacilitationPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    counterpartyName: "",
    country: "",
    sector: "",
    productService: "",
    purpose: "",
    contactIdentifier: "",
    sourceEvidence: "",
    authorityConfirmed: false,
  });

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["my-facilitation-cases"],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facilitation_cases")
        .select("id, counterparty_name, country, status, final_outcome, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FacilitationCase[];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!form.counterpartyName.trim() || !form.contactIdentifier.trim() || !form.sourceEvidence.trim()) {
      toast.error("Counterparty name, a contact route and a source reference are required.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("facilitation_cases").insert({
        requester_id: profile.id,
        counterparty_name: form.counterpartyName,
        country: form.country || null,
        sector: form.sector || null,
        product_service: form.productService || null,
        purpose: form.purpose || null,
        contact_identifier: form.contactIdentifier,
        source_evidence: form.sourceEvidence,
        authority_confirmed: form.authorityConfirmed,
      });
      if (error) throw error;
      toast.success("Request submitted");
      setShowForm(false);
      setForm({
        counterpartyName: "",
        country: "",
        sector: "",
        productService: "",
        purpose: "",
        contactIdentifier: "",
        sourceEvidence: "",
        authorityConfirmed: false,
      });
      await qc.invalidateQueries({ queryKey: ["my-facilitation-cases"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Unknown Counterparty"
      description="Request help identifying and reaching a counterparty that isn't yet on Izenzo"
      actions={
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "New request"}
        </Button>
      }
    >
      {showForm && (
        <form onSubmit={submit} className="mb-6 space-y-4 rounded-md border border-border p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cp-name">Counterparty name or trading name</Label>
              <Input
                id="cp-name"
                required
                value={form.counterpartyName}
                onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-country">Country / jurisdiction (if known)</Label>
              <Input
                id="cp-country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-sector">Sector</Label>
              <Input
                id="cp-sector"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cp-product">Product or service involved</Label>
              <Input
                id="cp-product"
                value={form.productService}
                onChange={(e) => setForm({ ...form, productService: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cp-contact">Contact route (email, phone, or profile link)</Label>
              <Input
                id="cp-contact"
                required
                value={form.contactIdentifier}
                onChange={(e) => setForm({ ...form, contactIdentifier: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cp-evidence">Source or evidence for this counterparty</Label>
              <Textarea
                id="cp-evidence"
                required
                rows={2}
                placeholder="Where did you find them — introduction, website, referral, prior correspondence?"
                value={form.sourceEvidence}
                onChange={(e) => setForm({ ...form, sourceEvidence: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cp-purpose">Why they're unknown / requester explanation</Label>
              <Textarea
                id="cp-purpose"
                rows={2}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Submitting a request does not contact the counterparty, create a POI, or verify anyone.
            An Izenzo team member reviews every request before any outreach happens.
          </p>
          <div className="text-right">
            <Button type="submit" size="sm" disabled={busy}>
              Submit request
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-md border border-border">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : cases.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No unknown-counterparty requests yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {cases.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">{c.counterparty_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.country ?? "Country unknown"} · Submitted {when(c.created_at)}
                  </p>
                </div>
                <Badge variant="secondary" className="font-normal">
                  {c.status === "closed" && c.final_outcome
                    ? (OUTCOME_LABEL[c.final_outcome] ?? c.final_outcome)
                    : (USER_STATUS_LABEL[c.status] ?? c.status)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
