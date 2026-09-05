import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${folder}/${ownerId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast.success("Image updated");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
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
      </button>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-xs font-medium text-foreground hover:underline"
        >
          {url ? "Change image" : "Upload image"}
        </button>
        <p className="text-xs text-muted-foreground">PNG or JPG, up to a few MB.</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}
