import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/alpha-bravo/about")({
  head: () => ({
    meta: [{ title: "About — Izenzo Alpha-Bravo" }],
  }),
  component: About,
});

const PRINCIPLES = [
  {
    n: "01",
    title: "Hash-sealed by design",
    body: "Every match is independently verifiable — tamper-evident from the first handshake to final settlement.",
  },
  {
    n: "02",
    title: "A gate that can't be waived",
    body: "Compliance isn't a checkbox someone can skip under pressure. It clears, or the match doesn't proceed.",
  },
  {
    n: "03",
    title: "Counterparties who can prove it",
    body: "KYC/KYB isn't a formality — it's the difference between an introduction and a liability.",
  },
];

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

      <div className="mt-16 grid gap-10 sm:grid-cols-3">
        {PRINCIPLES.map((p) => (
          <div key={p.n}>
            <p className="text-sm font-semibold text-primary">{p.n}</p>
            <h3 className="mt-3 text-lg font-medium tracking-tight text-foreground">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
