import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Database, Hammer, ShieldCheck, Sparkles, Target } from "lucide-react";
import { HeroMatchCard } from "@/components/marketing/HeroMatchCard";
import { SubmitBidButton } from "@/components/marketing/SubmitBidButton";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fallbackReference, when } from "@/lib/tx";
import { registrationInProgress } from "@/lib/registrationFlow";

type Search = { next?: string | undefined };

function safeNext(next: string | undefined) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/live-deal-engine";
}

export const Route = createFileRoute("/_public/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    next: typeof search["next"] === "string" ? (search["next"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Izenzo | Matching Bidders with Counterparties" },
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

/** A signed-in visitor's still-open bids/offers — shown under the search bar on the home screen
 * so relaunching the app (a new tab, a bookmark) surfaces what's already in flight instead of
 * only offering to start something new. Linkable straight into the Live Workspace. */
// Raised from 6: with enough deals in flight, a deal sorted just past the old cutoff (by
// updated_at, not creation order) simply never appeared here — "View all in Trades" below covers
// whatever's still off the end of this list.
const HOME_DEALS_LIMIT = 10;

function ActiveDealsPanel() {
  const { org } = useAuth();

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["home-active-deals", org?.id],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, title, reference, commodity, stage, created_at")
        .or(`org_id.eq.${org!.id},counterparty_org_id.eq.${org!.id}`)
        .not("stage", "in", "(finality,memory)")
        .order("updated_at", { ascending: false })
        .limit(HOME_DEALS_LIMIT);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        title: string | null;
        reference: string | null;
        commodity: string | null;
        stage: string;
        created_at: string;
      }[];
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <p className="label-caps text-muted-foreground">Active bids &amp; offers</p>
      <div className="mt-2.5 space-y-1.5">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : deals.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing open right now.</p>
        ) : (
          deals.map((d) => (
            <Link
              key={d.id}
              to="/live-deal-engine"
              search={{ tx: d.id }}
              className="flex items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/5 px-2.5 py-1.5 text-xs transition-colors hover:border-success/60 hover:bg-success/10"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">
                  {d.reference ?? fallbackReference(d.id, "bid")}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {d.title ?? d.commodity ?? "Untitled"} · Created {when(d.created_at)}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                {d.stage}
              </span>
            </Link>
          ))
        )}
      </div>
      {deals.length === HOME_DEALS_LIMIT && (
        <Link
          to="/trades"
          className="mt-2.5 block text-[11px] font-medium text-primary hover:underline"
        >
          View all in Trades →
        </Link>
      )}
    </div>
  );
}

function AlphaBravoHome() {
  const { user, loading } = useAuth();
  const { next } = Route.useSearch();
  const navigate = useNavigate();

  // A signed-in visitor arriving here for the first time goes straight to the workspace (or the
  // page they were heading to); one who clicked Home from inside the app stays. A signed-out
  // visitor carrying an intended destination is sent to sign in so they return to it.
  useEffect(() => {
    if (loading) return;
    if (user) {
      // A sign-up that is still on its final step stays put — it is signed in already, so without
      // this the wizard would be navigated away from before the document step could render.
      if (registrationInProgress()) return;
      // Only an explicit destination (a deep link that required sign-in) still bounces a
      // signed-in visitor onward — arriving fresh (a new tab, a bookmark, relaunching the app)
      // now lands here, on the home screen, instead of skipping straight past it.
      if (next) navigate({ to: safeNext(next), replace: true });
      return;
    }
    if (next) navigate({ to: "/auth", search: { next }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, next, navigate]);

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
            headline. A signed-in visitor sees their active bids/offers here instead — see
            ActiveDealsPanel below. */}
        {!user && (
          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
            <AuthTabs compact />
          </div>
        )}
      </div>

      <div className="mt-5 w-full">
        <HeroMatchCard />
      </div>

      {/* A signed-in visitor's active deals sit under the search bar, not beside it. */}
      {user && (
        <div className="mt-4">
          <ActiveDealsPanel />
        </div>
      )}

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
