import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/alpha-bravo/about")({
  head: () => ({
    meta: [{ title: "About — Izenzo Alpha-Bravo" }],
  }),
  component: About,
});

function About() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-5 py-20 sm:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          About
        </p>

        <p className="mt-8 text-lg leading-relaxed text-foreground">
          We built Izenzo because trade between institutions breaks down in the gap between "we
          agree" and "it's done" — lost in manual compliance checks, unverifiable evidence, and
          counterparties who can't prove who they say they are. Izenzo closes that gap: one
          governed flow from Trading through Compliance &amp; Governance, Execution, Finality, and
          Memory.
        </p>

        <p className="mt-6 leading-relaxed text-muted-foreground">
          Every match on Izenzo is hash-sealed, independently verifiable, and backed by a
          compliance gate that cannot be waived — so Bidders and Responders can move at speed
          without trading away certainty.
        </p>
      </section>
    </>
  );
}
