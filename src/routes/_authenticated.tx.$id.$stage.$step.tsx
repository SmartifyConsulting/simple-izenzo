import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SpineRail } from "@/components/spine/SpineRail";
import { StepScreen } from "@/components/steps/StepScreen";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { money, type Transaction } from "@/lib/tx";
import { lockReason, stageOf, type StageKey } from "@/lib/spine";

export const Route = createFileRoute("/_authenticated/tx/$id/$stage/$step")({
  head: () => ({
    meta: [
      { title: "Transaction — Izenzo" },
      { name: "description", content: "Work a transaction along the Izenzo Trading Gateway." },
      { property: "og:title", content: "Transaction — Izenzo" },
      { property: "og:description", content: "Work a transaction along the Izenzo Trading Gateway." },
    ],
  }),
  component: TxStepPage,
});

function TxStepPage() {
  const { id, stage, step } = Route.useParams();

  const { data: tx, isLoading, refetch } = useQuery({
    queryKey: ["transaction", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Transaction | null;
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Transaction">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  if (!tx) {
    return (
      <AppShell title="Transaction">
        <p className="text-sm text-muted-foreground">This transaction is not available to you.</p>
      </AppShell>
    );
  }

  const locked = lockReason(stage as StageKey, step, tx);
  const isPast = false;

  return (
    <AppShell
      title={tx.title}
      description={`${stageOf(tx.stage)?.label} · ${money(tx.price, tx.currency)}`}
      actions={
        <Link to="/dashboard">
          <Button size="sm" variant="ghost" className="gap-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Button>
        </Link>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SpineRail tx={tx} currentStage={stage} currentStep={step} />

        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-normal">
              {tx.commodity ?? "No commodity set"}
            </Badge>
            {tx.poi_sealed_at && (
              <Badge variant="secondary" className="font-normal">
                POI sealed
              </Badge>
            )}
            {tx.wad_completed_at && (
              <Badge variant="secondary" className="font-normal">
                WaD cleared
              </Badge>
            )}
            {tx.finality_sealed_at && (
              <Badge variant="secondary" className="font-normal">
                Final
              </Badge>
            )}
          </div>

          {locked && !isPast ? (
            <div className="rounded-md border border-border bg-muted/40 p-5">
              <h2 className="text-sm font-semibold">This step is locked</h2>
              <p className="mt-1 text-sm text-muted-foreground">{locked}.</p>
            </div>
          ) : (
            <StepScreen
              tx={tx}
              stage={stage as StageKey}
              step={step}
              reload={() => {
                void refetch();
              }}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
