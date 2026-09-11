import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlphaBravoShell } from "@/components/layout/AlphaBravoShell";

/** Layout for every /alpha-bravo/* route — renders the Alpha-Bravo header/nav/footer once and
 * lets each child route (index, about, marketplace, insights, bidders, responders) fill in the
 * page body via Outlet. */
export const Route = createFileRoute("/alpha-bravo")({
  head: () => ({
    meta: [
      { title: "Izenzo Alpha-Bravo | Matching Bidders with Responders" },
      {
        name: "description",
        content:
          "Izenzo is a governance-first marketplace matching Bidders with the right Responders — verified, risk-assessed, and executed under one cryptographic record.",
      },
    ],
  }),
  component: AlphaBravoLayout,
});

function AlphaBravoLayout() {
  return (
    <AlphaBravoShell>
      <Outlet />
    </AlphaBravoShell>
  );
}
