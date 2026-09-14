import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/alpha-bravo/bidders")({
  head: () => ({
    meta: [{ title: "Bidders — Izenzo Alpha-Bravo" }],
  }),
  component: Bidders,
});

const TOOLS = [
  {
    title: "Counterparty Match",
    body: "Upload your opportunity and get the best-fit verified Counterparties, plus how to reach them.",
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
    body: "Turn a rough opportunity into a structured brief a Counterparty can act on.",
  },
];

const FAQS = [
  {
    q: "What stage can I post an opportunity at?",
    a: "Any stage. Posting an opportunity opens the Trading Gate with a Bid/Offer — you don't need a finished deal to start. From there, Izenzo runs Search and AI-assisted matching to surface counterparties before you commit to anything.",
  },
  {
    q: "What do you require before matching?",
    a: "Just your Bid/Offer terms and any supporting documents (attached with a fingerprint). Full verification isn't required to be matched — it happens later, once you and a Counterparty choose to move forward.",
  },
  {
    q: "How do I get verified?",
    a: "Verification runs through a WaD case in the Compliance Gate — identity, ownership (UBO), and sanctions/PEP screening. It's a hard gate: 3 tokens, and it clears (or the match doesn't proceed to Execution). There's no way to skip it.",
  },
  {
    q: "Where does Izenzo operate?",
    a: "Izenzo is the trading name of Starfair162 (Pty) Ltd (Reg: 2018 / 331720 / 07). The platform itself is jurisdiction-agnostic — matches and counterparty screening cover multiple regions, tracked per-transaction.",
  },
];

function Bidders() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Bidders
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-foreground sm:text-5xl">
        Post an opportunity, get matched with verified Counterparties.
      </h1>
      <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
        Whether or not you're ready to transact today, use our free tools to get your
        opportunity match-ready.
      </p>
      <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-8 inline-block">
        <Button size="lg" className="rounded-full">
          Tell us about your opportunity
        </Button>
      </Link>

      <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
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

      <p className="mt-16 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Common questions
      </p>
      <Accordion type="single" collapsible className="mt-6">
        {FAQS.map((f) => (
          <AccordionItem key={f.q} value={f.q}>
            <AccordionTrigger className="text-foreground">{f.q}</AccordionTrigger>
            <AccordionContent className="leading-relaxed text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
