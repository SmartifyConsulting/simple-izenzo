import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AuthorityToActPanel } from "@/components/verification/AuthorityToActPanel";

/** Blocks the workspace until registration's two compulsory items are on file: an ID/passport
 * number (typed, not scanned) and an Authority to Act document. Unlike the old identity-check
 * gate, this has no "do this later" — Authority to Act is compulsory, and there is no hosted
 * provider page to bounce off, so there's nothing stopping it finishing right here. */
export function RegistrationDetailsDialog({ open }: { open: boolean }) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="[&>button]:hidden"
      >
        <DialogHeader>
          <DialogTitle>Complete your registration</DialogTitle>
          <DialogDescription>
            Two things are needed before your workspace opens — nothing to scan or photograph.
          </DialogDescription>
        </DialogHeader>

        <AuthorityToActPanel />
      </DialogContent>
    </Dialog>
  );
}
