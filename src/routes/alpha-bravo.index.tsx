import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroMatchCard } from "@/components/marketing/HeroMatchCard";
import { SignInModal } from "@/components/auth/SignInModal";
import { ThemeToggle } from "@/components/guided/ThemeToggle";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/alpha-bravo/")({
  head: () => ({
    meta: [
      { title: "Izenzo Alpha-Bravo | Matching Bidders with Responders" },
      {
        name: "description",
        content:
          "Izenzo is a governance-first marketplace matching Bidders with the right Responders — verified, risk-assessed, and executed under one cryptographic record.",
      },
    ],
  }),
  component: AlphaBravoHome,
});

const STAGES = [
  {
    n: "01",
    title: "Trading",
    tag: "Find. Match. Structure.",
    body: "Source opportunities, match Bidders with Responders, and capture the opportunity.",
  },
  {
    n: "02",
    title: "Compliance & Governance",
    tag: "Verify. Assess. Authorise.",
    body: "Complete KYC/KYB, assess risk, and verify evidence.",
  },
  {
    n: "03",
    title: "Execution",
    tag: "Plan. Implement. Deliver.",
    body: "Turn a matched opportunity into an executable project.",
  },
  {
    n: "04",
    title: "Finality",
    tag: "Settle. Complete.",
    body: "Finalise contracts, process payment, and close the transaction.",
  },
  {
    n: "05",
    title: "Memory",
    tag: "Record. Learn. Scale.",
    body: "Store verified outcomes and reuse intelligence for the next match.",
  },
];

function AlphaBravoHome() {
  const { user } = useAuth();

  return (
    <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" /> AI-Powered Trade Matching
      </span>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Pre-vetted · Governed marketplace
      </p>

      <div className="mt-6 grid gap-12 lg:grid-cols-[minmax(0,1fr)_396px] lg:items-start">
        <div className="min-w-0">
          <h1 className="max-w-3xl text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Find the right Trade
            <br />
            in ~5 minutes.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Post your opportunity brief and get matched with verified Responders — fit scores,
            verified contacts, and ready-to-send outreach, all under one cryptographic record.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">No subscriptions, pay as you go.</p>
          <div className="mt-8">
            <Link to="/alpha-bravo/trades">
              <Button size="lg" variant="outline" className="gap-1.5 rounded-full">
                See how matching works <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="min-w-0">
          {!user && (
            <div className="mb-3 flex items-center justify-end gap-2">
              <div className="flex items-center gap-1 rounded-full border border-border p-1">
                <SignInModal defaultTab="signin">
                  <button
                    type="button"
                    className="rounded-full px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Sign In
                  </button>
                </SignInModal>
                <SignInModal defaultTab="signup">
                  <button
                    type="button"
                    className="rounded-full px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Sign Up
                  </button>
                </SignInModal>
              </div>
              <ThemeToggle />
            </div>
          )}
          <HeroMatchCard />
        </div>
      </div>

      <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        How a match plays out
      </p>
      <h2 className="mt-3 max-w-2xl text-3xl tracking-tight text-foreground sm:text-4xl">
        Five stages, one governed flow.
      </h2>
      <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((s) => (
          <div key={s.n} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-primary">{s.n}</p>
            <h3 className="mt-3 text-base font-medium tracking-tight text-foreground">{s.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{s.tag}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
