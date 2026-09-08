import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Fingerprint, Hash, Landmark, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
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
  return "/dashboard";
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
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
          <div className="mx-auto max-w-4xl px-5 py-24 text-center sm:py-28">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Izenzo Governance Network
            </span>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
              Governance Infrastructure
              <br />
              for <span className="text-primary">Institutional Trade.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
              One cryptographic network. Access it via our turnkey Trade Desk, manage risk through
              the Compliance Profile, or build directly on the API. All backed by hash-sealed,
              independently verifiable execution.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" search={{ mode: "signup", next: undefined }}>
                <Button size="lg" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                  Provision Workspace <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="mailto:support@izenzo.co.za?subject=Demo%20request&body=I%20would%20like%20to%20request%20a%20demo%20of%20the%20Izenzo%20Trading%20Gateway.">
                <Button size="lg" variant="outline" className="gap-1.5 border-primary/20 text-primary">
                  Read the Docs <ChevronRight className="h-4 w-4" />
                </Button>
              </a>
            </div>

            <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Platform architecture &amp; standards
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
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
