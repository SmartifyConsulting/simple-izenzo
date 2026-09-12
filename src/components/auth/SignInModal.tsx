import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SignInForm } from "@/components/auth/SignInForm";

/** A lighter alternative to sending someone to the standalone /auth page — used wherever signing
 * in should feel like a quick interruption rather than a navigation. SignInForm already redirects
 * to `next` (defaulting to the workspace) the moment it succeeds, so there's nothing extra to wire
 * up here to get from "signed in" to "on the workspace". */
export function SignInModal({ children, next }: { children: ReactNode; next?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="sr-only">Sign in</DialogTitle>
        <SignInForm next={next} hideFooterLink />
      </DialogContent>
    </Dialog>
  );
}
