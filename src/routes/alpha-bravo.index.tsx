import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Lock, ShieldCheck, MailX, DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthTabs } from "@/components/auth/AuthTabs";

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

const PROMISE = [
  {
    icon: Lock,
    title: "Brief Stays Private",
    body: "Your opportunity brief is encrypted and is never shared without your explicit consent.",
  },
  {
    icon: ShieldCheck,
    title: "Double Opt-In Only",
    body: "Introductions only happen when both Bidder and Responder agree to connect.",
  },
  {
    icon: MailX,
    title: "No Spam, Ever",
    body: "We never send unsolicited outreach. You control every message from your account.",
  },
  {
    icon: DatabaseZap,
    title: "Data Never Sold",
    body: "Your information is never sold to third parties. Period. Full stop.",
  },
];

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
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 py-24 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Pre-vetted · Governed marketplace
            </p>
            <h1 className="mt-6 max-w-3xl text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              Find the right Responders
              <br />
              in minutes, not months.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Post your opportunity brief and get matched with verified Responders — fit scores,
              verified contacts, and ready-to-send outreach, all under one cryptographic record.
            </p>
            <ul className="mt-6 space-y-1.5 text-sm text-muted-foreground">
              <li>See 3 matches free</li>
              <li>Your brief stays private</li>
              <li>Double opt-in only</li>
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/alpha-bravo/trades">
                <Button size="lg" variant="outline" className="gap-1.5 rounded-full">
                  See how matching works <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup", next: undefined }}
                className="text-sm font-medium text-primary hover:underline"
              >
                Are you a Responder? Sign up here →
              </Link>
            </div>
          </div>

          <AuthTabs className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm" />
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Our promise
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl tracking-tight text-foreground sm:text-4xl">
            Your privacy is our priority.
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISE.map((p) => (
              <div key={p.title}>
                <p.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-base font-medium tracking-tight text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            How a match plays out
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl tracking-tight text-foreground sm:text-4xl">
            Five stages, one governed flow.
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {STAGES.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-primary">{s.n}</p>
                <h3 className="mt-3 text-base font-medium tracking-tight text-foreground">{s.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s.tag}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
