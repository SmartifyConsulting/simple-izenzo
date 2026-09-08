import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { LiveDealCard } from "@/components/marketing/LiveDealCard";

export const Route = createFileRoute("/products/trade-desk")({
  head: () => ({
    meta: [
      { title: "Trade Desk — Izenzo" },
      {
        name: "description",
        content:
          "The all-in-one terminal for institutional commodity trade. Discover counterparties, run governed compliance workflow, and record cross-border trade intent with cryptographically hashed Proof of Intent.",
      },
    ],
  }),
  component: TradeDesk,
});

function TradeDesk() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main>
        <MarketingHero
          eyebrow="Trade Desk"
          headline={
            <>
              Governance infrastructure
              <br />
              for the deal maker.
            </>
          }
          subtext="The all-in-one terminal for institutional commodity trade. Discover counterparties, run governed compliance workflow, and record cross-border trade intent with cryptographically hashed Proof of Intent."
          primaryCta={{ label: "Open your desk", to: "/auth" }}
          secondaryCta={{ label: "See pricing", to: "/pricing" }}
          statLine="SHA-256 sealed · Tamper-evident · Audit-ready"
          visual={<LiveDealCard />}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
