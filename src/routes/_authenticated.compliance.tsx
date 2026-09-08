import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({
    meta: [{ title: "Compliance Profile — Izenzo" }],
  }),
  component: ComplianceProfile,
});

function ComplianceProfile() {
  const { org } = useAuth();

  const fields = [
    { label: "Legal Name", value: org?.name },
    { label: "Trading As", value: null as string | null | undefined },
    { label: "Reg Number", value: org?.registration_no },
    { label: "VAT Number", value: null as string | null | undefined },
    { label: "Registered Address", value: org?.address },
    { label: "Jurisdiction", value: org?.country },
  ];
  const filledCount = fields.filter((f) => f.value).length;
  const complete = filledCount === fields.length;
  const missing = fields.length - filledCount + 2; // + UBO + evidence, always outstanding for now

  return (
    <AppShell>
      <p className="label-caps text-primary">Identity &amp; Governance</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compliance Profile</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Your institutional identity record. All counterparties verify against this file before
            bilateral signature.
          </p>
        </div>
        <Link to="/account/settings">
          <Button className="gap-2">
            Improve Profile
            <Badge variant="secondary" className="bg-background text-foreground">
              {missing}
            </Badge>
          </Button>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Go-live verification · Entity record · Active
        </span>
        <Badge
          variant="outline"
          className={complete ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/15 text-warning-foreground"}
        >
          {complete ? "COMPLETE" : "INCOMPLETE"}
        </Badge>
      </div>

      <section className="mt-6 rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Registered Identity</h2>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Statutory record</span>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {f.label}
              </p>
              <p className={f.value ? "mt-0.5 text-sm font-medium" : "mt-0.5 text-sm italic text-muted-foreground"}>
                {f.value || "Not on file"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Ownership (UBO)</h2>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Ultimate beneficial owners
          </span>
        </div>
        <div className="m-5 flex items-center justify-between gap-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
            <div>
              <p className="text-sm font-medium">No beneficial owners declared</p>
              <p className="text-xs text-muted-foreground">Declare ownership during onboarding to satisfy KYB.</p>
            </div>
          </div>
          <Link to="/account/settings">
            <Button size="sm">Declare Owners</Button>
          </Link>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Regulatory Evidence</h2>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Active licences</span>
        </div>
        <div className="m-5 flex items-center justify-between gap-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
            <div>
              <p className="text-sm font-medium">No regulatory documents uploaded</p>
              <p className="text-xs text-muted-foreground">
                Upload your registration certificate, tax clearance and KYC pack.
              </p>
            </div>
          </div>
          <Link to="/account/settings">
            <Button size="sm">Upload Documents</Button>
          </Link>
        </div>
      </section>

      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        This profile is held by the Izenzo Governance Registry under jurisdiction{" "}
        {org?.country || "—"}. Counterparties may request hash-sealed proof of any field via the
        Without a Doubt attestation endpoint.
      </p>
    </AppShell>
  );
}
