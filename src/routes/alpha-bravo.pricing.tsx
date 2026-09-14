import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitBidButton } from "@/components/marketing/SubmitBidButton";
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

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Pay-as-you-go
            </p>
            <h2 className="mt-1 text-base font-medium tracking-tight text-foreground">
              Bidders &amp; Counterparties
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              For anyone posting or responding to a trade opportunity.
            </p>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              ${TOKEN_PRICE_USD.toFixed(2)}{" "}
              <span className="text-sm font-normal text-muted-foreground">USD</span>
            </p>
            <p className="text-xs text-muted-foreground">per token · 1 token = 1 Proof of Intent</p>

            <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
              {PACKS.map((p) => (
                <div key={p.tokens} className="rounded-lg bg-muted px-2.5 py-1.5 text-foreground">
                  {p.tokens} token{p.tokens === 1 ? "" : "s"} — ${p.price}
                </div>
              ))}
            </div>

            <SubmitBidButton size="sm" fullWidth className="mt-4" />

            <ul className="mt-4 space-y-1.5 text-xs">
              {PAY_AS_YOU_GO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Institutional
            </p>
            <h2 className="mt-1 text-base font-medium tracking-tight text-foreground">
              Banks, DFIs &amp; Sovereigns
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              For institutions requiring dedicated infrastructure and oversight.
            </p>
            <p className="mt-3 text-2xl font-semibold text-foreground">Custom</p>
            <p className="text-xs text-muted-foreground">tailored to your volume</p>

            <a href="mailto:support@izenzo.co.za?subject=Institutional%20pricing">
              <Button size="sm" variant="outline" className="mt-4 w-full rounded-full">
                Contact Sales
              </Button>
            </a>

            <ul className="mt-4 space-y-1.5 text-xs">
              {INSTITUTIONAL_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          All prices in USD. Institutional contracts include volume commitments and dedicated
          SLAs.
        </p>

        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Feature Costs
        </p>
        <div className="mt-4 divide-y divide-border border-t border-border">
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
