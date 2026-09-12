import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VerificationPanel } from "@/components/verification/VerificationPanel";
import { BadgeCheck } from "lucide-react";

/** Blocks the app behind a popup (not a page navigation) until identity verification passes —
 * same pattern as VerifyEmailDialog, so the workspace the user was headed to is visible (dimmed)
 * behind it instead of them landing on a separate blank page. Closes itself automatically once
 * the parent's own polling picks up a passed check — nothing to click through. */
export function VerifyIdentityDialog({ open, verified }: { open: boolean; verified: boolean }) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="[&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Verify your identity</DialogTitle>
          <DialogDescription>
            One ID photo and a selfie — this unlocks your workspace and gives your profile a
            verified badge.
          </DialogDescription>
        </DialogHeader>

        <VerificationPanel
          checks={["id_document"]}
          title="Identity verification"
          description="Opens a hosted verification session in a new tab. The result lands back here on its own — there's nothing to fill in."
        />

        {verified && (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
            <BadgeCheck className="h-4 w-4 shrink-0" />
            Verified — taking you to your workspace…
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Having trouble? <a href="/support" className="font-medium text-foreground hover:underline">Contact support</a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
