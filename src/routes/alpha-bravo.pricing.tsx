import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { POI_COST, WAD_COST, TOKEN_PRICE_USD } from "@/lib/spine";

export const Route = createFileRoute("/alpha-bravo/pricing")({
  head: () => ({
    meta: [{ title: "Pricing — Izenzo Alpha-Bravo" }],
  }),
  component: Pricing,
});

const PACKS = [
  { tokens: 1, price: 10 },
  { tokens: 10, price: 100 },
  { tokens: 50, price: 500 },
  { tokens: 200, price: 2000 },
];

const PAY_AS_YOU_GO_FEATURES = [
  "AI-assisted matching and counterparty search",
  "KYC/KYB and sanctions screening workflow",
  "Hash-sealed Proof of Intent",
  "Standard API access",
];

const INSTITUTIONAL_FEATURES = [
  "Audit Ledger API access",
  "Custom sanctions matrix",
  "Dedicated infrastructure & SLA",
  "Enterprise account manager",
];

const TOKEN_COSTS = [
  { label: "Proof of Intent", detail: "Sealing an agreed match", cost: POI_COST },
  { label: "WaD Verification", detail: "KYC, KYB, UBO and sanctions/PEP screening", cost: WAD_COST },
];

function Pricing() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Pricing
        </p>
        <h1 className="mt-4 text-4xl tracking-tight text-foreground sm:text-5xl">
          Simple, transparent, pay-as-you-go.
        </h1>
        <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
          Post an opportunity and browse matches for free. Pay only for the steps that move a
          match forward — no subscriptions, no hidden fees.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Pay-as-you-go
            </p>
            <h2 className="mt-1 text-lg font-medium tracking-tight text-foreground">
              Bidders &amp; Responders
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For anyone posting or responding to a trade opportunity.
            </p>
            <p className="mt-5 text-3xl font-semibold text-foreground">
              ${TOKEN_PRICE_USD.toFixed(2)}{" "}
              <span className="text-sm font-normal text-muted-foreground">USD</span>
            </p>
            <p className="text-xs text-muted-foreground">per token · 1 token = 1 Proof of Intent</p>

            <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
              {PACKS.map((p) => (
                <div key={p.tokens} className="rounded-lg bg-muted px-3 py-2 text-foreground">
                  {p.tokens} token{p.tokens === 1 ? "" : "s"} — ${p.price}
                </div>
              ))}
            </div>

            <Link to="/auth" search={{ mode: "signup", next: undefined }}>
              <Button className="mt-6 w-full rounded-full">Submit a Bid</Button>
            </Link>

            <ul className="mt-6 space-y-2 text-sm">
              {PAY_AS_YOU_GO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Institutional
            </p>
            <h2 className="mt-1 text-lg font-medium tracking-tight text-foreground">
              Banks, DFIs &amp; Sovereigns
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For institutions requiring dedicated infrastructure and oversight.
            </p>
            <p className="mt-5 text-3xl font-semibold text-foreground">Custom</p>
            <p className="text-xs text-muted-foreground">tailored to your volume</p>

            <a href="mailto:support@izenzo.co.za?subject=Institutional%20pricing">
              <Button variant="outline" className="mt-6 w-full rounded-full">
                Contact Sales
              </Button>
            </a>

            <ul className="mt-6 space-y-2 text-sm">
              {INSTITUTIONAL_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          All prices in USD. Institutional contracts include volume commitments and dedicated
          SLAs.
        </p>

        <div className="mt-8 divide-y divide-border border-t border-border">
          {TOKEN_COSTS.map((t) => (
            <div key={t.label} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-sm text-muted-foreground">{t.detail}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-foreground">
                {t.cost} token{t.cost === 1 ? "" : "s"} (${t.cost * TOKEN_PRICE_USD})
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
