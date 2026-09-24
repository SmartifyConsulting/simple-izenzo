import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarViewer } from "@/components/AvatarViewer";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

/** Turns a raw storage error into something a person can act on. */
function friendlyError(err: unknown): string {
  const raw = (err as { message?: string })?.message ?? "";
  const msg = raw.toLowerCase();
  if (msg.includes("bucket not found")) {
    return "Picture storage isn't set up yet. Please contact support.";
  }
  if (msg.includes("jwt") || msg.includes("unauthor") || msg.includes("401")) {
    return "You need to be signed in to change your picture. Sign in again and retry.";
  }
  if (msg.includes("row-level security") || msg.includes("policy") || msg.includes("403")) {
    return "You don't have permission to change this picture.";
  }
  if (msg.includes("exceeded") || msg.includes("too large") || msg.includes("413")) {
    return "That image is too large — pick one under 5 MB.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Upload failed — please check your connection and try again.";
  }
  return raw ? `Upload failed: ${raw}` : "Upload failed — please try again.";
}

/** Uploads to the public "avatars" bucket at <folder>/<ownerId>/<filename> and returns the public URL. */
export function AvatarUpload({
  url,
  fallback,
  folder,
  ownerId,
  onUploaded,
  size = "h-16 w-16",
}: {
  url: string | null | undefined;
  fallback: string;
  folder: "users" | "orgs";
  ownerId: string;
  onUploaded: (url: string) => void;
  size?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (!ALLOWED.includes(file.type)) {
      const m = "That file isn't a supported image. Use PNG, JPG, WEBP or GIF.";
      setError(m);
      toast.error(m);
      return;
    }
    if (file.size > MAX_BYTES) {
      const m = "That image is too large — pick one under 5 MB.";
      setError(m);
      toast.error(m);
      return;
    }

    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${folder}/${ownerId}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast.success("Image updated");
    } catch (err) {
      const m = friendlyError(err);
      setError(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  const preview = (
    <span
      className={cn(
        "group relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar text-sm font-semibold text-sidebar-foreground",
        size,
      )}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{fallback}</span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        ) : (
          <Camera className="h-4 w-4 text-white" />
        )}
      </span>
    </span>
  );

  return (
    <div className="flex items-start gap-3">
      {url ? (
        <AvatarViewer
          url={url}
          fallback={fallback}
          actions={
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="text-xs font-medium text-foreground hover:underline"
            >
              Change image
            </button>
          }
        >
          {preview}
        </AvatarViewer>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          {preview}
        </button>
      )}
      {error && (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {error}
        </p>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}
