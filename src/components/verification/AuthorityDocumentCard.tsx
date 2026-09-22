import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/**
 * The Authority to Act document itself: shows what's on file for the signed-in person, lets them
 * view it (a signed link — the bucket is private, readable only by its owner) and upload or
 * replace it. Shared between sign-up (`AuthorityToActPanel`, where it sits under the ID/passport
 * number, compulsory before continuing) and Account Settings (where it's just the saved document
 * on the person's profile, viewable and replaceable at any time).
 */
export function AuthorityDocumentCard({
  compulsory = false,
  onUploaded,
}: {
  /** Signup framing: says the document is required before continuing. Settings has already got
   * one on file by definition (it's mandatory at signup), so this stays false there. */
  compulsory?: boolean;
  onUploaded?: () => void;
}) {
  const { profile, refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAuthorityDoc = Boolean(profile?.authority_to_act_path);

  async function onView() {
    if (!profile?.authority_to_act_path) return;
    setViewing(true);
    setError(null);
    // Opened synchronously with the click so no popup blocker fires; pointed at the signed URL
    // once it comes back, the same pattern used for the Didit verification window.
    const tab = window.open("", "_blank", "noopener,noreferrer");
    try {
      const { data, error: signError } = await supabase.storage
        .from("authority-to-act")
        .createSignedUrl(profile.authority_to_act_path, 300);
      if (signError || !data?.signedUrl) throw signError ?? new Error("Could not open the document.");
      if (tab) tab.location.href = data.signedUrl;
      else {
        setError("Your browser blocked the new tab — allow pop-ups for this site and try again.");
        toast.error("Pop-up blocked — allow pop-ups for this site and try again.");
      }
    } catch (err) {
      tab?.close();
      const m = (err as Error).message || "Could not open the document.";
      setError(m);
      toast.error(m);
    } finally {
      setViewing(false);
    }
  }

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
      toast.success("Authority to Act document saved");
      onUploaded?.();
    } catch (err) {
      const m = friendlyUploadError(err);
      setError(m);
      toast.error(m);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs font-medium">
        Authority to Act document{compulsory ? " (compulsory)" : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        Proof that you're authorised to trade or sign on your organisation's behalf.
      </p>

      {hasAuthorityDoc ? (
        <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-2.5 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {profile?.authority_to_act_name ?? "Document uploaded"}
            {profile?.authority_to_act_uploaded_at ? ` · ${when(profile.authority_to_act_uploaded_at)}` : ""}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning-foreground">
          <FileText className="h-3.5 w-3.5 shrink-0" /> Not uploaded yet{compulsory ? " — required." : "."}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {hasAuthorityDoc && (
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={viewing} onClick={() => void onView()}>
            {viewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
            View document
          </Button>
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
      </div>
      <input ref={inputRef} type="file" accept={ALLOWED.join(",")} className="hidden" onChange={onUpload} />

      <details className="mt-1 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Examples of proof of Authority to Act</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {EXAMPLES.map((example) => (
            <li key={example}>{example}</li>
          ))}
        </ul>
      </details>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
