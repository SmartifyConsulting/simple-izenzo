import { Maximize2, Minus, Square, X } from "lucide-react";
import { useDealWindows } from "@/lib/dealWindows";
import { cn } from "@/lib/utils";

/** The bottom dock listing every open deal workspace, app-wide — lets someone work several bids
 * at once and switch between them like taskbar entries, rather than losing one the moment they
 * navigate to another. Rendered once from AppShell so it persists across every authenticated
 * page, not just Live Deal Engine. */
export function WorkspaceTaskbar() {
  const { windows, setMode, close } = useDealWindows();
  if (windows.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-border bg-card/95 px-3 py-2 backdrop-blur">
      {windows.map((w) => (
        <div
          key={w.id}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
            w.mode === "minimized"
              ? "border-border text-muted-foreground hover:text-foreground"
              : "border-primary/50 bg-primary/10 text-primary",
          )}
        >
          <button
            type="button"
            className="max-w-[160px] truncate"
            onClick={() => setMode(w.id, w.mode === "minimized" ? "docked" : "minimized")}
            title={w.mode === "minimized" ? "Restore" : "Minimize"}
          >
            {w.label}
          </button>
          {w.mode === "minimized" ? (
            <Square className="h-3 w-3 shrink-0" onClick={() => setMode(w.id, "docked")} />
          ) : (
            <Minus
              className="h-3.5 w-3.5 shrink-0 cursor-pointer"
              onClick={() => setMode(w.id, "minimized")}
            />
          )}
          <Maximize2
            className="h-3 w-3 shrink-0 cursor-pointer"
            onClick={() => setMode(w.id, "maximized")}
          />
          <X className="h-3.5 w-3.5 shrink-0 cursor-pointer" onClick={() => close(w.id)} />
        </div>
      ))}
    </div>
  );
}
