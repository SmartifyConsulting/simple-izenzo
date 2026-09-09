import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Fingerprint, Hash, Landmark, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { JourneyBanner } from "@/components/JourneyBanner";
import { useAuth } from "@/lib/auth";

type Search = { next?: string | undefined };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    next: typeof search["next"] === "string" ? (search["next"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "IZENZO | Governance Infrastructure for Trade and Institutions" },
      {
        name: "description",
        content:
          "One cryptographic network. Access it via our turnkey Trade Desk, manage risk through the Compliance Profile, or build directly on the API. All backed by hash-sealed, independently verifiable execution.",
      },
      { property: "og:title", content: "IZENZO | Governance Infrastructure for Trade and Institutions" },
      {
        property: "og:description",
        content: "One cryptographic network for institutional trade — hash-sealed, independently verifiable.",
      },
    ],
  }),
  component: Landing,
});

function safeNext(next: string | undefined) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/live-deal-engine";
}

const STATS = [
  { icon: Hash, label: "LEDGER: TAMPER-EVIDENT" },
  { icon: Fingerprint, label: "LEDGER: SHA-256" },
  { icon: Landmark, label: "REGION: SINGLE APPROVED POLICY" },
  { icon: Radio, label: "STATE: ATOMIC" },
];

function Landing() {
  const { user } = useAuth();
  const { next } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: safeNext(next), replace: true });
  }, [user, next, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />

      <main>
        <section className="ink-ground ink-grid relative overflow-hidden border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Izenzo Governance Network
                </span>

                <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
                  Governance Infrastructure
                  <br />
                  for <span className="text-primary">Institutional Trade.</span>
                </h1>

                <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
                  One cryptographic network. Access it via our turnkey Trade Desk, manage risk through
                  the Compliance Profile, or build directly on the API. All backed by hash-sealed,
                  independently verifiable execution.
                </p>

                <div className="mt-8">
                  <a href="mailto:support@izenzo.co.za?subject=Demo%20request&body=I%20would%20like%20to%20request%20a%20demo%20of%20the%20Izenzo%20Trading%20Gateway.">
                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-1.5 rounded-full border-border bg-transparent text-foreground hover:bg-muted"
                    >
                      Request a Demo <ChevronRight className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>

              <AuthTabs
                next={safeNext(next)}
                className="w-full rounded-2xl border border-border bg-background/80 p-6 shadow-sm backdrop-blur"
              />
            </div>

            <div className="mt-14">
              <JourneyBanner />
            </div>


            <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Platform architecture &amp; standards
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2">
              {STATS.map((s) => (
                <span
                  key={s.label}
                  className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-muted-foreground"
                >
                  <s.icon className="h-3.5 w-3.5" />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </section>


        <section className="border-t border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Proof of Intent is a gate</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Nothing past Trading opens until a person confirms intent and the Proof of Intent
                  is sealed. One token, USD 10, charged on the server, not hidden in the interface.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">WaD before execution</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Without a Doubt — KYC, KYB, UBO, sanctions and PEP — must clear before execution
                  can begin. Three further tokens, USD 30.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">AI proposes, people decide</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  AI and AI+ read the record and put forward proposals. They are stored as
                  proposals. A person adopts them, and that adoption is itself an event.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

