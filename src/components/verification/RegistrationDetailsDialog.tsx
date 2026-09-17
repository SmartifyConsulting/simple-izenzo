import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthorityToActPanel } from "@/components/verification/AuthorityToActPanel";

/** Asks for registration's two remaining items — an ID/passport number (typed, not scanned) and
 * an Authority to Act document — over the workspace the person was headed to. "Do this later"
 * returns them to the app rather than trapping them here; this only ever catches someone who
 * skipped it during sign-up (or an account that pre-dates this step), so it must not be a dead
 * end the way the old identity-check gate risked being. */
export function RegistrationDetailsDialog({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onDismiss(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete your registration</DialogTitle>
          <DialogDescription>
            Two things are needed to trade on Izenzo — nothing to scan or photograph.
          </DialogDescription>
        </DialogHeader>

        <AuthorityToActPanel onSaved={onDismiss} />

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
            Do this later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
