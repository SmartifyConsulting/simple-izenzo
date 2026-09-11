import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/alpha-bravo/about")({
  head: () => ({
    meta: [{ title: "About — Izenzo Alpha-Bravo" }],
  }),
  component: About,
});

function About() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        About
      </p>
      <h1 className="mt-6 max-w-2xl text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
        Built for the gap between
        <br />
        "we agree" and "it's done."
      </h1>
      <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
        Trade between institutions breaks down in manual compliance checks, unverifiable
        evidence, and counterparties who can't prove who they say they are. Izenzo closes that
        gap — one governed flow from Trading through Compliance &amp; Governance, Execution,
        Finality, and Memory.
      </p>
    </section>
  );
}
