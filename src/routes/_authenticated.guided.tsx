import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { FlightSearchBoard } from "@/components/guided/FlightSearchBoard";
import { TradesListView } from "@/components/trades/TradesListView";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { ModulesShowcase } from "@/components/guided/ModulesShowcase";

export const Route = createFileRoute("/_authenticated/guided")({
  head: () => ({
    meta: [{ title: "Simple Mode — Izenzo" }],
  }),
  component: Guided,
});

/** Simple Mode: search like a flight-booking site — commodity, quantity, price, country — then
 * pick the best-ranked match and continue straight into the wizard from Documents onward. The
 * old 4-lane board is gone: Search/AI/AI+/Counterparties/Choice all happen in this one search,
 * so a separate "match aggregation" view no longer reflected anything real. */
function Guided() {
  return (
    <AppShell
      title="Simple Mode"
      description="Search for a counterparty like a flight search — best matches first, then continue booking."
      actions={<ProfileAvatarMenu />}
    >
      <FlightSearchBoard />

      <section className="mt-10">
        <p className="label-caps">Your open trades</p>
        <div className="mt-3">
          <TradesListView />
        </div>
      </section>

      <ModulesShowcase />
    </AppShell>
  );
}
