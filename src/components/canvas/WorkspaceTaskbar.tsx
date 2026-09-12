import { useState } from "react";
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
  const { windows, setMode, close, reorder } = useDealWindows();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // A single open workspace is just the canvas, not a "tab" — the taskbar only earns its place
  // once there's a second one to switch between.
  if (windows.length <= 1 || isMarketingPath(pathname)) return null;

  function activate(id: string, mode: string) {
    if (mode === "minimized") setMode(id, "maximized");
    // `fresh: 1` tells the Live Workspace to show the empty upload/search template — otherwise a
    // bare URL with no `tx` is indistinguishable from "just resume whatever was last worked on".
    void navigate({ to: "/live-deal-engine", search: id === "new" ? { fresh: true } : { tx: id } });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-end gap-1 overflow-x-auto border-t border-border bg-muted/60 px-2 pt-1.5 backdrop-blur">
      {windows.map((w) => {
        const active = w.mode !== "minimized";
        return (
          <div
            key={w.id}
            draggable
            onDragStart={(e) => {
              setDraggedId(w.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              if (!draggedId || draggedId === w.id) return;
              e.preventDefault();
              setOverId(w.id);
            }}
            onDragLeave={() => setOverId((id) => (id === w.id ? null : id))}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedId && draggedId !== w.id) reorder(draggedId, w.id);
              setDraggedId(null);
              setOverId(null);
            }}
            className={cn(
              "group flex w-36 shrink-0 cursor-grab items-center gap-2 rounded-t-md border px-3 py-1.5 text-xs font-medium transition-colors active:cursor-grabbing",
              active
                ? "border-[#F59E0B] border-b-transparent bg-[#F59E0B]/15 text-foreground"
                : "border-border border-b-transparent bg-transparent text-muted-foreground hover:bg-card/50 hover:text-foreground",
              draggedId === w.id && "opacity-40",
              overId === w.id && draggedId !== w.id && "border-l-2 border-l-primary",
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-center font-sans text-[12px] font-bold uppercase tracking-wide"
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
          </div>
        );
      })}
    </div>
  );
}
