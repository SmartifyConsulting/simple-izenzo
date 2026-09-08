import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { LiveCounterpartyCard } from "@/components/marketing/LiveCounterpartyCard";

export const Route = createFileRoute("/products/compliance-engine")({
  head: () => ({
    meta: [
      { title: "Compliance Engine — Izenzo" },
      {
        name: "description",
        content:
          "Admin-controlled KYB workflow, resolve complex UBO structures, and screen against global sanctions on configured cadence. Turn compliance from a bottleneck into a competitive advantage.",
      },
    ],
  }),
  component: ComplianceEngine,
});

function ComplianceEngine() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main>
        <MarketingHero
          eyebrow="Compliance Engine"
          headline={
            <>
              Institutional
              <br />
              identity. <span className="text-primary">Resolved.</span>
            </>
          }
          subtext="Admin-controlled KYB workflow, resolve complex UBO structures, and screen against global sanctions on configured cadence. Turn compliance from a bottleneck into a competitive advantage."
          primaryCta={{ label: "Verify a counterparty", to: "/auth" }}
          secondaryCta={{ label: "See the Trade Desk", to: "/products/trade-desk" }}
          statLine="OFAC · EU · UK HMT · DPL · Periodic screening"
          visual={<LiveCounterpartyCard />}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
