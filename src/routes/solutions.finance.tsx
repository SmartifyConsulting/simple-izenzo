import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { MarketingHero } from "@/components/marketing/MarketingHero";

export const Route = createFileRoute("/solutions/finance")({
  head: () => ({
    meta: [{ title: "For Trade Finance & Insurance — Izenzo" }],
  }),
  component: Finance,
});

function Finance() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main>
        <MarketingHero
          eyebrow="For Trade Finance & Insurance"
          headline={<>De-risk capital deployment.</>}
          subtext="Rely on hash-sealed, independently re-verifiable deal records to underwrite trade finance, issue letters of credit, and insure shipments with reduced ambiguity."
          primaryCta={{ label: "Request access", to: "/auth" }}
          secondaryCta={{ label: "See the ledger", to: "/products/audit-ledger" }}
          statLine="SHA-256 hashed · Designed for underwriter review · Designed for audit review"
        />
      </main>
      <SiteFooter />
    </div>
  );
}
