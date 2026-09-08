import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AuthTabs } from "@/components/auth/AuthTabs";
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
      { title: "Izenzo — Proof-backed trading, from intent to memory" },
      {
        name: "description",
        content:
          "Izenzo matches bidders with responders and records every step: trading, compliance, execution, finality and memory. Intent is sealed, not assumed.",
      },
      { property: "og:title", content: "Izenzo — Proof-backed trading" },
      {
        property: "og:description",
        content:
          "Izenzo records every step: trading, compliance and governance, execution, finality and memory.",
      },
    ],
  }),
  component: Landing,
});

function safeNext(next: string | undefined) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

function Landing() {
  const { user } = useAuth();
  const { next } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: safeNext(next), replace: true });
  }, [user, next, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        logoClassName="h-12"
        containerClassName="max-w-6xl h-auto py-8 px-5"
        logoVariant="white"
        logoOnDark
      />

      <main>
        <section className="bg-sidebar">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 text-sidebar-foreground sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="max-w-xl">
              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
                Match a bid to the right counterparty, with proof at every gate.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-sidebar-foreground/75">
                Bidders on the left, responders on the right. Each module opens as the deal moves,
                and every choice is recorded as it happens.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="mailto:support@izenzo.co.za?subject=Demo%20request&body=I%20would%20like%20to%20request%20a%20demo%20of%20the%20Izenzo%20Trading%20Gateway.">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-sidebar-foreground/25 bg-transparent text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                  >
                    Request a Demo
                  </Button>
                </a>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <AuthTabs
                next={next}
                className="w-full max-w-sm rounded-2xl bg-background p-8 shadow-xl"
              />
            </div>
          </div>
        </section>




        <section className="bg-sidebar text-white">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Proof of Intent is a gate</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Nothing past Trading opens until a person confirms intent and the Proof of Intent
                  is sealed. One token, USD 10, charged on the server, not hidden in the interface.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">WaD before execution</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Without a Doubt — KYC, KYB, UBO, sanctions and PEP — must clear before execution
                  can begin. Three further tokens, USD 30.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">AI proposes, people decide</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
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
