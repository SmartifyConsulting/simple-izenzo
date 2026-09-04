import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { mapAuthError, useAuth } from "@/lib/auth";

/** Blocks the app behind a popup (not a page navigation) until the user confirms their email. */
export function VerifyEmailDialog({ open }: { open: boolean }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  async function send() {
    if (!user?.email) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/verify-email?verified=1`,
      },
    });
    setBusy(false);
    if (error) {
      const msg = mapAuthError(error.message);
      setMessage(msg);
      toast.error(msg);
      return;
    }
    setSent(true);
    toast.success("Confirmation link sent");
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="[&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Confirm your email</DialogTitle>
          <DialogDescription>
            We need to confirm {user?.email ?? "your email address"} once. Send yourself a link and
            open it on this device.
          </DialogDescription>
        </DialogHeader>

        <Button className="w-full" onClick={send} disabled={busy}>
          {sent ? "Send another link" : "Send confirmation link"}
        </Button>
        {sent && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Link sent. It opens this page and confirms you automatically.
          </p>
        )}
        {message && (
          <p aria-live="polite" className="text-sm text-destructive">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={() => void signOut().then(() => navigate({ to: "/auth", replace: true }))}
          className="text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </DialogContent>
    </Dialog>
  );
}
