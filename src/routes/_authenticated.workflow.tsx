import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { CanvasStart, DealCanvas } from "@/components/canvas/DealCanvas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Transaction } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/workflow")({
  head: () => ({
    meta: [
      { title: "Workflow View — Izenzo" },
      {
        name: "description",
        content: "The Trading Gateway flowchart, highlighting exactly where each deal stands.",
      },
    ],
  }),
  component: WorkflowView,
});

/** Workflow View: the same Live Deal Canvas the Trade Desk uses, surfaced as its own guided
 * view — pick a deal from the ticker and see the whole gate flowchart with the current step
 * highlighted, without the rest of the classic dashboard chrome around it. */
function WorkflowView() {
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
    <AppShell
      wide
      title="Workflow View"
      description="The Trading Gateway flowchart — your current step is highlighted."
    >
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
    </AppShell>
  );
}
