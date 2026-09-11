import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/alpha-bravo/bidders")({
  head: () => ({
    meta: [{ title: "Bidders — Izenzo Alpha-Bravo" }],
  }),
  component: Bidders,
});

const TOOLS = [
  {
    title: "Responder Match",
    body: "Upload your opportunity and get the best-fit verified Responders, plus how to reach them.",
  },
  {
    title: "WaD Readiness Check",
    body: "See whether your opportunity clears the non-waivable compliance gate before you post it.",
  },
  {
    title: "KYC/KYB Pre-Check",
    body: "A quick read on what evidence you'll need to clear verification.",
  },
  {
    title: "Deal Structuring Assistant",
    body: "Turn a rough opportunity into a structured brief a Responder can act on.",
  },
];

const FAQS = [
  "What stage can I post an opportunity at?",
  "What do you require before matching?",
  "How do I get verified?",
  "Where does Izenzo operate?",
];

function Bidders() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-5 py-20 sm:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Bidders
        </p>
        <h1 className="mt-4 text-4xl tracking-tight text-foreground sm:text-5xl">
          Post an opportunity, get matched with verified Responders.
        </h1>
        <p className="mt-6 leading-relaxed text-muted-foreground">
          Whether or not you're ready to transact today, use our free tools to get your
          opportunity match-ready.
        </p>
        <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-8 inline-block">
          <Button size="lg" className="rounded-full">
            Tell us about your opportunity
          </Button>
        </Link>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Free tools
          </p>
          <h2 className="mt-3 text-2xl tracking-tight text-foreground sm:text-3xl">
            Free tools to help you match.
          </h2>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {TOOLS.map((t) => (
              <div key={t.title} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-base font-medium tracking-tight text-foreground">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Common questions
          </p>
          <div className="mt-6 divide-y divide-border border-t border-border">
            {FAQS.map((q) => (
              <p key={q} className="py-4 text-sm font-medium text-foreground">
                {q}
              </p>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
