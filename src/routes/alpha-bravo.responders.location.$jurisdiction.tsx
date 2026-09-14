import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  ResponderDirectory,
  useResponderFacets,
  slugify,
} from "@/components/marketing/ResponderDirectory";

export const Route = createFileRoute("/alpha-bravo/responders/location/$jurisdiction")({
  head: () => ({
    meta: [{ title: "Counterparties by Location — Izenzo Alpha-Bravo" }],
  }),
  component: RespondersByLocation,
});

function RespondersByLocation() {
  const { jurisdiction: jurisdictionSlug } = Route.useParams();
  const { data: facets, isLoading } = useResponderFacets();
  const jurisdiction = facets?.jurisdictions.find((j) => slugify(j) === jurisdictionSlug);

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
      <Link
        to="/alpha-bravo/responders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All Counterparties
      </Link>

      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Counterparties · {jurisdiction ?? jurisdictionSlug}
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-foreground sm:text-5xl">
        Verified Counterparties in {jurisdiction ?? jurisdictionSlug}.
      </h1>
      <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
        Counterparties that have cleared Izenzo's compliance screening in this location — live from
        our database.
      </p>

      {!isLoading && !jurisdiction && (
        <p className="mt-10 text-sm text-muted-foreground">
          No Counterparties on file yet for this location.
        </p>
      )}
      {jurisdiction && <ResponderDirectory jurisdiction={jurisdiction} />}
    </section>
  );
}
