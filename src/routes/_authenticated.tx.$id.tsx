import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DealCanvas } from "@/components/canvas/DealCanvas";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Transaction } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/tx/$id")({
  head: () => ({
    meta: [
      { title: "Deal canvas — Izenzo" },
      {
        name: "description",
        content: "Follow a deal down the live canvas: bidder on the left, responder on the right, proof at every gate.",
      },
      { property: "og:title", content: "Deal canvas — Izenzo" },
      {
        property: "og:description",
        content: "Bidder and responder lanes on one animated canvas, with every gate recorded.",
      },
    ],
  }),
  component: DealCanvasPage,
});

function DealCanvasPage() {
  const { id } = Route.useParams();

  const { data: tx, isLoading, refetch } = useQuery({
    queryKey: ["transaction", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Transaction | null;
    },
  });

  return (
    <AppShell
      title="Deal canvas"
      actions={
        <Link to="/dashboard">
          <Button size="sm" variant="ghost" className="gap-2">
            <ArrowLeft className="h-3.5 w-3.5" /> All deals
          </Button>
        </Link>
      }
    >
      {isLoading && <p className="text-sm text-muted-foreground">Opening the canvas…</p>}
      {!isLoading && !tx && <p className="text-sm text-muted-foreground">This deal is not available to you.</p>}
      {tx && (
        <DealCanvas
          tx={tx}
          reload={() => {
            void refetch();
          }}
        />
      )}
    </AppShell>
  );
}
