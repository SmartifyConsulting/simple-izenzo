import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SPINE, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

type GateStatus = "IN PROGRESS" | "LOCKED" | "EMPTY";

const GATES: { n: string; name: string; status: GateStatus; blurb: string; stageKey: StageKey }[] = [
  {
    n: "01",
    name: "Trading Gate",
    status: "IN PROGRESS",
    blurb: "Bid and offer, deal documents, counterparties, counter, confirm intent, POI.",
    stageKey: "trading",
  },
  {
    n: "02",
    name: "Compliance Gate",
    status: "LOCKED",
    blurb: "WaD — Without a Doubt. KYC, KYB, UBO, PEP, AML/sanctions before Execution.",
    stageKey: "compliance",
  },
  {
    n: "03",
    name: "Execution Gate",
    status: "LOCKED",
    blurb: "Project preparation, bankability, implementation, stakeholder entry/exit.",
    stageKey: "execution",
  },
  {
    n: "04",
    name: "Finality Gate",
    status: "LOCKED",
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

const STATUS_BADGE_CLASS: Record<GateStatus, string> = {
  "IN PROGRESS": "bg-warning/20 text-warning-foreground",
  LOCKED: "bg-muted text-muted-foreground",
  EMPTY: "bg-muted text-muted-foreground",
};

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

const GATE_CARD_CLASS =
  "flex min-h-[190px] flex-col rounded-2xl border-2 bg-background p-5 text-left shadow-sm transition-all";
const GATE_CARD_SELECTED = "border-primary bg-primary/[0.06] shadow-lg ring-4 ring-primary/15";
const GATE_CARD_IDLE = "border-border hover:border-foreground/30";

function GateCardInner({ gate, selected }: { gate: (typeof GATES)[number]; selected: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-mono text-[11px]",
            selected ? "text-primary" : "text-muted-foreground",
          )}
        >
          {gate.n}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
            STATUS_BADGE_CLASS[gate.status],
          )}
        >
          {gate.status}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{gate.name}</h3>
      <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-muted-foreground">{gate.blurb}</p>
    </>
  );
}

/** Signed out: click toggles the step preview below. Signed in: click opens the gate for real. */
function GateCard({
  gate,
  selected,
  onSelect,
  href,
}: {
  gate: (typeof GATES)[number];
  selected: boolean;
  onSelect: () => void;
  href?: "/transactions/new" | "/dashboard" | undefined;
}) {
  const className = cn(GATE_CARD_CLASS, selected ? GATE_CARD_SELECTED : GATE_CARD_IDLE);

  if (href) {
    return (
      <Link to={href} className={className}>
        <GateCardInner gate={gate} selected={selected} />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={className}>
      <GateCardInner gate={gate} selected={selected} />
    </button>
  );
}

function GateStepStrip({ gate }: { gate: (typeof GATES)[number] }) {
  const steps = SPINE.find((s) => s.key === gate.stageKey)?.steps ?? [];
  return (
    <div className="mt-4 animate-in fade-in slide-in-from-top-1 rounded-xl border border-border bg-background p-4 duration-300">
      <p className="label-caps">
        {gate.n} · {gate.name.toUpperCase()}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {steps.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-muted px-3 py-1.5 text-[13px] font-medium text-foreground"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Landing() {
  const [selectedGate, setSelectedGate] = useState<number | null>(null);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="flex flex-col lg:flex-row">
          <div className="flex flex-1 flex-col justify-center bg-sidebar px-6 py-16 text-sidebar-foreground sm:px-10 sm:py-20 lg:px-16">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-sidebar-foreground/55">
                Trading · Compliance · Execution · Finality · Memory
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
                A transaction is not a conversation. It is a record.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-sidebar-foreground/75">
                Izenzo carries a trade through the Izenzo Trading Gateway. Every step is written once,
                attributed to a person, timestamped and fingerprinted. Intent is sealed before anything
                moves, and the record can be read forward and backward for as long as it matters.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="mailto:support@izenzo.co.za?subject=Demo%20request&body=I'd%20like%20to%20request%20a%20demo%20of%20the%20Izenzo%20Trading%20Gateway.">
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
          </div>

          <div className="flex flex-1 items-center justify-center bg-sidebar px-5 py-16 sm:py-20">
            {user ? (
              <div className="w-full max-w-sm rounded-2xl bg-background p-8 text-center shadow-xl">
                <p className="text-sm text-muted-foreground">You already have a seat.</p>
                <Link to="/dashboard" className="mt-4 inline-block">
                  <Button size="lg" className="gap-2">
                    Go to dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <AuthTabs className="w-full max-w-sm rounded-2xl bg-background p-8 shadow-xl" />
            )}
          </div>
        </section>

        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-lg font-semibold tracking-tight">The Izenzo Trading Gateway</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              The Izenzo Trading Gateway is modular. Each gate can operate as a distinct module, while
              transaction data, approvals and evidence flow forwards and backwards through Trading,
              Compliance, Execution, Finality and Memory.
              <br />
              This is enabled by AI, agentic AI and AI+, which facilitate a connective network across
              the Gates.
            </p>
            <p className="mt-8 flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">
              <Gauge className="h-3.5 w-3.5 shrink-0" />
              Pay only for what you use. Zero subscriptions. Zero lock-ins.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {GATES.map((gate, i) => (
                <GateCard
                  key={gate.n}
                  gate={gate}
                  selected={i === selectedGate}
                  onSelect={() => setSelectedGate((cur) => (cur === i ? null : i))}
                  href={user ? (gate.stageKey === "trading" ? "/transactions/new" : "/dashboard") : undefined}
                />
              ))}
            </div>

            {!user && selectedGate !== null && <GateStepStrip gate={GATES[selectedGate]!} />}
          </div>
        </section>

        <section className="bg-sidebar text-white">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Proof of Intent is a gate</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Nothing past Trading opens until a person confirms intent and the Proof of Intent is
                  sealed. One token, USD 10, charged on the server, not hidden in the interface.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">WaD before execution</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Without a Doubt — KYC, KYB, UBO, sanctions and PEP — must clear before execution can
                  begin. Three further tokens, USD 30.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">AI proposes, people decide</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  AI and AI+ read the record and put forward proposals. They are stored as proposals.
                  A person adopts them, and that adoption is itself an event.
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
