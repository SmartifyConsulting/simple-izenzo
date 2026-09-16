import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SignInModal } from "@/components/auth/SignInModal";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** The "Post a Trade" CTA used across every Alpha-Bravo marketing page. Signed in, it opens the
 * Live Workspace straight away. Signed out, it opens the sign-in pop-up — whose forms already
 * carry on to the Live Workspace the moment the sign-in succeeds — so this button always ends up
 * in the same place. */
export function SubmitBidButton({
  size = "default",
  variant = "default",
  className,
  fullWidth,
}: {
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline";
  className?: string;
  fullWidth?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const button = (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn("rounded-full", fullWidth && "w-full", className)}
      onClick={() => {
        if (user) navigate({ to: "/live-deal-engine", search: { fresh: true } });
      }}
    >
      Post a Trade
    </Button>
  );

  if (user) return button;

  return (
    <SignInModal next="/live-deal-engine" defaultTab="signin">
      {button}
    </SignInModal>
  );
}
