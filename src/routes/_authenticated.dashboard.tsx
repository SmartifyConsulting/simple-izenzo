import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { CanvasStart, DealCanvas, FLOWCHART_PREVIEW_TX } from "@/components/canvas/DealCanvas";
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

  return (
    <AppShell wide>
      <div
        className={cn(
          // Once a direction is picked, the form and its next steps merge into one bordered,
          // gridded frame confined to that side's half of the screen — the other half is left
          // for match results once search runs.
          direction && "w-full rounded-3xl border border-border p-3 ink-grid sm:w-1/2 sm:p-5",
          direction === "offer" && "ml-auto",
        )}
      >
        <CanvasStart
          onCreated={() => {
            setPicking(false);
            setDirection(null);
          }}
          onPickingChange={setPicking}
          onDirectionChange={setDirection}
        />
        <div className={direction ? "mt-3" : "mt-4"}>
          <DealCanvas
            tx={FLOWCHART_PREVIEW_TX}
            reload={() => {}}
            readOnly
            hideBidOfferGroups={picking}
            focusSide={direction}
          />
        </div>
      </div>
    </AppShell>
  );
}
