import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroMatchCard } from "@/components/marketing/HeroMatchCard";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** The "Submit a Bid" CTA used across every Alpha-Bravo marketing page. For a signed-out
 * visitor it opens the upload-and-preview flow from the homepage hero, in a modal with a
 * light/translucent backdrop — the page stays visible behind it rather than being hidden
 * behind an opaque scrim, keeping it feeling like a quick preview rather than a context switch
 * away from the page. Someone already signed in has no need for that preview — it sends them
 * straight to their real workspace instead. */
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
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("rounded-full", fullWidth && "w-full", className)}
        onClick={() => {
          if (user) navigate({ to: "/live-deal-engine", search: { fresh: true } });
          else setOpen(true);
        }}
      >
        Submit a Bid
      </Button>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Upload Bid Proposal</DialogPrimitive.Title>
          <div className="relative">
            <HeroMatchCard className="shadow-xl" />
            <DialogPrimitive.Close className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground">
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
