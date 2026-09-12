import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VerificationPanel } from "@/components/verification/VerificationPanel";
import { Button } from "@/components/ui/button";
import { BadgeCheck } from "lucide-react";

/** Asks for identity verification over the workspace the person was headed to, but never traps
 * them there: the hosted provider page refuses to display inside another site's frame, so a hard
 * gate here becomes a dead end. "Do this later" returns them to the app — the real gates (Without
 * a Doubt, party selection) still require a passed check. Closes itself once a pass lands. */
export function VerifyIdentityDialog({
  open,
  verified,
  onDismiss,
}: {
  open: boolean;
  verified: boolean;
  onDismiss?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onDismiss?.(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify your identity and company</DialogTitle>
          <DialogDescription>
            Three checks unlock your workspace: your identity (KYC), a sanctions/PEP screen
            (AML), and your company (KYB). Each opens a hosted verification session — the
            result lands back here on its own.
          </DialogDescription>
        </DialogHeader>

        <VerificationPanel
          checks={["id_document", "aml", "kyb"]}
          title="Identity, AML & KYB verification"
          description="Opens a hosted verification session in a new tab for each check. The result lands back here on its own — there's nothing to fill in."
        />

        {verified && (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
            <BadgeCheck className="h-4 w-4 shrink-0" />
            Verified — taking you to your workspace…
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Having trouble? <a href="/support" className="font-medium text-foreground hover:underline">Contact support</a>
          </p>
          <Button variant="outline" size="sm" onClick={() => onDismiss?.()}>
            Do this later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
