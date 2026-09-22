import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AuthorityDocumentCard } from "@/components/verification/AuthorityDocumentCard";

/** Registration no longer scans a photo ID — it captures an ID/passport number by hand and a
 * mandatory Authority to Act document. KYC, KYB, AML and PEP screening still happen, but only
 * once, scoped to a specific deal, at the WaD gate — never here. */
export function AuthorityToActPanel({ onSaved }: { onSaved?: () => void }) {
  const { profile, refresh } = useAuth();
  const [idType, setIdType] = useState<"id" | "passport">(profile?.id_number_type ?? "id");
  const [idNumber, setIdNumber] = useState(profile?.id_number ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAuthorityDoc = Boolean(profile?.authority_to_act_path);
  const canSave = idNumber.trim().length > 0 && hasAuthorityDoc;

  async function save() {
    if (!profile || !canSave) return;
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ id_number_type: idType, id_number: idNumber.trim() } as never)
        .eq("id", profile.id);
      if (updateError) throw updateError;
      await refresh();
      toast.success("Registration details saved");
      onSaved?.();
    } catch (err) {
      const m = (err as Error).message || "Could not save — please try again.";
      setError(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="label-caps font-sans">Identity & Authority to Act</h2>
      </div>

      <div className="space-y-5 p-4">
        <p className="text-xs text-muted-foreground">
          No photo or document scan is needed here — just your ID/passport number and proof that
          you may act on your organisation's behalf. Identity, company, sanctions and PEP checks
          (KYC/KYB/AML/PEP) happen later, once, against the specific deal that needs them, at the
          Without a Doubt gate.
        </p>

        <div className="space-y-2">
          <Label>ID or passport</Label>
          <RadioGroup
            value={idType}
            onValueChange={(v) => setIdType(v as "id" | "passport")}
            className="flex items-center gap-4"
          >
            <label className="flex items-center gap-1.5 text-sm">
              <RadioGroupItem value="id" id="id-number-type-id" /> ID number
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <RadioGroupItem value="passport" id="id-number-type-passport" /> Passport number
            </label>
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="id-number">{idType === "passport" ? "Passport number" : "ID number"}</Label>
          <Input
            id="id-number"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder={idType === "passport" ? "e.g. A12345678" : "e.g. 8501015800083"}
          />
        </div>

        <AuthorityDocumentCard compulsory />

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        )}

        <Button size="sm" disabled={busy || !canSave} onClick={() => void save()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </section>
  );
}
