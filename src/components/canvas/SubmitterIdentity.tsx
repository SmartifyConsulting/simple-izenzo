import { useEffect, useState } from "react";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Who submitted this deal, and whether they were verified through the app.
 * The badge is only shown when a completed, approved identity check exists — never as a default. */
export function SubmitterIdentity({ orgId, createdBy }: { orgId: string; createdBy?: string | null }) {
  const [name, setName] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [{ data: org }, { data: profile }] = await Promise.all([
        supabase.from("organisations").select("name").eq("id", orgId).maybeSingle(),
        createdBy
          ? supabase.from("profiles").select("full_name, last_name").eq("id", createdBy).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const person = profile
        ? [profile.full_name, profile.last_name].filter(Boolean).join(" ").trim()
        : "";
      if (!live) return;
      setName(org?.name || person || null);

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

  if (!name) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-foreground">{name}</span>
      {verified ? (
        <span
          title="Verified through Izenzo"
          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary"
        >
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          Verified
        </span>
      ) : (
        <span
          title="Identity not yet verified through Izenzo"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          Not verified
        </span>
      )}
    </div>
  );
}
