import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { lookupCompanySite } from "@/lib/brightdata.functions";


export const Route = createFileRoute("/_authenticated/registry")({
  head: () => ({
    meta: [
      { title: "Business Registry — Izenzo" },
      { name: "description", content: "Search companies and claim your own listing." },
    ],
  }),
  component: RegistryPage,
});

const READINESS_LABEL: Record<string, string> = {
  seed_only: "Seed-only data — used for setup and testing. Not available for live client reliance.",
  sample_only: "Sample-only data — limited demonstration record. Not production coverage.",
  demo_only: "Demo-ready — controlled demonstration data. Not production verified.",
  demo_ready: "Demo-ready — controlled demonstration data. Not production verified.",
  licence_pending: "Licence pending — display or API use is not yet approved.",
  provider_pending: "Provider pending — data or verification provider not yet approved for live use.",
  public_search_ready: "Search-ready — record may appear in search based on the approved sources shown.",
};

type RegistryCompany = {
  id: string;
  legal_name: string;
  trading_name: string | null;
  country: string;
  registration_no: string | null;
  sector: string | null;
  source_name: string | null;
  readiness_state: string;
  claimed_org_id: string | null;
};

function SiteLookup({ companyName }: { companyName: string }) {
  const runLookup = useServerFn(lookupCompanySite);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ excerpt: string; wordCount: number; note: string } | null>(
    null,
  );

  async function go() {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error("Enter the full web address, starting with https://");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await runLookup({ data: { url: trimmed, companyName } });
      setResult({ excerpt: res.excerpt, wordCount: res.wordCount, note: res.note });
      if (!res.ok) toast.error(res.note);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-md border border-border bg-muted/30 p-4">
      <div className="space-y-1.5">
        <Label htmlFor={`site-${companyName}`}>Company website</Label>
        <div className="flex gap-2">
          <Input
            id={`site-${companyName}`}
            placeholder="https://company.co.za"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button size="sm" onClick={() => void go()} disabled={busy}>
            {busy ? "Reading…" : "Read site"}
          </Button>
        </div>
      </div>
      {result && (
        <div className="text-xs text-muted-foreground">
          {result.excerpt ? (
            <>
              <p className="mb-1 font-medium text-foreground">
                What the site says ({result.wordCount} words read)
              </p>
              <p>{result.excerpt}</p>
              <p className="mt-2">
                This is read straight from the company&apos;s own site for your review. Nothing is
                saved to the registry record.
              </p>
            </>
          ) : (
            <p>{result.note}</p>
          )}
        </div>
      )}
    </div>
  );
}

function RegistryPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState<string | null>(null);
  const [form, setForm] = useState({ role: "director", note: "", evidenceUrl: "" });
  const [busy, setBusy] = useState(false);


  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["registry-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registry_companies")
        .select("*")
        .order("legal_name");
      if (error) throw error;
      return (data ?? []) as RegistryCompany[];
    },
  });

  const filtered = companies.filter((c) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return c.legal_name.toLowerCase().includes(q) || (c.trading_name ?? "").toLowerCase().includes(q);
  });

  async function submitClaim(companyId: string) {
    if (!profile) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("registry_claims").insert({
        company_id: companyId,
        claimant_id: profile.id,
        claimant_role: form.role,
        evidence_note: form.note || null,
        evidence_url: form.evidenceUrl || null,
      });
      if (error) throw error;
      toast.success("Claim submitted for review");
      setClaimingId(null);
      setForm({ role: "director", note: "", evidenceUrl: "" });
      await qc.invalidateQueries({ queryKey: ["registry-companies"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Business Registry" description="Search companies and claim your own listing">
      <div className="max-w-xl">
        <Label htmlFor="registry-search">Search</Label>
        <Input
          id="registry-search"
          className="mt-1.5"
          placeholder="Company name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-border">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No matching company found in the currently searchable registry.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{c.legal_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.country} · {c.sector ?? "—"}
                      {c.registration_no ? ` · ${c.registration_no}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {READINESS_LABEL[c.readiness_state] ?? c.readiness_state}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.claimed_org_id ? (
                      <Badge variant="secondary" className="font-normal">
                        Claimed
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setClaimingId(claimingId === c.id ? null : c.id)}
                      >
                        Claim this company
                      </Button>
                    )}
                  </div>
                </div>

                {claimingId === c.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitClaim(c.id);
                    }}
                    className="mt-4 space-y-3 rounded-md border border-border bg-muted/30 p-4"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor={`role-${c.id}`}>Your role</Label>
                      <select
                        id={`role-${c.id}`}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                      >
                        <option value="director">Director / owner / proprietor</option>
                        <option value="authorised_employee">Authorised employee</option>
                        <option value="company_secretary">Company secretary / registered agent</option>
                        <option value="adviser">Lawyer / accountant / adviser (enquiry only)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`note-${c.id}`}>Evidence note</Label>
                      <Textarea
                        id={`note-${c.id}`}
                        rows={3}
                        placeholder="Explain your role and how it can be verified (e.g. registry extract, board mandate)."
                        value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`url-${c.id}`}>Evidence link (optional)</Label>
                      <Input
                        id={`url-${c.id}`}
                        placeholder="Link to a supporting document"
                        value={form.evidenceUrl}
                        onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Claim approval does not grant bank-detail submission or API-sharing consent —
                      those require a separate authority-to-act approval.
                    </p>
                    <div className="text-right">
                      <Button type="submit" size="sm" disabled={busy}>
                        Submit claim
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
