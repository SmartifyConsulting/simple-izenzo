import { type ReactNode, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Click any avatar to open it enlarged. Wraps whatever avatar element is passed in. */
export function AvatarViewer({
  url,
  name,
  fallback,
  children,
  className,
  actions,
}: {
  url?: string | null;
  name?: string | null;
  fallback?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const initials = (fallback ?? name ?? "?").slice(0, 2).toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={name ? `View ${name}'s picture` : "View picture"}
        className={cn("rounded-full transition-opacity hover:opacity-80", className)}
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-sm font-medium">{name ?? "Profile picture"}</DialogTitle>
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="flex h-56 w-56 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-4xl font-semibold text-muted-foreground">
              {url ? (
                <img src={url} alt={name ?? "Profile picture"} className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            {actions}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
