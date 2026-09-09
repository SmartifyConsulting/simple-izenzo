import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { CanvasStart, DealCanvas } from "@/components/canvas/DealCanvas";

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
    <AppShell wide>
      {isLoading && <p className="text-sm text-muted-foreground">Opening the canvas…</p>}

      {!isLoading && !activeTx && (
        <CanvasStart
          onCreated={(id) => {
            setSelectedId(id);
            void refetch();
          }}
        />
      )}

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
    </AppShell>
  );
}
