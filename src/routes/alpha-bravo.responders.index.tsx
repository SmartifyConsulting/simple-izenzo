import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ResponderDirectory, ResponderFacetLinks } from "@/components/marketing/ResponderDirectory";

export const Route = createFileRoute("/alpha-bravo/responders/")({
  head: () => ({
    meta: [{ title: "Responders — Izenzo Alpha-Bravo" }],
  }),
  component: Responders,
});

const SECTORS = ["Agriculture", "Logistics", "Metals", "Energy", "Manufacturing"];

const FEATURES = [
  {
    title: "Set your Compliance Profile",
    body: "Configure sector, jurisdiction, deal-size and stage preferences once — every opportunity is screened against it before it reaches you.",
  },
  {
    title: "Curated opportunity flow",
    body: "Bidders submit briefs through Izenzo. You only see opportunities that match your criteria, with fit scores and governance status.",
  },
  {
    title: "Match tracking & outreach",
    body: "Track matches you're in, respond to Bidders directly, and see the full audit trail on every opportunity you've engaged.",
  },
];

const STEPS = [
  { n: "01", title: "Sign up", body: "One-click signup with Google or email." },
  { n: "02", title: "Configure your profile", body: "Pick your sector, jurisdiction, deal size, and stage." },
  { n: "03", title: "Set your risk thresholds", body: "Choose what compliance signals matter to you." },
  { n: "04", title: "Start receiving matches", body: "Opportunities that clear your criteria land in your inbox." },
];

const WHY = [
  "Works across Agriculture, Logistics, Metals, Energy, and Manufacturing",
  "Fit scoring on every incoming opportunity",
  "Public Responder profile Bidders can see",
  "Match tracking and outreach history",
  "No spam — only Bidders who match your criteria",
];

function Responders() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Responders
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-foreground sm:text-5xl">
        Curated opportunity flow that actually matches what you supply.
      </h1>
      <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
        Set up your Compliance Profile once. We surface pre-screened opportunities scored
        against your sector, jurisdiction, and deal size — no more sifting through unqualified
        briefs.
      </p>

      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Get started — pick your sector
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SECTORS.map((s) => (
          <span
            key={s}
            className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
          >
            {s}
          </span>
        ))}
      </div>
      <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-6 inline-block">
        <Button size="lg" className="rounded-full">
          Sign up
        </Button>
      </Link>
      <p className="mt-3 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/auth"
          search={{ mode: "signin", next: undefined }}
          className="font-medium text-primary hover:underline"
        >
          Sign in with facial recognition
        </Link>
      </p>

      <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Built for how Responders actually source
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title}>
            <h3 className="text-base font-medium tracking-tight text-foreground">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Get set up in minutes
      </p>
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.n}>
            <p className="text-sm font-semibold text-primary">{s.n}</p>
            <h3 className="mt-2 text-base font-medium tracking-tight text-foreground">
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>

      <ul className="mt-16 space-y-2">
        {WHY.map((w) => (
          <li key={w} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
            {w}
          </li>
        ))}
      </ul>

      <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        The directory
      </p>
      <h2 className="mt-3 max-w-2xl text-3xl tracking-tight text-foreground sm:text-4xl">
        Verified Responders in our network.
      </h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
        Browse Responders that have cleared Izenzo's compliance screening — every record here is
        live from our database, not a static list.
      </p>
      <ResponderFacetLinks />
      <ResponderDirectory />

      <div className="mt-16 text-center">
        <h2 className="text-2xl tracking-tight text-foreground sm:text-3xl">
          Ready to see better opportunities?
        </h2>
        <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-6 inline-block">
          <Button size="lg" className="rounded-full">
            Sign up
          </Button>
        </Link>
        <p className="mt-6 text-sm text-muted-foreground">
          Are you a Bidder?{" "}
          <Link to="/alpha-bravo/bidders" className="font-medium text-primary hover:underline">
            Post an opportunity instead →
          </Link>
        </p>
      </div>
    </section>
  );
}
