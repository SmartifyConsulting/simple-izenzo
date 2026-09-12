import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { getOrgListing, setOrgListingPublished } from "@/lib/responderListing.functions";

/** Public directory listing switch for one organisation. Listings are on by default, so this
 * reads as an opt-out rather than an invitation. */
export function PublicListingToggle({ orgId }: { orgId: string }) {
  const read = useServerFn(getOrgListing);
  const write = useServerFn(setOrgListingPublished);
  const [published, setPublished] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    read({ data: { orgId } })
      .then((r) => live && setPublished(r.published))
      .catch(() => live && setPublished(null));
    return () => {
      live = false;
    };
  }, [orgId, read]);

  async function toggle(next: boolean) {
    setBusy(true);
    const previous = published;
    setPublished(next);
    try {
      await write({ data: { orgId, published: next } });
      toast.success(next ? "Listed in the public directory" : "Removed from the public directory");
    } catch (err) {
      setPublished(previous);
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (published === null) return null;

  return (
    <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      <Switch
        checked={published}
        disabled={busy}
        onCheckedChange={toggle}
        aria-label="Listed in the public directory"
      />
      Listed in the public directory
    </label>
  );
}
