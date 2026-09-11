import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/alpha-bravo/")({
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
  component: AlphaBravoHome,
});

const THESIS = [
  {
    n: "01",
    title: "Matching is the opportunity",
    body: "The best outcomes come from pairing the right Bidder with the right Responder — not just the fastest one.",
  },
  {
    n: "02",
    title: "Verified, before capital moves",
    body: "Every match clears KYC/KYB and a non-waivable risk gate before a cent changes hands.",
  },
  {
    n: "03",
    title: "A record that compounds",
    body: "Every completed match becomes reusable intelligence for the next opportunity.",
  },
];

function AlphaBravoHome() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 py-24 sm:py-28">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Pre-vetted · Governed marketplace
        </p>
        <h1 className="mt-6 max-w-3xl text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl">
          Your partner
          <br />
          for matched execution.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Izenzo is a governance-first marketplace matching Bidders with the right Responders —
          verified, risk-assessed, and executed under one cryptographic record.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/auth" search={{ mode: "signup", next: undefined }}>
            <Button size="lg" className="gap-1.5 rounded-full">
              Post an Opportunity <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/alpha-bravo/marketplace">
            <Button size="lg" variant="outline" className="rounded-full">
              See how matching works
            </Button>
          </Link>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            The thesis
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl tracking-tight text-foreground sm:text-4xl">
            We back matches that hold up under scrutiny.
          </h2>

          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {THESIS.map((t) => (
              <div key={t.n}>
                <p className="text-sm font-semibold text-primary">{t.n}</p>
                <h3 className="mt-3 text-lg font-medium tracking-tight text-foreground">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
