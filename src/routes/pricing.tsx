import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [{ title: "Pricing — Izenzo" }],
  }),
  component: Pricing,
});

const PACKS = [
  { credits: 1, price: 10 },
  { credits: 10, price: 100 },
  { credits: 50, price: 500 },
  { credits: 200, price: 2000 },
];

const INCLUDED = [
  {
    title: "Cryptographic Hashing",
    blurb: "SHA-256 hash recorded on critical state transitions. Coverage is being progressively hardened.",
  },
  {
    title: "Sanctions Screening Workflow",
    blurb: "Periodic OFAC, EU, UK HMT, and DPL background screening on configured cadence.",
  },
  {
    title: "Platform Health",
    blurb: "Internal platform-health monitoring. Public status feed is in development.",
  },
];

function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main className="mx-auto max-w-5xl px-5 py-16">
        <p className="label-caps text-primary">Pricing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Infrastructure pricing. Scalable and predictable.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Pay only for the Proof-of-Intent records you mint. No opaque licenses, No hidden fees.
          Volume pricing available for institutions.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pay-as-you-go</p>
            <h2 className="mt-1 text-lg font-semibold">Operators &amp; Traders</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For trading desks and corporates executing verified cross-border matches.
            </p>
            <p className="mt-5 text-3xl font-bold">
              $10.00 <span className="text-sm font-normal text-muted-foreground">USD</span>
            </p>
            <p className="text-xs text-muted-foreground">per credit · 1 credit = 1 Trade Request</p>

            <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
              {PACKS.map((p) => (
                <div key={p.credits} className="rounded-lg bg-muted px-3 py-2">
                  {p.credits} credit{p.credits === 1 ? "" : "s"} — ${p.price}
                </div>
              ))}
            </div>

            <Link to="/auth" search={{ mode: "signup", next: undefined }}>
              <Button className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Provision Workspace
              </Button>
            </Link>

            <ul className="mt-6 space-y-2 text-sm">
              {[
                "Live Match Compiler",
                "Admin-controlled KYB and sanctions screening workflow",
                "SHA-256 hashed Proof of Intent",
                "Standard API Access",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Institutional</p>
            <h2 className="mt-1 text-lg font-semibold">Banks, DFIs &amp; Sovereigns</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For public development banks and trade finance underwriters requiring oversight.
            </p>
            <p className="mt-5 text-3xl font-bold">Custom</p>
            <p className="text-xs text-muted-foreground">tailored to your volume</p>

            <a href="mailto:support@izenzo.co.za?subject=Institutional%20pricing">
              <Button variant="outline" className="mt-6 w-full">
                Contact Sales
              </Button>
            </a>

            <ul className="mt-6 space-y-2 text-sm">
              {[
                "Audit Ledger API Access",
                "Custom Sanctions Matrix",
                "Dedicated Infrastructure & SLA",
                "Enterprise Account Manager",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          All prices in USD. Credits are purchased securely through PayFast. Pay-as-you-go billed
          per successful Proof of Intent. Institutional contracts include volume commitments and
          dedicated SLAs.
        </p>

        <h2 className="mt-16 text-lg font-semibold tracking-tight">Always included</h2>
        <p className="mt-1 text-sm text-muted-foreground">Every plan ships with the platform foundation.</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-3">
          {INCLUDED.map((i) => (
            <div key={i.title}>
              <h3 className="text-sm font-semibold">{i.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{i.blurb}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-muted/40 p-8 text-center">
          <h2 className="text-lg font-semibold">Not sure which tier fits?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Speak to our institutional team. We'll size the right contract for your trade volume
            and governance requirements.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a href="mailto:support@izenzo.co.za?subject=Institutional%20pricing">
              <Button variant="outline">Contact Sales</Button>
            </a>
            <Link to="/auth" search={{ mode: "signup", next: undefined }}>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Start with pay-as-you-go
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
