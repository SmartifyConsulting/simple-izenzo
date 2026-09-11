import { useState } from "react";
import {
  Banknote,
  Briefcase,
  CheckCircle2,
  Cog,
  Database,
  FileText,
  Globe,
  Hammer,
  ListChecks,
  Search,
  ShieldCheck,
} from "lucide-react";
import { InlineFrame } from "./DealCanvas";
import { lockReason, stepIndex, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/tx";

type NodeState = "locked" | "open" | "active" | "done";

function nodeState(stage: StageKey, step: string, tx: Transaction): NodeState {
  if (lockReason(stage, step, tx)) return "locked";
  const idx = stepIndex(stage, step);
  const currentIdx = stepIndex(tx.stage, tx.step);
  if (idx < currentIdx) return "done";
  if (idx === currentIdx) return "active";
  return "open";
}

/** Which of the stepper's five numbered steps the deal is actually in right now — matches
 * STEPS' own numbering (Trading, Compliance & Governance, Execution, Finality, Memory). */
function currentStepNumber(tx: Transaction): number {
  if (tx.stage === "execution") return 3;
  if (tx.stage === "finality") return 4;
  if (tx.stage === "memory") return 5;
  if (tx.stage === "compliance") return 2;
  return tx.step === "poi" ? 2 : 1;
}

type SubItem = {
  key: string;
  label: string;
  stage: StageKey;
  step: string;
  icon?: typeof Search;
  sub?: string;
  /** The one item per step that always reads as open/active rather than locked/done — used for
   * "Create a bid or an offer", which starts a fresh registration rather than tracking state. */
  isEntry?: boolean;
};

type StepDef = {
  step: number;
  label: string;
  items: SubItem[];
};

const STEPS: StepDef[] = [
  {
    step: 1,
    label: "Trading",
    items: [
      { key: "bidOffer", label: "Create a bid or an offer", stage: "trading", step: "bid-offer", isEntry: true },
      { key: "search", label: "Search AI + AI+", stage: "trading", step: "search", icon: Search },
      { key: "onlineMedia", label: "Online Media Screening", stage: "trading", step: "online-media", icon: Globe },
      { key: "choice", label: "Choice", stage: "trading", step: "choice", icon: ListChecks },
    ],
  },
  {
    step: 2,
    label: "Compliance & Governance",
    items: [
      { key: "poi", label: "Proof of Intent", stage: "trading", step: "poi", icon: FileText },
      {
        key: "wad",
        label: "Without a Doubt",
        stage: "compliance",
        step: "wad",
        icon: ShieldCheck,
        sub: "Hard gate · non-waivable",
      },
    ],
  },
  {
    step: 3,
    label: "Execution",
    items: [
      { key: "preparation", label: "Project Preparation", stage: "execution", step: "preparation", icon: Briefcase },
      { key: "entry", label: "Execution", stage: "execution", step: "entry", icon: Hammer },
      { key: "concept", label: "Concept", stage: "execution", step: "preparation" },
      { key: "prefeasibility", label: "Pre-feasibility", stage: "execution", step: "preparation" },
      { key: "feasibility", label: "Feasibility", stage: "execution", step: "preparation" },
      { key: "bankability", label: "Bankability", stage: "execution", step: "bankability" },
      { key: "implementation", label: "Implementation", stage: "execution", step: "implementation" },
    ],
  },
  {
    step: 4,
    label: "Finality",
    items: [
      { key: "finality", label: "Finality", stage: "finality", step: "entry", icon: CheckCircle2 },
      { key: "payment", label: "Payment", stage: "finality", step: "type", icon: Banknote },
      { key: "completion", label: "Completion", stage: "finality", step: "record" },
    ],
  },
  {
    step: 5,
    label: "Memory",
    items: [{ key: "memory", label: "Memory", stage: "memory", step: "ledger", icon: Database }],
  },
];

type Collapsed = Record<number, boolean>;

function itemClasses(state: NodeState, isEntry?: boolean) {
  if (isEntry) {
    return state === "open"
      ? "border-[#00e5ff]/60 bg-[#00e5ff]/10 text-[#00e5ff] hover:border-[#00e5ff]"
      : "border-primary/50 bg-primary/12 text-primary";
  }
  return cn(
    state === "done" && "border-primary/50 bg-primary/12 text-primary",
    state === "active" && "border-[#00e5ff] bg-[#00e5ff]/15 text-[#00e5ff] animate-throb-aqua",
    state === "open" && "border-border bg-card text-foreground hover:border-primary/40",
    state === "locked" && "cursor-not-allowed border-border/60 bg-card/50 text-muted-foreground",
  );
}

/** One item in a step's sub-list — a small row, not a diagram node, since the whole view is now
 * a plain vertical list rather than an absolutely-positioned canvas. */
function SubRow({
  item,
  state,
  onClick,
}: {
  item: SubItem;
  state: NodeState;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] font-medium leading-tight transition-colors disabled:cursor-not-allowed",
        itemClasses(state, item.isEntry),
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.sub && (
        <span className="shrink-0 truncate text-[9px] font-semibold uppercase tracking-wide text-[#C1653D]">
          {item.sub}
        </span>
      )}
    </button>
  );
}

