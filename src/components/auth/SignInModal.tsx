import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AuthTabs } from "@/components/auth/AuthTabs";

/** A lighter alternative to sending someone to the standalone /auth page — used wherever signing
 * in (or up) should feel like a quick interruption rather than a navigation. AuthTabs' own forms
 * already redirect to `next` (defaulting to the workspace) the moment one succeeds, so there's
 * nothing extra to wire up here to get from "signed in" to "on the workspace". */
export function SignInModal({
  children,
  next,
  defaultTab = "signin",
  open: openProp,
  onOpenChange,
  initialSignupStep,
}: {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialSignupStep?: 1 | 2 | 3;
  next?: string | undefined;
  defaultTab?: "signin" | "signup";
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-xl">
        <DialogTitle className="sr-only">{defaultTab === "signup" ? "Create account" : "Sign in"}</DialogTitle>
        <AuthTabs next={next} defaultTab={defaultTab} initialSignupStep={initialSignupStep} />
      </DialogContent>
    </Dialog>
  );
}
