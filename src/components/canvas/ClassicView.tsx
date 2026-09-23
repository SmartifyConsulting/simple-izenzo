import { useEffect, useRef, useState } from "react";
import {
  Banknote,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSearch,
  FileText,
  FolderClosed,
  Gavel,
  Globe,
  Hammer,
  Handshake,
  Landmark,
  Lightbulb,
  ListChecks,
  PackageCheck,
  PlayCircle,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { InlineFrame } from "./DealCanvas";
import { ArtefactHint } from "./ArtefactHint";
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
  /** Nests this row under the group heading directly above it (e.g. Concept/Pre-feasibility/
   * Feasibility/Bankability under "Project Preparation") rather than reading as its own peer. */
  indent?: boolean;
  /** A grouping label for the rows beneath it, not a task — rendered as plain small caps with a
   * hairline rule, never as a pill, so it can't be mistaken for something to click. */
  heading?: boolean;
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
      { key: "bidRegistration", label: "Bid Registration", stage: "trading", step: "bid-offer", icon: Gavel, isEntry: true },
      { key: "docSubmission", label: "Upload Files", stage: "trading", step: "bid-offer", icon: Upload },
      { key: "search", label: "Search", sub: "Matching", stage: "trading", step: "search", icon: Search },
      { key: "choice", label: "Choice", stage: "trading", step: "choice", icon: ListChecks },
      { key: "onlineMedia", label: "Online Media Screening", stage: "trading", step: "online-media", icon: Globe },
      { key: "intent", label: "Confirm Intent", stage: "trading", step: "intent", icon: Handshake },
    ],
  },
  {
    step: 2,
    label: "Compliance & Governance",
    items: [
      { key: "poi", label: "Seal Intent", stage: "trading", step: "poi", icon: FileText },
      {
        key: "wad",
        label: "Without a Doubt",
        stage: "compliance",
        step: "wad",
        icon: ShieldCheck,
        sub: "Hard gate · non-waivable",
      },
      { key: "businessDocs", label: "Business Docs", stage: "execution", step: "business-docs", icon: FolderClosed },
    ],
  },
  {
    step: 3,
    label: "Execution",
    items: [
      {
        key: "preparation",
        label: "Project Preparation",
        stage: "execution",
        step: "preparation",
        icon: Briefcase,
        heading: true,
      },
      { key: "concept", label: "Concept", stage: "execution", step: "preparation", icon: Lightbulb, indent: true },
      { key: "prefeasibility", label: "Pre-feasibility", stage: "execution", step: "preparation", icon: FileSearch, indent: true },
      { key: "feasibility", label: "Feasibility", stage: "execution", step: "preparation", icon: ClipboardCheck, indent: true },
      { key: "bankability", label: "Bankability", stage: "execution", step: "bankability", icon: Landmark, indent: true },
      { key: "entry", label: "Execution", stage: "execution", step: "entry", icon: Hammer, heading: true },
      { key: "implementation", label: "Implementation", stage: "execution", step: "implementation", icon: PlayCircle, indent: true },
    ],
  },
  {
    step: 4,
    label: "Finality",
    items: [
      { key: "payment", label: "Payment", stage: "finality", step: "type", icon: Banknote },
      { key: "signoff", label: "Signoff", stage: "finality", step: "validation", icon: CheckCircle2 },
      { key: "handover", label: "Handover", stage: "finality", step: "record", icon: PackageCheck },
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
  // Finished work reads as a plain ticked line — no pill frame around it.
  if (state === "done") return "border-transparent bg-transparent text-success";
  if (isEntry) {
    return state === "open"
      ? "border-primary/60 bg-primary/10 text-primary hover:border-primary"
      : "border-primary/50 bg-primary/12 text-primary";
  }
  return cn(
    state === "active" && "border-primary bg-primary/15 text-primary animate-throb-aqua",
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
  collapsed,
  onToggle,
}: {
  item: SubItem;
  state: NodeState;
  onClick?: () => void;
  /** Headings only: whether the rows beneath this heading are hidden right now. */
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const Icon = item.icon;
  // A grouping label, not a task: no pill and no border — just small caps with a hairline rule, so
  // the rows beneath it read as its children. It can be collapsed with the −/+ marker in front.
  if (item.heading) {
    return (
      <div className="flex items-center gap-2 pt-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="label-caps whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
        >
          {collapsed ? "+" : "−"}
          {item.label}
        </button>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-left font-sans text-[13px] font-medium leading-snug transition-colors disabled:cursor-not-allowed",
        // Nested under the group heading directly above it, rather than reading as a full-width
        // peer of its own.
        item.indent ? "ml-4 w-[calc(100%-1rem)]" : "w-full",
        // A step the page has explicitly marked done or in-progress reads as such, even when it is
        // also the "start a new bid" entry row — otherwise every override on it would be ignored.
        itemClasses(state, item.isEntry && state !== "done" && state !== "active"),
      )}
    >
      {state === "done" ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : (
        Icon && <Icon className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 break-words">
          {item.label}
          <ArtefactHint step={item.step} />
        </span>
        {item.sub && (
          <span className="block text-[9px] font-semibold uppercase tracking-wide text-[#C1653D]">
            {item.sub}
          </span>
        )}
      </span>
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
  overrideStates,
}: {
  tx: Transaction;
  reload: () => void;
  readOnly?: boolean;
  /** Lets the page say which item is genuinely current right now (keyed by SubItem.key) — the
   * stored stage/step alone can't tell "searching" from "results are in". */
  overrideStates?: Record<string, NodeState>;
  /** Fires when "Create a bid or an offer" is clicked, before any real deal exists — the caller
   * opens the form that actually records it, where the direction itself is picked. */
  onRegister?: () => void;
  /** When given, clicking an item hands the (stage, step) to the caller instead of opening an
   * inline panel here — used to show the step in a Workspace panel alongside the stepper. */
  onOpenStep?: (stage: StageKey, step: string, viewOnly: boolean) => void;
}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string } | null>(null);
  const activeStep = currentStepNumber(tx);
  const [collapsed, setCollapsed] = useState<Collapsed>(() => {
    const initial: Collapsed = {};
    for (const s of STEPS) initial[s.step] = s.step !== activeStep;
    return initial;
  });
  // The workflow moving on to the next numbered step folds the finished one away and opens the new
  // one, without touching whatever the user has since opened or closed by hand.
  const lastActiveStep = useRef(activeStep);
  useEffect(() => {
    if (lastActiveStep.current === activeStep) return;
    const previous = lastActiveStep.current;
    lastActiveStep.current = activeStep;
    setCollapsed((c) => ({ ...c, [previous]: true, [activeStep]: false }));
  }, [activeStep]);

  // A "done" row is a past stage — clicking it does nothing for now (see MapView.tsx for why).
  const open = (stage: StageKey, step: string, viewOnly = false) => {
    if (readOnly || viewOnly) return;
    if (onOpenStep) {
      onOpenStep(stage, step, viewOnly);
      return;
    }
    setPanel((p) => (p?.stage === stage && p?.step === step ? null : { stage, step }));
  };
  // Which grouping headings (Project Preparation, Execution) are folded shut. Both start open.
  const [collapsedHeadings, setCollapsedHeadings] = useState<Record<string, boolean>>({});
  const toggleHeading = (key: string) =>
    setCollapsedHeadings((c) => ({ ...c, [key]: !c[key] }));
  /** Drops the indented rows that belong to a collapsed heading. */
  const withoutHiddenRows = (items: SubItem[]) => {
    let hiding = false;
    return items.filter((item) => {
      if (item.heading) {
        hiding = Boolean(collapsedHeadings[item.key]);
        return true;
      }
      if (!item.indent) hiding = false;
      return !(hiding && item.indent);
    });
  };

  const toggleStep = (step: number) => setCollapsed((c) => ({ ...c, [step]: !c[step] }));

  const stateOf = (item: SubItem): NodeState => {
    const override = overrideStates?.[item.key];
    if (override) return override;
    if (item.isEntry && readOnly) {
      // Still pulses together with the rest of the current step on the read-only preview (the
      // empty "New" canvas) — only pinned to "open" so it never reads as done/locked there.
      const natural = nodeState(item.stage, item.step, tx);
      return natural === "active" ? "active" : "open";
    }
    return nodeState(item.stage, item.step, tx);
  };
  const active = panel && !readOnly ? panel : null;

  return (
    <div className="relative h-full overflow-y-auto pr-1">
      <div className="flex flex-col">
        {STEPS.map((s) => {
          const stepCollapsed = Boolean(collapsed[s.step]);
          // A confirmed Intent finishes every Trading task, so Step 1 reads as complete even
          // before the page states each row outright.
          const allDone =
            s.items.every((item) => stateOf(item) === "done") ||
            (s.step === 1 && Boolean(tx.intent_confirmed_at));
          // Bracket + "Step N · " (no step name) — an invisible copy of this is used below to
          // indent the sub-steps by exactly this width, so they line up under the first letter of
          // the step's actual name (e.g. under the "T" of "Trading") rather than under the
          // bracket or the step number.
          const bracketAndPrefix = (
            <>
              <span
                aria-hidden
                className="select-none font-serif text-3xl leading-[0.6] text-muted-foreground/50"
              >
                {"{"}
              </span>
              {/* Step names read as pills now — "Step N ·" and the step's own name share one
                  pill background, going green together once the step is complete. */}
              <span
                className={cn(
                  "label-caps mt-1 whitespace-nowrap rounded-l-full px-2.5 py-0.5",
                  allDone ? "bg-success/15 text-success" : "bg-[var(--step-pill-bg)] text-[var(--step-pill-fg)]",
                )}
              >
                {stepCollapsed ? "+" : "−"}Step {s.step} ·{" "}
              </span>
            </>
          );
          return (
            <div key={s.step} className="flex flex-col pb-3">
              {/* The original bracket treatment: a large serif "{" instead of a cog/connector
                  column, matching the Ink & Aqua "Next steps" list this stepper replaced. */}
              <button
                type="button"
                onClick={() => toggleStep(s.step)}
                aria-expanded={!stepCollapsed}
                className="flex w-full shrink-0 items-start gap-2 text-left"
              >
                {bracketAndPrefix}
                <span
                  className={cn(
                    "label-caps -ml-2 mt-1 whitespace-nowrap rounded-r-full px-2.5 py-0.5 transition-colors",
                    allDone ? "bg-success/15 text-success" : "bg-[var(--step-pill-bg)] text-[var(--step-pill-fg)] hover:brightness-110",
                  )}
                >
                  {s.label}
                </span>
                {/* A finished step keeps its tick on the heading itself, so completion still reads
                    at a glance while its sub-tasks are collapsed. */}
                {allDone && <CheckCircle2 className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-success" />}
              </button>

              {!stepCollapsed && (
                <div className="flex items-start gap-2 pt-2">
                  {/* Invisible twin of the bracket + "Step N · " above — the outer span takes the
                      natural width of that text, and the inner one shows half of it, so the
                      sub-steps sit halfway between the bracket and the step name. */}
                  <span aria-hidden className="invisible w-max shrink-0">
                    <span className="flex w-1/4 items-start gap-2 overflow-hidden whitespace-nowrap">
                      {bracketAndPrefix}
                    </span>
                  </span>
                  {/* Every sub-step (ticked or not) sits 1cm further left than the indent above
                      would otherwise put it. */}
                  {/* An expanded step always lists every one of its activities — a finished one
                      keeps them all visible, each with its own tick, rather than collapsing them
                      into a single summary line. */}
                  <div className="-ml-[1cm] min-w-0 flex-1">
                    <div className="space-y-1.5">
                      {withoutHiddenRows(s.items).map((item) => (
                        <SubRow
                          key={item.key}
                          item={item}
                          state={allDone && !item.heading ? "done" : stateOf(item)}
                          collapsed={Boolean(collapsedHeadings[item.key])}
                          onToggle={() => toggleHeading(item.key)}
                          onClick={
                            item.isEntry
                              ? () => onRegister?.()
                              : () =>
                                  open(
                                    item.stage,
                                    item.step,
                                    (allDone && !item.heading ? "done" : stateOf(item)) === "done",
                                  )
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