/** The cog marker for one step on the vertical stepper — filled/spinning-still for the step
 * the deal is actually in right now, muted otherwise. Doubles as the expand/collapse toggle. */
function StepCog({
  active,
  done,
  collapsed,
  onToggle,
}: {
  active: boolean;
  done: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        active && "border-[#00e5ff] bg-[#00e5ff]/15 text-[#00e5ff] animate-throb-aqua",
        done && !active && "border-primary/60 bg-primary/12 text-primary",
        !active && !done && "border-border bg-card text-muted-foreground hover:border-primary/40",
      )}
    >
      <Cog className="h-5 w-5" />
    </button>
  );
}

/** The Classic view: the whole deal pipeline as a vertical stepper — a column of cog markers,
 * one per numbered step, each expanding to its own list of sub-items. Each item opens that
 * step's form. */
export function ClassicView({
  tx,
  reload,
  readOnly,
  onRegister,
  onOpenStep,
}: {
  tx: Transaction;
  reload: () => void;
  readOnly?: boolean;
  /** Fires when "Create a bid or an offer" is clicked, before any real deal exists — the caller
   * opens the form that actually records it, where the direction itself is picked. */
  onRegister?: () => void;
  /** When given, clicking an item hands the (stage, step) to the caller instead of opening an
   * inline panel here — used to show the step in a Workspace panel alongside the stepper. */
  onOpenStep?: (stage: StageKey, step: string) => void;
}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string } | null>(null);
  const activeStep = currentStepNumber(tx);
  const [collapsed, setCollapsed] = useState<Collapsed>(() => {
    const initial: Collapsed = {};
    for (const s of STEPS) initial[s.step] = s.step !== activeStep;
    return initial;
  });

  const open = (stage: StageKey, step: string) => {
    if (readOnly) return;
    if (onOpenStep) {
      onOpenStep(stage, step);
      return;
    }
    setPanel((p) => (p?.stage === stage && p?.step === step ? null : { stage, step }));
  };

  const toggleStep = (step: number) => setCollapsed((c) => ({ ...c, [step]: !c[step] }));

  const st = (stage: StageKey, step: string) => nodeState(stage, step, tx);
  const active = panel && !readOnly ? panel : null;

  return (
    <div className="relative h-full overflow-y-auto pr-1">
      <div className="flex flex-col">
        {STEPS.map((s, i) => {
          const stepCollapsed = Boolean(collapsed[s.step]);
          const stepIsActive = s.step === activeStep;
          const stepIsDone = s.step < activeStep;
          return (
            <div key={s.step} className="flex gap-4">
              <div className="flex flex-col items-center">
                <StepCog
                  active={stepIsActive}
                  done={stepIsDone}
                  collapsed={stepCollapsed}
                  onToggle={() => toggleStep(s.step)}
                />
                {i < STEPS.length - 1 && <div className="w-px flex-1 bg-border" />}
              </div>

              <div className={cn("min-w-0 flex-1", i < STEPS.length - 1 ? "pb-6" : "pb-1")}>
                <button
                  type="button"
                  onClick={() => toggleStep(s.step)}
                  className="flex h-11 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white transition-colors hover:text-primary"
                  aria-expanded={!stepCollapsed}
                >
                  {stepCollapsed ? "+ " : "− "}Step {s.step} · {s.label}
                </button>

                {!stepCollapsed && (
                  <div className="mt-2 space-y-1.5">
                    {s.items.map((item) => {
                      const state = item.isEntry
                        ? readOnly
                          ? "open"
                          : st(item.stage, item.step)
                        : st(item.stage, item.step);
                      return (
                        <SubRow
                          key={item.key}
                          item={item}
                          state={state}
                          onClick={
                            item.isEntry ? () => onRegister?.() : () => open(item.stage, item.step)
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {active && (
        <InlineFrame
          tx={tx}
          stage={active.stage}
          step={active.step}
          reload={reload}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
