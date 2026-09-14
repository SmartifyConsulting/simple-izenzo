import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDealWindows } from "@/lib/dealWindows";
import { fallbackReference } from "@/lib/tx";
import { cn } from "@/lib/utils";

// Marketing/auth surfaces where a signed-in visitor could still be browsing — the workspace
// taskbar is an authenticated-app concept and has no business following them onto the hero page.
function isMarketingPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/alpha-bravo") ||
    pathname.startsWith("/auth")
  );
}

/** Finds an existing bid or offer by its reference or by a keyword in its name, and opens it. */
function DealSearchDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where a chosen bid should be opened — the Map keeps you on the map instead of navigating. */
  onPick: (txId: string) => void;
}) {
  const { org } = useAuth();
  const { data: deals = [] } = useQuery({
    queryKey: ["searchable-deals", org?.id],
    enabled: Boolean(org?.id) && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, reference, title, commodity, created_at")
        .eq("org_id", org!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((t) => {
        const row = t as {
          id: string;
          reference: string | null;
          title: string;
          commodity: string | null;
        };
        return {
          id: row.id,
          reference: row.reference ?? fallbackReference(row.id, "bid"),
          name: row.commodity ?? row.title ?? "",
        };
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-lg">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-sm">Find a bid or offer</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Bid ID or keyword…" />
          <CommandList>
            <CommandEmpty>Nothing matches that.</CommandEmpty>
            <CommandGroup>
              {deals.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`${d.reference} ${d.name}`}
                  onSelect={() => {
                    onOpenChange(false);
                    onPick(d.id);
                  }}
                >
                  <span className="font-mono font-semibold">{d.reference}</span>
                  {d.name && <span className="text-muted-foreground"> — {d.name}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
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
  const [searchOpen, setSearchOpen] = useState(false);

  if (isMarketingPath(pathname)) return null;

  // On the Map screen the tabs drive the map itself rather than sending you off to the step list:
  // picking a bid switches which deal the diagram is showing, and New opens the empty workspace
  // beside it.
  const onMap = pathname === "/map";

  function activate(id: string, mode: string) {
    if (mode === "minimized") setMode(id, "maximized");
    if (onMap) {
      void navigate({ to: "/map", search: id === "new" ? { fresh: true } : { tx: id } });
      return;
    }
    // `fresh: 1` tells the Live Workspace to show the empty upload/search template — otherwise a
    // bare URL with no `tx` is indistinguishable from "just resume whatever was last worked on".
    void navigate({ to: "/live-deal-engine", search: id === "new" ? { fresh: true } : { tx: id } });
  }

  function openDeal(txId: string) {
    void navigate({ to: onMap ? "/map" : "/live-deal-engine", search: { tx: txId } });
  }

  // The blank template tab is permanent and always leftmost: recorded deals get their own tab, and
  // this one stays an empty workspace to start the next bid or offer in.
  const deals = windows.filter((w) => w.id !== "new");

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-end gap-1 bg-muted/60 px-2 pt-1.5 backdrop-blur">
      {/* Search + New are pinned to the far left, outside the scrollable tab strip — they stay put
          no matter how many deal tabs there are or how far the strip is scrolled. */}
      <div className="flex shrink-0 items-end gap-1">
        {/* Finding an existing bid by its id or a keyword lives here, before New. */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          title="Search bids and offers"
          aria-label="Search bids and offers"
          className="flex w-9 shrink-0 items-center justify-center rounded-t-md border border-border border-b-transparent bg-transparent px-2 py-1.5 text-muted-foreground hover:bg-card/50 hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => activate("new", "maximized")}
          title="New live workspace"
          className="flex w-[4.5rem] shrink-0 items-center justify-center gap-1 rounded-t-md border border-foreground border-b-transparent bg-foreground px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-background"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>
      <DealSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="flex items-end gap-1 overflow-x-auto">
      {deals.map((w) => {
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
    </div>
  );
}
