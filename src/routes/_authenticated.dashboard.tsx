import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, LayoutGrid, List } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { CanvasStart, DealCanvas } from "@/components/canvas/DealCanvas";
import { TradesListView } from "@/components/trades/TradesListView";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Transaction } from "@/lib/tx";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Izenzo" },
      { name: "description", content: "Your live deal canvas on the Izenzo Trading Gateway." },
      { property: "og:title", content: "Dashboard — Izenzo" },
      { property: "og:description", content: "Your live deal canvas on the Izenzo Trading Gateway." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { org } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"canvas" | "list">("canvas");

  const { data: txs = [], isLoading, refetch } = useQuery({
    queryKey: ["transactions", org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  const activeTx = useMemo(() => {
    if (selectedId) {
      const picked = txs.find((t) => t.id === selectedId);
      if (picked) return picked;
    }
    return txs.find((t) => t.status === "open") ?? txs[0];
  }, [txs, selectedId]);

  return (
    <AppShell
      wide
      actions={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border p-1">
            <button
              onClick={() => setView("canvas")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                view === "canvas" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Canvas
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="h-3.5 w-3.5" /> Menu
            </button>
          </div>
          <Link to="/transactions/new">
            <Button size="sm" variant="ghost" className="gap-2">
              <Plus className="h-3.5 w-3.5" /> New bid or offer
            </Button>
          </Link>
        </div>
      }
    >
      {view === "list" ? (
        <TradesListView />
      ) : (
        <>
          {isLoading && <p className="text-sm text-muted-foreground">Opening the canvas…</p>}

          {!isLoading && !activeTx && <CanvasStart />}

          {activeTx && (
            <DealCanvas
              tx={activeTx}
              deals={txs}
              onSelectDeal={setSelectedId}
              reload={() => {
                void refetch();
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
