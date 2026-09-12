import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroMatchCard } from "@/components/marketing/HeroMatchCard";
import { cn } from "@/lib/utils";

/** The "Submit a Bid" CTA used across every Alpha-Bravo marketing page. Rather than sending
 * visitors straight to sign-up, it opens the same upload-and-preview flow shown on the
 * homepage hero, in a modal with a light/translucent backdrop — the page stays visible behind
 * it rather than being hidden behind an opaque scrim, keeping it feeling like a quick preview
 * rather than a context switch away from the page. */
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
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("rounded-full", fullWidth && "w-full", className)}
        onClick={() => setOpen(true)}
      >
        Submit a Bid
      </Button>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed right-5 top-24 z-50 w-full max-w-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
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
