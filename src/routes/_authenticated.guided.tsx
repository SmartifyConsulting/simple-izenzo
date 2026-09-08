import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { FlightSearchBoard } from "@/components/guided/FlightSearchBoard";
import { ModulesShowcase } from "@/components/guided/ModulesShowcase";

export const Route = createFileRoute("/_authenticated/guided")({
  head: () => ({
    meta: [{ title: "Simple Mode — Izenzo" }],
  }),
  component: Guided,
});

/** Simple Mode: search like a flight-booking site — commodity, quantity, price, country and
 * documents, all in one submission — then pick the best-ranked match and continue booking. */
function Guided() {
  return (
    <AppShell
      title="Simple Mode"
      description="Search for a counterparty like a flight search — best matches first, then continue booking."
    >
      <FlightSearchBoard />
      <ModulesShowcase />
    </AppShell>
  );
}
