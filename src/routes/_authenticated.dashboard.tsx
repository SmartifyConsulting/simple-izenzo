import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { CanvasStart, DealCanvas } from "@/components/canvas/DealCanvas";
import { DashboardSummary } from "@/components/canvas/DashboardSummary";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Transaction } from "@/lib/tx";

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
  const [creating, setCreating] = useState(false);

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

  // "New bid or offer" no longer jumps to a separate page — it shows the same first workflow
  // block (CanvasStart) that already opens automatically when there's no active deal, so starting
  // a new one never leaves the deal canvas.
  const showStart = !isLoading && (!activeTx || creating);

  return (
    <AppShell
      wide
      actions={
        <Button
          size="sm"
          variant="ghost"
          className="gap-2"
          onClick={() => {
            setSelectedId(null);
            setCreating(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" /> New bid or offer
        </Button>
      }
    >
      {isLoading && <p className="text-sm text-muted-foreground">Opening the canvas…</p>}

      {!isLoading && <DashboardSummary txs={txs} />}

      {showStart && (
        <CanvasStart
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
            void refetch();
          }}
        />
      )}

      {activeTx && !showStart && (
        <DealCanvas
          tx={activeTx}
          deals={txs}
          onSelectDeal={(id) => {
            setCreating(false);
            setSelectedId(id);
          }}
          reload={() => {
            void refetch();
          }}
        />
      )}
    </AppShell>
  );
}
