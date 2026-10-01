import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthorityToActPanel } from "@/components/verification/AuthorityToActPanel";
import { supabase } from "@/integrations/supabase/client";

/** Asks for registration's two remaining items — an ID/passport number and the one document that
 * suits the account. It is never a dead end: the user can Save and Close (trading stays locked until
 * verification passes) or sign out and return to sign up / sign in. */
export function RegistrationDetailsDialog({
  open,
  onDismiss,
  blocking = false,
}: {
  open: boolean;
  onDismiss: () => void;
  blocking?: boolean;
}) {
  const navigate = useNavigate();

  function closeLocked() {
    toast.info("Saved. Trading stays locked until your registration document is verified.");
    onDismiss();
  }

  async function returnToAuth() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", search: { mode: "signin" } as never, replace: true });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeLocked();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete your registration</DialogTitle>
          <DialogDescription>
            Two things are needed before you can trade on Izenzo — nothing to scan or photograph.
          </DialogDescription>
        </DialogHeader>

        {blocking && (
          <p className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
            Trading actions stay locked until your document is verified. You can save and come back later.
          </p>
        )}

        <AuthorityToActPanel
          submitLabel="Save and Close"
          onSaved={onDismiss}
          onCloseWithoutDocument={closeLocked}
          onSavedWithFailure={undefined}
        />

        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void returnToAuth()}>
            Return to Sign up / Sign in
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={closeLocked}>
            Do this later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
