import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPINE, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";

const GATES: { n: string; name: string; status: string; blurb: string; stageKey: StageKey }[] = [
  {
    n: "01",
    name: "Trading Gate",
    status: "NOT STARTED",
    blurb: "Bid and offer, deal documents, counterparties, counter, confirm intent, POI.",
    stageKey: "trading",
  },
  {
    n: "02",
    name: "Compliance Gate",
    status: "NOT STARTED",
    blurb: "WaD — Without a Doubt. KYC, KYB, UBO, PEP, AML/sanctions before Execution.",
    stageKey: "compliance",
  },
  {
    n: "03",
    name: "Execution Gate",
    status: "NOT STARTED",
    blurb: "Project preparation, bankability, implementation, stakeholder entry/exit.",
    stageKey: "execution",
  },
  {
    n: "04",
    name: "Finality Gate",
    status: "NOT STARTED",
    blurb: "Type, change/value event, evidence, validation and the finality record.",
    stageKey: "finality",
  },
  {
    n: "05",
    name: "Memory Gate",
    status: "EMPTY",
    blurb: "Attributable record and Capital Deployment Assessment — hash-chained.",
    stageKey: "memory",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Izenzo — Proof-backed trading, from intent to memory" },
      {
        name: "description",
        content:
          "Izenzo is a trading platform where every step is recorded: trading, compliance, execution, finality and memory. Intent is sealed, not assumed.",
      },
      { property: "og:title", content: "Izenzo — Proof-backed trading" },
      {
        property: "og:description",
        content:
          "The Izenzo Trading Gateway records every step: trading, compliance and governance, execution, finality and memory.",
      },
    ],
  }),
  component: Landing,
});

function GateCard({
  gate,
  staggerMs,
}: {
  gate: (typeof GATES)[number];
  staggerMs: number;
}) {
  const steps = SPINE.find((s) => s.key === gate.stageKey)?.steps ?? [];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (steps.length <= 1) return;
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        setActive((i) => (i + 1) % steps.length);
      }, 1700);
    }, staggerMs);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [steps.length, staggerMs]);

  return (
    <div className="flex min-h-[216px] flex-col rounded-2xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-muted-foreground">{gate.n}</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
          {gate.status}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{gate.name}</h3>
      <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-muted-foreground">{gate.blurb}</p>

      {steps.length > 0 && steps[active] && (
        <div className="mt-4">
          <p key={active} className="animate-in fade-in text-[13px] font-semibold text-primary duration-500">
            {steps[active].label}
          </p>
          <div className="mt-2 flex gap-1">
            {steps.map((s, i) => (
              <span
                key={s.key}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-500",
                  i === active ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-[11px] font-bold text-background">
              IZ
            </span>
            <span className="text-sm font-semibold tracking-tight">Izenzo</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/glossary">
              <Button variant="ghost" size="sm">
                Glossary
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="sm">Create account</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-20">
          <p className="label-caps">Trading · Compliance · Execution · Finality · Memory</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            A transaction is not a conversation. It is a record.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Izenzo carries a trade through the Izenzo Trading Gateway. Every step is written once,
            attributed to a person, timestamped and fingerprinted. Intent is sealed before anything
            moves, and the record can be read forward and backward for as long as it matters.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="gap-2">
                Open a seat <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/glossary">
              <Button size="lg" variant="outline">
                Read the terms
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-lg font-semibold tracking-tight">The Izenzo Trading Gateway</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              The Izenzo Trading Gateway is modular. Each gate can operate as a distinct module, while
              transaction data, approvals and evidence flow forwards and backwards through Trading,
              Compliance, Execution, Finality and Memory. This is enabled by AI, agentic AI and AI+,
              which facilitate a connective network across the Gates.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {GATES.map((gate, i) => (
                <GateCard key={gate.n} gate={gate} staggerMs={i * 220} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold">Proof of Intent is a gate</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Nothing past Trading opens until a person confirms intent and the Proof of Intent is
                sealed. One token, USD 10, charged on the server, not hidden in the interface.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">WaD before execution</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Who and Domicile — KYC, KYB, UBO, sanctions and PEP — must clear before execution can
                begin. Three further tokens, USD 30.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">AI proposes, people decide</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                AI and AI+ read the record and put forward proposals. They are stored as proposals.
                A person adopts them, and that adoption is itself an event.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground">
          <span>Izenzo</span>
          <div className="flex gap-4">
            <Link to="/glossary" className="hover:text-foreground">
              Glossary
            </Link>
            <Link to="/auth" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
