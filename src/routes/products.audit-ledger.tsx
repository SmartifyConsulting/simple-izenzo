import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { MarketingHero } from "@/components/marketing/MarketingHero";

export const Route = createFileRoute("/products/audit-ledger")({
  head: () => ({
    meta: [
      { title: "Audit Ledger — Izenzo" },
      {
        name: "description",
        content:
          "Provide banks, DFIs, and insurers with hash-sealed, independently re-verifiable deal records. Reduce manual auditing effort, raise the cost of tampering, and accelerate capital deployment.",
      },
    ],
  }),
  component: AuditLedger,
});

function AuditLedger() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main>
        <MarketingHero
          eyebrow="Audit Ledger"
          headline={
            <>
              Tamper-evident ledger
              <br />
              for trade finance.
            </>
          }
          subtext="Provide banks, DFIs, and insurers with hash-sealed, independently re-verifiable deal records. Reduce manual auditing effort, raise the cost of tampering, and accelerate capital deployment."
          primaryCta={{ label: "Issue your first ledger", to: "/auth" }}
          secondaryCta={{ label: "Read the spec", to: "/docs" }}
          statLine="Tamper-evident · Hash-sealed · Bank-ready exports"
          visual={
            <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-[0_20px_50px_-24px_hsl(220_30%_20%/0.18)]">
              <span className="ml-auto flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Sample
              </span>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                Certificate class · Wad/A
              </p>
              <h3 className="mt-3 text-xl font-bold uppercase tracking-tight">
                Attestation of
                <br />
                Commercial
                <br />
                Intent
              </h3>
              <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary/40">
                <div className="flex flex-col items-center gap-0.5">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <p className="text-[9px] font-bold leading-tight text-primary">
                    WITHOUT
                    <br />A DOUBT
                  </p>
                </div>
              </div>
            </div>
          }
        />
      </main>
      <SiteFooter />
    </div>
  );
}
