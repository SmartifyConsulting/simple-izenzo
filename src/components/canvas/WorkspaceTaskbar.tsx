import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDealWindows } from "@/lib/dealWindows";
import { fallbackReference } from "@/lib/tx";
import { cancelBid } from "@/lib/cancelBid.functions";
import { cn } from "@/lib/utils";

// The bid tab strip belongs to the signed-in workspace only, so it is opt-in per screen rather
// than "everywhere except the pages we happened to list" — that older exclusion list let the tabs
// leak onto public pages (the hero included) whenever a new marketing route appeared.
const WORKSPACE_PATHS = [
  "/live-deal-engine",
  "/deal",
  "/tx",
  "/trades",
  "/inbox",
  "/discover",
  "/registry",
  "/funder",
  "/auditor",
  "/compliance",
  "/facilitation",
  "/governance",
  "/admin",
  "/activity",
  "/credits",
  "/account",
  "/guided",
  "/support",
  "/transactions",
] as const;

function isWorkspacePath(pathname: string) {
  return WORKSPACE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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
  const { windows, setMode, close, reorder, hydrate } = useDealWindows();
  const { org, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentTx = useRouterState({ select: (s) => (s.location.search as { tx?: string })?.tx });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // The tab whose close (×) button was just clicked — closing never happens instantly, since a
  // bid mid-negotiation shouldn't disappear from the taskbar without the person choosing whether
  // that also means calling it off.
  const [closeConfirm, setCloseConfirm] = useState<{ id: string; label: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const cancelBidFn = useServerFn(cancelBid);

  // The person's own bids specifically — not the whole organisation's — so the tab strip survives
  // a reload or a new device instead of only remembering what this browser session happened to
  // open, without also pulling in every colleague's deals in the same org. Cancelled bids are
  // left out.
  const { data: savedDeals } = useQuery({
    queryKey: ["taskbar-deals", org?.id, user?.id],
    enabled: Boolean(org?.id) && Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, reference, title, commodity, status, created_at")
        .eq("org_id", org!.id)
        .eq("created_by", user!.id)
        // Newest first for the limit, then flipped so the taskbar reads oldest-left/newest-right.
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? [])
        .map((t) => t as { id: string; reference: string | null; title: string | null; commodity: string | null; status: string | null })
        .filter((t) => (t.status ?? "") !== "cancelled")
        .reverse()
        .map((t) => ({
          id: t.id,
          label: t.reference ?? fallbackReference(t.id, "bid"),
          name: t.commodity ?? t.title ?? undefined,
        }));
    },
  });

  useEffect(() => {
    if (savedDeals && savedDeals.length > 0) hydrate(savedDeals);
  }, [savedDeals, hydrate]);

  /** Closing the last tab must leave a genuinely empty workspace — otherwise a later visit
   * resumes the bid that was just closed, name, bidder details and all. */
  function forgetRememberedDeal() {
    try {
      localStorage.removeItem("izenzo:active-deal");
    } catch {
      // Best-effort only.
    }
  }

  async function cancelAndClose() {
    if (!closeConfirm) return;
    setCancelling(true);
    try {
      await cancelBidFn({ data: { transactionId: closeConfirm.id } });
      await qc.invalidateQueries({ queryKey: ["my-trades"] });
      toast.success(`${closeConfirm.label} cancelled`);
      // A cancelled deal disappears from the screen outright — if it's the one currently open,
      // switch to another open tab, or a blank new workspace if that was the last one.
      const wasShowing = pathname === "/live-deal-engine" && currentTx === closeConfirm.id;
      const remaining = windows.filter((w) => w.id !== closeConfirm.id && w.id !== "new");
      close(closeConfirm.id);
      setCloseConfirm(null);
      if (remaining.length === 0) forgetRememberedDeal();
      if (wasShowing) {
        if (remaining.length > 0) {
          void navigate({ to: "/live-deal-engine", search: { tx: remaining[0]!.id } });
        } else {
          void navigate({ to: "/live-deal-engine", search: { fresh: true, n: Date.now() } });
        }
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  if (!isWorkspacePath(pathname)) return null;

  function activate(id: string, mode: string) {
    if (mode === "minimized") setMode(id, "maximized");
    // `fresh: 1` tells the Live Workspace to show the empty upload/search template — otherwise a
    // bare URL with no `tx` is indistinguishable from "just resume whatever was last worked on".
    // The nonce makes every New press a distinct address, so pressing it while already on an empty
    // workspace still resets it and issues a new BID number instead of doing nothing.
    void navigate({
      to: "/live-deal-engine",
      search: id === "new" ? { fresh: true, n: Date.now() } : { tx: id },
    });
  }

  function openDeal(txId: string) {
    void navigate({ to: "/live-deal-engine", search: { tx: txId } });
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
      <DealSearchDialog open={searchOpen} onOpenChange={setSearchOpen} onPick={openDeal} />

      <TooltipProvider delayDuration={300}>
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
                ? "border-[var(--taskbar-active-border)] border-b-transparent bg-[var(--taskbar-active-bg)] text-[var(--taskbar-active-fg)]"
                : "border-border border-b-transparent bg-white text-black hover:bg-white/90",
              draggedId === w.id && "opacity-40",
              overId === w.id && draggedId !== w.id && "border-l-2 border-l-primary",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-center font-sans text-[12px] font-bold uppercase tracking-wide"
                  onClick={() => activate(w.id, w.mode)}
                >
                  {w.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{w.name ? `${w.label} — ${w.name}` : w.label}</TooltipContent>
            </Tooltip>
            <X
              className="h-3 w-3 shrink-0 cursor-pointer text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setCloseConfirm({ id: w.id, label: w.label });
              }}
            />
          </div>
        );
      })}
      </div>
      </TooltipProvider>

      <AlertDialog open={closeConfirm !== null} onOpenChange={(open) => !open && setCloseConfirm(null)}>
        <AlertDialogContent>
          {/* Same effect as Keep it open — dismissing here just leaves the tab exactly as it was. */}
          <button
            type="button"
            onClick={() => setCloseConfirm(null)}
            aria-label="Keep the tab open"
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {closeConfirm?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing the tab saves your bid/offer. Reopen it anytime from Search or My Trades.
              Cancelling marks it as cancelled and notifies any counterparty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={cancelling}
              onClick={() => void cancelAndClose()}
            >
              {cancelling ? "Cancelling…" : "Cancel Bid"}
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (closeConfirm) {
                  const remaining = windows.filter((w) => w.id !== closeConfirm.id && w.id !== "new");
                  close(closeConfirm.id);
                  if (remaining.length === 0) {
                    forgetRememberedDeal();
                    void navigate({ to: "/live-deal-engine", search: { fresh: true, n: Date.now() } });
                  }
                }
                setCloseConfirm(null);
              }}
            >
              Save and Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
