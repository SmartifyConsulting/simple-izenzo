import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { DealCanvas } from "@/components/canvas/DealCanvas";
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

  const latestOpenTx = useMemo(() => txs.find((t) => t.status === "open") ?? txs[0], [txs]);

  return (
    <AppShell>
      {isLoading && <p className="text-sm text-muted-foreground">Opening the canvas…</p>}

      {!isLoading && !latestOpenTx && (
        <div className="rounded-md border border-border bg-muted/40 p-8 text-center">
          <p className="text-sm font-medium">No transactions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every transaction starts with a bid or an offer.
          </p>
          <Link to="/transactions/new">
            <Button size="sm" className="mt-4 gap-2">
              <Plus className="h-3.5 w-3.5" /> Open the first one
            </Button>
          </Link>
        </div>
      )}

      {latestOpenTx && (
        <DealCanvas
          tx={latestOpenTx}
          reload={() => {
            void refetch();
          }}
        />
      )}
    </AppShell>
  );
}
