import { useNavigate, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useDealWindows } from "@/lib/dealWindows";
import { cn } from "@/lib/utils";

// Marketing/auth surfaces where a signed-in visitor could still be browsing — the workspace
// taskbar is an authenticated-app concept and has no business following them onto the hero page.
function isMarketingPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/alpha-bravo") || pathname.startsWith("/auth");
}

/** The bottom dock listing every open deal workspace, app-wide — styled like a spreadsheet's
 * sheet tabs (Excel/Google Sheets) so several bids read as a row of named tabs rather than a row
 * of pill buttons. Rendered once from the root so it persists across every authenticated page,
 * not just Live Deal Engine — but never shows on the marketing site itself. */
export function WorkspaceTaskbar() {
  const { windows, setMode, close } = useDealWindows();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // A single open workspace is just the canvas, not a "tab" — the taskbar only earns its place
  // once there's a second one to switch between.
  if (windows.length <= 1 || isMarketingPath(pathname)) return null;

  function activate(id: string, mode: string) {
    if (mode === "minimized") setMode(id, "maximized");
    void navigate({ to: "/live-deal-engine", search: id === "new" ? {} : { tx: id } });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-end gap-px overflow-x-auto border-t border-border bg-muted/60 px-2 pt-1.5 backdrop-blur">
      {windows.map((w) => {
        const active = w.mode !== "minimized";
        return (
          <div
            key={w.id}
            className={cn(
              "group relative flex shrink-0 items-center gap-2 rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-[#F59E0B] bg-[#F59E0B]/15 text-foreground shadow-[0_-1px_0_0_var(--card)_inset]"
                : "border-transparent bg-transparent text-muted-foreground hover:bg-card/50 hover:text-foreground",
            )}
          >
            <button
              type="button"
              className="max-w-[180px] truncate font-sans text-sm font-bold uppercase tracking-wide"
              onClick={() => activate(w.id, w.mode)}
              title={w.label}
            >
              {w.label}
            </button>
            <X
              className="h-3 w-3 shrink-0 cursor-pointer text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                close(w.id);
              }}
            />
            {active && (
              <span className="absolute inset-x-0 -top-px h-0.5 rounded-t bg-[#F59E0B]" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
