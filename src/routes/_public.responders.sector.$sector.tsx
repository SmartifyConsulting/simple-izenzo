import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  ResponderDirectory,
  useResponderFacets,
  slugify,
} from "@/components/marketing/ResponderDirectory";

export const Route = createFileRoute("/_public/responders/sector/$sector")({
  head: () => ({
    meta: [{ title: "Counterparties by Sector — Izenzo" }],
  }),
  component: RespondersBySector,
});

function RespondersBySector() {
  const { sector: sectorSlug } = Route.useParams();
  const { data: facets, isLoading } = useResponderFacets();
  const sector = facets?.sectors.find((s) => slugify(s) === sectorSlug);

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
      <Link
        to="/responders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All Counterparties
      </Link>

      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Counterparties · {sector ?? sectorSlug}
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-foreground sm:text-5xl">
        Verified {sector ?? sectorSlug} Counterparties in our network.
      </h1>
      <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
        Counterparties that have cleared Izenzo's compliance screening in this sector — live from our
        database.
      </p>

      {!isLoading && !sector && (
        <p className="mt-10 text-sm text-muted-foreground">
          No Counterparties on file yet for this sector.
        </p>
      )}
      {sector && <ResponderDirectory sector={sector} />}
    </section>
  );
}
