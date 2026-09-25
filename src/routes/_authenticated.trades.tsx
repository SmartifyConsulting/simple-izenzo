import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { TradesListView } from "@/components/trades/TradesListView";

export const Route = createFileRoute("/_authenticated/trades")({
  head: () => ({
    meta: [{ title: "All Trades — Izenzo" }],
  }),
  // Lets Admin > Organisations link straight in here with a search already typed (an organisation
  // name) or narrowed to one person's own trades (userId, with userLabel just for display).
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string; userId?: string; userLabel?: string } => ({
    ...(typeof search["q"] === "string" ? { q: search["q"] as string } : {}),
    ...(typeof search["userId"] === "string" ? { userId: search["userId"] as string } : {}),
    ...(typeof search["userLabel"] === "string" ? { userLabel: search["userLabel"] as string } : {}),
  }),
  component: MyTrades,
});

function MyTrades() {
  const { q, userId, userLabel } = Route.useSearch();
  return (
    <AppShell
      title="All Trades"
      description="Every trade you have started, from early drafts to sealed agreements."
    >
      <TradesListView initialQuery={q} userId={userId} userLabel={userLabel} />
    </AppShell>
  );
}
