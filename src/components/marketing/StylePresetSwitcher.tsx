import { Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STYLE_PRESETS, useStylePreset } from "@/lib/stylePreset";
import { cn } from "@/lib/utils";

/** Lets anyone flip between the app's visual presets — cream (Alpha-Bravo), the previous black
 * Ink & Aqua look, and that same dark look with the marketing grid pattern — without needing to
 * know these are actually three independent switches (skin, theme, grid) under the hood. */
export function StylePresetSwitcher() {
  const [preset, setPreset] = useStylePreset();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
        title="Switch style"
      >
        <Palette className="h-3.5 w-3.5" />
        <span className="sr-only">Switch style</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {STYLE_PRESETS.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={cn("flex flex-col items-start gap-0.5", preset === p.id && "bg-accent")}
          >
            <span className="text-sm font-medium">{p.label}</span>
            <span className="text-xs text-muted-foreground">{p.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
