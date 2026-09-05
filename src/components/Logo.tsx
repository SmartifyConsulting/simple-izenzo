import { cn } from "@/lib/utils";

/** The IZENZO wordmark. The default source asset is white — on light backgrounds it sits in a
 * dark chip so it stays legible; on dark/navy backgrounds it's used directly. Pass `variant="blue"`
 * to use the navy wordmark directly on a light background instead (no chip). */
export function Logo({
  className,
  onDark = false,
  variant = "white",
}: {
  className?: string | undefined;
  onDark?: boolean | undefined;
  variant?: "white" | "blue" | undefined;
}) {
  const src = variant === "blue" ? "/izenzo-logo-blue.png" : "/izenzo-logo.png";
  const img = <img src={src} alt="Izenzo" className={cn("h-5 w-auto shrink-0", className)} />;

  if (onDark || variant === "blue") return img;

  return <span className="inline-flex items-center rounded bg-sidebar px-2.5 py-1.5">{img}</span>;
}
