import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { LiveDealCard } from "@/components/marketing/LiveDealCard";

export const Route = createFileRoute("/solutions/traders")({
  head: () => ({
    meta: [{ title: "For Traders — Izenzo" }],
  }),
  component: Traders,
});

function Traders() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main>
        <MarketingHero
          eyebrow="For Commodity Traders & Corporates"
          headline={
            <>
              Execute with
              <br />
              absolute certainty.
            </>
          }
          subtext="Discover verified counterparties, negotiate terms, and seal cross-border commodity deals in a unified, secure terminal."
          primaryCta={{ label: "Open your desk", to: "/auth" }}
          secondaryCta={{ label: "See the product", to: "/products/trade-desk" }}
          statLine="Verified liquidity · Hash-locked terms · Zero-friction compliance"
          visual={<LiveDealCard />}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
