import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { TradesListView } from "@/components/trades/TradesListView";

export const Route = createFileRoute("/_authenticated/trades")({
  head: () => ({
    meta: [{ title: "All Trades — Izenzo" }],
  }),
  component: MyTrades,
});

function MyTrades() {
  return (
    <AppShell
      title="All Trades"
      description="Every trade you have started, from early drafts to sealed agreements."
    >
      <TradesListView />
    </AppShell>
  );
}
