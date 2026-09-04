import { cn } from "@/lib/utils";

/** The IZENZO wordmark. The source asset is white — on light backgrounds it sits in a
 * dark chip so it stays legible; on dark/navy backgrounds it's used directly. */
export function Logo({
  className,
  onDark = false,
}: {
  className?: string | undefined;
  onDark?: boolean | undefined;
}) {
  const img = <img src="/izenzo-logo.png" alt="Izenzo" className={cn("h-5 w-auto", className)} />;

  if (onDark) return img;

  return <span className="inline-flex items-center rounded bg-sidebar px-2.5 py-1.5">{img}</span>;
}
