import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/** The Izenzo mark: a small rounded-square icon plus wordmark, matching the reference
 * marketing site (compliance-matching.lovable.app). `variant`/`onDark` are kept for callers
 * that pass them, but the mark now reads the same on light and dark surfaces. */
export function Logo({
  className,
}: {
  className?: string | undefined;
  onDark?: boolean | undefined;
  variant?: "white" | "blue" | undefined;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Layers className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <span className="text-base font-bold tracking-tight text-foreground">Izenzo</span>
    </span>
  );
}
