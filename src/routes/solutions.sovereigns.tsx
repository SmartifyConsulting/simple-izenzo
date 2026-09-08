import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/tx";

export const Route = createFileRoute("/solutions/sovereigns")({
  head: () => ({
    meta: [{ title: "For Sovereigns & DFIs — Izenzo" }],
  }),
  component: Sovereigns,
});

function Sovereigns() {
  const { data } = useQuery({
    queryKey: ["marketing-sovereign-telemetry"],
    queryFn: async () => {
      const [{ count: txCount }, { data: orgs }] = await Promise.all([
        supabase.from("transactions").select("id", { count: "exact", head: true }),
        supabase.from("organisations").select("credits"),
      ]);
      const capital = (orgs ?? []).reduce((sum, o) => sum + (o.credits ?? 0) * 10, 0);
      return { programmes: txCount ?? 0, capital };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main>
        <MarketingHero
          eyebrow="For Sovereigns & DFIs"
          headline={
            <>
              Govern institutional
              <br />
              trade at scale.
            </>
          }
          subtext="Secure national and cross-border trade programmes with end-to-end provenance and governed compliance workflow with admin oversight. Real-time programme telemetry is in development."
          primaryCta={{ label: "Request a briefing", to: "/auth" }}
          secondaryCta={{ label: "See the architecture", href: "#", kind: "external" }}
          statLine="Single approved production-region policy · Tamper-evident ledger · Macro telemetry"
          visual={
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_20px_50px_-24px_hsl(220_30%_20%/0.18)]">
              <p className="font-mono text-[11px] uppercase tracking-wide text-primary">
                Izenzo · Governance Console
              </p>
              <h3 className="mt-1 text-base font-semibold tracking-tight">Macro Telemetry</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Programmes active
                  </p>
                  <p className="mt-0.5 text-xl font-bold">{data?.programmes ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Capital under governance
                  </p>
                  <p className="mt-0.5 text-xl font-bold">{money(data?.capital ?? null, "USD")}</p>
                </div>
              </div>
              <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
                Live from the same Supabase project powering the Trading Gateway.
              </p>
            </div>
          }
        />
      </main>
      <SiteFooter />
    </div>
  );
}
