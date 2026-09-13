import { useEffect, useState } from "react";
import { BadgeCheck, Building2, ChevronDown, ShieldAlert, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type OrgDetail = {
  name: string | null;
  registration_no: string | null;
  country: string | null;
  address: string | null;
  sector: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
};

/** Who submitted this deal, and whether they were verified through the app.
 * The badge is only shown when a completed, approved identity check exists — never as a default.
 * A registration number on file means the org registered as a company; without one it's an
 * individual trading in their own name — a small building/person icon in front of the name says
 * which (instead of a pill, which would take more room than the distinction is worth), and it
 * expands to the same address/contact/sector detail either way. */
export function SubmitterIdentity({ orgId, createdBy }: { orgId: string; createdBy?: string | null }) {
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [{ data: orgRow }, { data: profile }] = await Promise.all([
        supabase
          .from("organisations")
          .select("name, registration_no, country, address, sector, primary_contact_name, primary_contact_email")
          .eq("id", orgId)
          .maybeSingle(),
        createdBy
          ? supabase.from("profiles").select("full_name, last_name").eq("id", createdBy).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!live) return;
      setOrg((orgRow as OrgDetail | null) ?? null);
      setPersonName(
        profile ? [profile.full_name, profile.last_name].filter(Boolean).join(" ").trim() || null : null,
      );

      const { data: checks } = await supabase
        .from("identity_verifications")
        .select("decision, status")
        .eq("subject_org_id", orgId)
        .eq("status", "passed")
        .limit(5);
      if (!live) return;
      setVerified((checks ?? []).some((c) => ["approved", "pass", "clear"].includes(String(c.decision))));
    })();
    return () => {
      live = false;
    };
  }, [orgId, createdBy]);

  const name = org?.name || personName;
  if (!name) return null;

  const isBusiness = Boolean(org?.registration_no);
  const hasDetail = Boolean(
    org?.address || org?.sector || org?.primary_contact_name || org?.primary_contact_email || org?.country,
  );

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        disabled={!hasDetail}
        aria-expanded={expanded}
        className={cn(
          "flex min-w-0 items-center gap-2 text-left",
          hasDetail && "cursor-pointer",
          !hasDetail && "cursor-default",
        )}
      >
        {isBusiness ? (
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Business" />
        ) : (
          <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Individual" />
        )}
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{name}</span>
        {verified ? (
          <span
            title="Verified through Izenzo"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary"
          >
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            Verified
          </span>
        ) : (
          <span
            title="Identity not yet verified through Izenzo"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            Not verified
          </span>
        )}
        {hasDetail && (
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        )}
      </button>

      {expanded && hasDetail && (
        <div className="mt-1.5 space-y-0.5 rounded-lg bg-muted/30 p-2.5 text-xs text-muted-foreground">
          {org?.sector && <p>Sector: {org.sector}</p>}
          {org?.address && <p>Address: {org.address}</p>}
          {org?.country && <p>Country: {org.country}</p>}
          {org?.primary_contact_name && <p>Contact: {org.primary_contact_name}</p>}
          {org?.primary_contact_email && <p>Email: {org.primary_contact_email}</p>}
        </div>
      )}
    </div>
  );
}
