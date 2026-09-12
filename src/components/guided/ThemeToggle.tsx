import { Moon, Sun } from "lucide-react";
import { useStylePreset } from "@/lib/stylePreset";
import { cn } from "@/lib/utils";

/** Standalone light/dark switch that lives in the top-right of every header, next to the profile
 * avatar (it used to be buried inside the avatar menu). */
export function ThemeToggle({ className }: { className?: string }) {
  const [preset, setPreset] = useStylePreset();
  const isLight = preset === "cream";
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      onClick={() => setPreset(isLight ? "black" : "cream")}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground/80 transition-colors hover:text-primary",
        className,
      )}
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
