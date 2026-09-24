import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthorityToActPanel } from "@/components/verification/AuthorityToActPanel";

/** Asks for registration's two remaining items — an ID/passport number (typed, not scanned) and the
 * one document that suits the account: an Authority to Act for a company, proof of residential
 * address for an individual.
 *
 * `blocking` is the wizard a brand-new account is walked through: it cannot be dismissed, because a
 * company that never files its Authority to Act cannot legitimately trade. Without it, the dialog is
 * the catch-up prompt for an account that predates this step (or a Google sign-up), where "Do this
 * later" must stay available so it is never a dead end. */
export function RegistrationDetailsDialog({
  open,
  onDismiss,
  blocking = false,
}: {
  open: boolean;
  onDismiss: () => void;
  blocking?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A blocking step only closes by completing it — Escape and the close button do nothing.
        if (!next && !blocking) onDismiss();
      }}
    >
      <DialogContent
        {...(blocking
          ? {
              onPointerDownOutside: (e: Event) => e.preventDefault(),
              onEscapeKeyDown: (e: KeyboardEvent) => e.preventDefault(),
            }
          : {})}
      >
        <DialogHeader>
          <DialogTitle>Complete your registration</DialogTitle>
          <DialogDescription>
            {blocking
              ? "Two things are needed before you can trade on Izenzo — nothing to scan or photograph."
              : "Two things are needed to trade on Izenzo — nothing to scan or photograph."}
          </DialogDescription>
        </DialogHeader>

        <AuthorityToActPanel onSaved={onDismiss} />

        {!blocking && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
              Do this later
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
