import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Paperclip } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { CanvasStart, DealCanvas, FLOWCHART_PREVIEW_TX, type RecordedActivity } from "@/components/canvas/DealCanvas";
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

/** The dashboard is the one screen users work from — the workflow canvas itself, never a
 * separate per-deal detail page. */
function Dashboard() {
  const [picking, setPicking] = useState(false);
  const [direction, setDirection] = useState<"bid" | "offer" | null>(null);
  const [activity, setActivity] = useState<RecordedActivity | null>(null);

  // Once something has been recorded, keep the split workspace open (and on the side it was
  // recorded for) even after the form resets — that's what the Live Workspace panel now shows.
  const side = direction ?? activity?.direction ?? null;

  return (
    <AppShell wide>
      <div className={cn(side && "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-stretch")}>
        <div
          className={cn(
            // Once a direction is picked, the form and its next steps merge into one bordered,
            // gridded frame — matched in width and height by the Live Workspace frame beside it.
            side && "ink-grid w-full rounded-3xl border border-border p-3 sm:p-5",
            side === "offer" && "sm:order-2",
          )}
        >
          <CanvasStart
            onCreated={(_id, recorded) => {
              setPicking(false);
              setDirection(null);
              setActivity(recorded);
            }}
            onPickingChange={setPicking}
            onDirectionChange={setDirection}
          />
          <div className={side ? "mt-3" : "mt-4"}>
            <DealCanvas
              tx={FLOWCHART_PREVIEW_TX}
              reload={() => {}}
              readOnly
              hideBidOfferGroups={picking}
              focusSide={direction}
            />
          </div>
        </div>

        {side && (
          <div
            className={cn(
              "ink-grid w-full rounded-3xl border border-border p-3 sm:p-5",
              side === "offer" && "sm:order-1",
            )}
          >
            <p className="label-caps">Live workspace</p>

            {activity ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {activity.commodity && (
                    <span className="rounded-full border border-primary/40 bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      {activity.commodity}
                    </span>
                  )}
                  {activity.quantity && (
                    <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {activity.quantity} {activity.unit}
                    </span>
                  )}
                  {activity.price && (
                    <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {activity.currency} {activity.price}
                    </span>
                  )}
                </div>

                <div className="glass-node flex items-start gap-3 p-4">
                  <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {activity.direction === "bid" ? "Bid" : "Offer"} recorded — {activity.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(activity.time).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">Nothing recorded yet.</p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
