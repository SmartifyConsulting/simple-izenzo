import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Database, Hammer, ShieldCheck, Sparkles, Target } from "lucide-react";
import { HeroMatchCard } from "@/components/marketing/HeroMatchCard";
import { SubmitBidButton } from "@/components/marketing/SubmitBidButton";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/alpha-bravo/")({
  head: () => ({
    meta: [
      { title: "Izenzo Alpha-Bravo | Matching Bidders with Counterparties" },
      {
        name: "description",
        content:
          "Izenzo is a governance-first marketplace matching Bidders with the right Counterparties — verified, risk-assessed, and executed under one cryptographic record.",
      },
    ],
  }),
  component: AlphaBravoHome,
});

const STAGES = [
  {
    n: "01",
    title: "Trading",
    tag: "Find, Match & Verify",
    icon: Target,
    body: "Post your opportunity, match with the right counterparty, and review candidates pre-screened for identity, ownership, and sanctions. Verification is mandatory.",
  },
  {
    n: "02",
    title: "Compliance & Governance",
    tag: "Engage",
    icon: ShieldCheck,
    body: "Prove intent to engage with the selected party, engage, agree the terms, complete KYC/KYB, and record supporting evidence.",
  },
  {
    n: "03",
    title: "Execution",
    tag: "Deliver",
    icon: Hammer,
    body: "Turn the agreed match into a real project — plan it, resource it, and track who's involved as it happens.",
  },
  {
    n: "04",
    title: "Finality",
    tag: "Finalize",
    icon: Banknote,
    body: "Close it out: confirm what happened, record any changes, and get sign-off from everyone involved.",
  },
  {
    n: "05",
    title: "Memory",
    tag: "Remember",
    icon: Database,
    body: "Every completed match becomes a searchable record — so the next one goes faster.",
  },
];

function AlphaBravoHome() {
  const { user } = useAuth();
  return (
    <section className="mx-auto max-w-6xl px-5 py-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="max-w-4xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> AI-Powered Trade Matching
          </span>
          <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            Governance Infrastructure Marketplace
          </h1>
          <div className="mt-4">
            <SubmitBidButton size="sm" />
          </div>
        </div>

        {/* Sign in / sign up sits top-right of the hero, level with the badge above the
            headline — a signed-in visitor never sees this page anyway (the root route sends
            them straight to the workspace), so this space would otherwise go empty. */}
        {!user && (
          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
            <AuthTabs compact />
          </div>
        )}
      </div>

      <div className="mt-5 w-full">
        <HeroMatchCard />
      </div>

      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        How a match plays out
      </p>
      <h2 className="mt-2 max-w-2xl text-2xl tracking-tight text-foreground sm:text-3xl">
        Five stages, one governed flow.
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((s) => (
          <div
            key={s.n}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-primary">{s.n}</p>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                <s.icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <h3 className="mt-2.5 text-sm font-medium tracking-tight text-foreground">{s.title}</h3>
            <p className="mt-0.5 text-[11px] font-medium text-primary">{s.tag}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
