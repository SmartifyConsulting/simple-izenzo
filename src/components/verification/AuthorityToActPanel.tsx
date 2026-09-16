import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { when } from "@/lib/tx";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const EXAMPLES = [
  "A signed company resolution or board minutes naming you as the authorised representative",
  "A Power of Attorney",
  "A signed letter of authority / mandate on official company letterhead",
  "A CIPC (or equivalent companies registry) extract naming you as a director",
  "An employment contract or letter that explicitly grants trading or signing authority",
];

/** Turns a raw storage error into something a person can act on. */
function friendlyUploadError(err: unknown): string {
  const raw = (err as { message?: string })?.message ?? "";
  const msg = raw.toLowerCase();
  if (msg.includes("bucket not found")) {
    return "Document storage isn't set up yet. Please contact support.";
  }
  if (msg.includes("jwt") || msg.includes("unauthor") || msg.includes("401")) {
    return "You need to be signed in to upload this document. Sign in again and retry.";
  }
  if (msg.includes("row-level security") || msg.includes("policy") || msg.includes("403")) {
    return "You don't have permission to upload this document.";
  }
  if (msg.includes("exceeded") || msg.includes("too large") || msg.includes("413")) {
    return "That file is too large — pick one under 10 MB.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Upload failed — please check your connection and try again.";
  }
  return raw ? `Upload failed: ${raw}` : "Upload failed — please try again.";
}

/** Registration no longer scans a photo ID — it captures an ID/passport number by hand and a
 * mandatory Authority to Act document. KYC, KYB, AML and PEP screening still happen, but only
 * once, scoped to a specific deal, at the WaD gate — never here. */
export function AuthorityToActPanel({ onSaved }: { onSaved?: () => void }) {
  const { profile, refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [idType, setIdType] = useState<"id" | "passport">(profile?.id_number_type ?? "id");
  const [idNumber, setIdNumber] = useState(profile?.id_number ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAuthorityDoc = Boolean(profile?.authority_to_act_path);
  const canSave = idNumber.trim().length > 0 && hasAuthorityDoc;

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    setError(null);

    if (!ALLOWED.includes(file.type)) {
      const m = "That file type isn't supported. Use PDF, DOC/DOCX, PNG or JPG.";
      setError(m);
      toast.error(m);
      return;
    }
    if (file.size > MAX_BYTES) {
      const m = "That file is too large — pick one under 10 MB.";
      setError(m);
      toast.error(m);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `users/${profile.id}/authority-to-act-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("authority-to-act")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          authority_to_act_path: path,
          authority_to_act_name: file.name,
          authority_to_act_uploaded_at: new Date().toISOString(),
        } as never)
        .eq("id", profile.id);
      if (updateError) throw updateError;
      await refresh();
      toast.success("Authority to Act document uploaded");
    } catch (err) {
      const m = friendlyUploadError(err);
      setError(m);
      toast.error(m);
    } finally {
      setUploading(false);
    }
  }

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

        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-medium">Authority to Act document (compulsory)</p>
          <p className="text-xs text-muted-foreground">
            Proof that you're authorised to trade or sign on your organisation's behalf.
          </p>

          {hasAuthorityDoc ? (
            <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-2.5 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {profile?.authority_to_act_name ?? "Document uploaded"}
                {profile?.authority_to_act_uploaded_at
                  ? ` · ${when(profile.authority_to_act_uploaded_at)}`
                  : ""}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" /> Not uploaded yet — required.
            </div>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {hasAuthorityDoc ? "Replace document" : "Upload document"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED.join(",")}
            className="hidden"
            onChange={onUpload}
          />

          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Examples of proof of Authority to Act
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {EXAMPLES.map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
          </details>
        </div>

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
