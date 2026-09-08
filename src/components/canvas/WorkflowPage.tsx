import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { CanvasStart, DealCanvas } from "@/components/canvas/DealCanvas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Transaction } from "@/lib/tx";

/** Shared behaviour behind both Workflow View and Workflow Grid: same deal-fetching, same
 * ticker, same Live Deal Canvas. The two routes only differ in presentation (title/description
 * and whether the canvas shows its grid background) — every other change belongs here so both
 * views stay in lockstep. */
export function WorkflowPage({
  title,
  description,
  gridBackground,
}: {
  title: string;
  description: string;
  gridBackground: boolean;
}) {
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
    <AppShell wide title={title} description={description}>
      {isLoading && <p className="text-sm text-muted-foreground">Opening the canvas…</p>}
      {!isLoading && !activeTx && <CanvasStart />}
      {activeTx && (
        <DealCanvas
          tx={activeTx}
          deals={txs}
          onSelectDeal={setSelectedId}
          gridBackground={gridBackground}
          reload={() => {
            void refetch();
          }}
        />
      )}
    </AppShell>
  );
}
