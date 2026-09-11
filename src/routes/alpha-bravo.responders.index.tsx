import { createFileRoute } from "@tanstack/react-router";
import { ResponderDirectory, ResponderFacetLinks } from "@/components/marketing/ResponderDirectory";

export const Route = createFileRoute("/alpha-bravo/responders/")({
  head: () => ({
    meta: [{ title: "Responders — Izenzo Alpha-Bravo" }],
  }),
  component: Responders,
});

function Responders() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Responders
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-foreground sm:text-5xl">
        Verified Responders in our network.
      </h1>
      <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
        Browse Responders that have cleared Izenzo's compliance screening — every record here is
        live from our database, not a static list.
      </p>

      <ResponderFacetLinks />
      <ResponderDirectory />
    </section>
  );
}
