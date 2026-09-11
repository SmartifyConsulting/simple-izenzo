import { useState } from "react";
import {
  Banknote,
  Briefcase,
  CheckCircle2,
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

/** Which of the diagram's five numbered step groups the deal is actually in right now — matches
 * GROUPS' own numbering (Trading, Compliance & Governance, Execution, Finality, Memory). */
function currentStepNumber(tx: Transaction): number {
  if (tx.stage === "execution") return 3;
  if (tx.stage === "finality") return 4;
  if (tx.stage === "memory") return 5;
  if (tx.stage === "compliance") return 2;
  return tx.step === "poi" ? 2 : 1;
}

// Diagram coordinate system — everything below is placed on this fixed canvas and scaled to the
// container with percentages, so boxes and their connecting arrows always stay aligned with each
// other regardless of viewport width. The canvas is deliberately wide-and-short so the whole
// workflow fits on screen without scrolling.
const W = 1246;
const pctX = (v: number) => `${(v / W) * 100}%`;

const ROW = 42; // shared node height
const PITCH = 72; // vertical distance from one row's top to the next
const CENTER_W = 310; // shared width for the center-column nodes, matched to Choice
const SIDE_W = 220;
const TOP_Y = 20;
// Extra vertical room between the Step 1 and Step 2 frames — without it the two frames' borders
// (and Step 2's "Step 2 · Compliance & Governance" label, which sits above its own frame) overlap.
const STEP2_GAP_EXTRA = 61;
// A little breathing room before the three parallel branches split off from Without a Doubt.
const BRANCH_Y = TOP_Y + PITCH * 6 + 58 + STEP2_GAP_EXTRA;

const GROUP_PAD = 18;
// Used where two frames sit close together (Step 1 above Step 2), so their borders don't overlap.
const GROUP_PAD_TIGHT = 10;
// A touch more height on the Step 1 frame so its bottom border stays clear of the Step 2 label.
const STEP1_EXTRA_H = 10;
// Gap between the Step 2 frame's top border and the Proof of Intent box it contains, so the
// "Step 2 · Compliance & Governance" label (which sits above that border) doesn't crowd it.
const STEP2_TOP_PAD = GROUP_PAD_TIGHT + 12;


// Steps 3, 4 and 5 stack vertically, one frame under the next, all sharing the same left edge
// and width as the Execution frame.
const S3_W = 556;
const COL_GAP = (W - S3_W) / 2;
const S3_X = COL_GAP;

// Inner content bounds of the Execution frame.
const S3_L = S3_X + GROUP_PAD;
const S3_R = S3_X + S3_W - GROUP_PAD;

const PREP_W = 300;
const SUB_W = 145;
const EXEC_W = 190;
const FIN_W = S3_W - GROUP_PAD * 2;
const MEM_W = S3_W - GROUP_PAD * 2;
// Vertical gap between the stacked Step 3 → Step 4 → Step 5 frames.
const STACK_GAP = 46;
// Bottom edge of the Execution frame (Project Preparation/Concept/Pre-feasibility/Feasibility/
// Bankability, 3 rows tall) — Step 4's frame starts STACK_GAP below this.
const STEP3_BOTTOM = BRANCH_Y + PITCH * 2 + ROW + GROUP_PAD;
const FIN_Y = STEP3_BOTTOM + STACK_GAP + GROUP_PAD;
// Bottom edge of the Finality frame (Finality/Payment/Completion, 3 rows tall) — Step 5's frame
// starts STACK_GAP below this.
const STEP4_BOTTOM = FIN_Y + PITCH * 2 + ROW + GROUP_PAD;
const MEM_Y = STEP4_BOTTOM + STACK_GAP + GROUP_PAD;

// Canvas height follows from the content — Step 3, 4 and 5 now stack instead of sitting
// side by side, so the diagram is taller than it is wide.
const H = MEM_Y + ROW + GROUP_PAD + 20;
const pctY = (v: number) => `${(v / H) * 100}%`;

type Box = { x: number; y: number; w: number; h: number };
// Left edge shared by the Trading, Compliance & Governance and Execution frames, so Steps 1, 2
// and 3 all line up on the same left margin.
const STEP_X = S3_L;
// Bid/Offer sit directly above Search, one on each half of its width, so both feed straight down
// into it — the two starting moves converging on the one search step, instead of routing through
// separate Load Docs / Counterparty boxes first.
const BID_OFFER_GAP = 10;
const BID_OFFER_W = (CENTER_W - BID_OFFER_GAP) / 2;
const BOXES = {
  bid: { x: STEP_X, y: TOP_Y, w: BID_OFFER_W, h: ROW },
  offer: { x: STEP_X + BID_OFFER_W + BID_OFFER_GAP, y: TOP_Y, w: BID_OFFER_W, h: ROW },

  search: { x: STEP_X, y: TOP_Y + PITCH, w: CENTER_W, h: ROW },

  // In the main sequence between Search and Choice, not off to the side.
  surfaceRoutes: { x: STEP_X, y: TOP_Y + PITCH * 2, w: CENTER_W, h: ROW },
  choice: { x: STEP_X, y: TOP_Y + PITCH * 3, w: CENTER_W, h: ROW },

  poi: { x: STEP_X, y: TOP_Y + PITCH * 4 + STEP2_GAP_EXTRA, w: CENTER_W, h: ROW },
  wad: { x: STEP_X, y: TOP_Y + PITCH * 5 + STEP2_GAP_EXTRA, w: CENTER_W, h: ROW },

  projectPrep: { x: S3_L, y: BRANCH_Y, w: PREP_W, h: ROW },
  execution: { x: S3_R - EXEC_W, y: BRANCH_Y, w: EXEC_W, h: ROW },

  // Sub-nodes align with the nearest edge of their parent: Concept/Feasibility flush with Project
  // Preparation's left edge, Pre-feasibility/Bankability flush with its right edge.
  concept: { x: S3_L, y: BRANCH_Y + PITCH, w: SUB_W, h: ROW },
  prefeasibility: { x: S3_L + PREP_W - SUB_W, y: BRANCH_Y + PITCH, w: SUB_W, h: ROW },
  implementation: { x: S3_R - EXEC_W, y: BRANCH_Y + PITCH, w: EXEC_W, h: ROW },

  feasibility: { x: S3_L, y: BRANCH_Y + PITCH * 2, w: SUB_W, h: ROW },
  bankability: { x: S3_L + PREP_W - SUB_W, y: BRANCH_Y + PITCH * 2, w: SUB_W, h: ROW },

  // Step 4 (Finality) stacks directly under Step 3, same left edge and width.
  finality: { x: S3_L, y: FIN_Y, w: FIN_W, h: ROW },
  payment: { x: S3_L, y: FIN_Y + PITCH, w: FIN_W, h: ROW },
  completion: { x: S3_L, y: FIN_Y + PITCH * 2, w: FIN_W, h: ROW },

  // Step 5 (Memory) stacks directly under Step 4, same left edge and width.
  memory: { x: S3_L, y: MEM_Y, w: MEM_W, h: ROW },

} as const satisfies Record<string, Box>;

// Connector points sit exactly on each box's border, so a line leaves touching the box it comes
// from and its arrowhead tip lands on the border of the box it points at.
const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;
const top = (b: Box) => ({ x: cx(b), y: b.y });
const bottom = (b: Box) => ({ x: cx(b), y: b.y + b.h });
const left = (b: Box) => ({ x: b.x, y: cy(b) });
const right = (b: Box) => ({ x: b.x + b.w, y: cy(b) });
// A point partway along a box's top edge — used to give Bid and Offer their own distinct landing
// spot on Search's top edge instead of both arrows converging on the exact same center point.
const topAt = (b: Box, frac: number) => ({ x: b.x + b.w * frac, y: b.y });

type Point = { x: number; y: number };
/** An elbow connector: straight from `a`, turning once, ending at `b`. `via: "x"` turns
 * horizontally first then vertically (so the final leg is vertical, and the arrowhead points
 * down — use this when `b` is a box's top/bottom); `"y"` turns vertically first then
 * horizontally (final leg horizontal — use when `b` is a box's left/right). */
function elbow(a: Point, b: Point, via: "x" | "y" = "y"): string {
  const mid: Point = via === "y" ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
  return `M ${a.x} ${a.y} L ${mid.x} ${mid.y} L ${b.x} ${b.y}`;
}

/** A tree connector: a short vertical stub leaves `a`'s border before the line fans out along a
 * shared trunk — so multiple branches leaving the same point don't bunch up right at the box
 * border — then drops straight down into each target so every arrowhead points down. */
function branchDown(a: Point, targets: Point[], stub = 26): string[] {
  const trunkY = a.y + stub;
  return targets.map((t) => `M ${a.x} ${a.y} L ${a.x} ${trunkY} L ${t.x} ${trunkY} L ${t.x} ${t.y}`);
}

const ARROWS: { d: string; arrow?: boolean }[] = [
  { d: elbow(bottom(BOXES.bid), topAt(BOXES.search, 0.28), "x") },
  { d: elbow(bottom(BOXES.offer), topAt(BOXES.search, 0.72), "x") },
  { d: elbow(bottom(BOXES.search), top(BOXES.surfaceRoutes), "x") },
  { d: elbow(bottom(BOXES.surfaceRoutes), top(BOXES.choice), "x") },
  { d: elbow(bottom(BOXES.choice), top(BOXES.poi), "x") },
  { d: elbow(bottom(BOXES.poi), top(BOXES.wad), "x") },
  ...branchDown(
    bottom(BOXES.wad),
    [top(BOXES.projectPrep), top(BOXES.execution), top(BOXES.finality)],
    44,
  ).map((d) => ({ d })),

  { d: elbow(bottom(BOXES.execution), top(BOXES.implementation), "x") },
  { d: elbow(bottom(BOXES.finality), top(BOXES.payment), "x") },
  { d: elbow(bottom(BOXES.payment), top(BOXES.completion), "x") },
  { d: elbow(bottom(BOXES.completion), top(BOXES.memory), "x") },
  ...branchDown(
    bottom(BOXES.projectPrep),
    [top(BOXES.concept), top(BOXES.prefeasibility)],
    14,
  ).map((d) => ({ d })),

  { d: elbow(bottom(BOXES.concept), top(BOXES.feasibility), "x") },
  { d: elbow(bottom(BOXES.prefeasibility), top(BOXES.bankability), "x") },
];


// Frames the diagram into the same 5 stages as the Journey banner above it — Step 1 (Trading,
// everything through Choice), Step 2 (Compliance & Governance: POI, WaD), Step 3
// (Execution, spanning Project Preparation through Implementation), Step 4 (Finality) and Step 5
// (Memory).
const GROUPS: { label: string; step: number; box: Box; emphasis?: boolean }[] = [
  {
    label: "Trading",
    step: 1,
    emphasis: true,
    box: {
      x: BOXES.bid.x - GROUP_PAD,
      y: BOXES.bid.y - GROUP_PAD,
      w: CENTER_W + GROUP_PAD * 2,
      h: BOXES.choice.y + ROW - BOXES.bid.y + GROUP_PAD + GROUP_PAD_TIGHT + STEP1_EXTRA_H,
    },
  },
  {
    label: "Compliance & Governance",
    step: 2,
    box: {
      x: BOXES.poi.x - GROUP_PAD,
      y: BOXES.poi.y - STEP2_TOP_PAD,
      w: BOXES.poi.w + GROUP_PAD * 2,
      h: BOXES.wad.y + ROW - BOXES.poi.y + STEP2_TOP_PAD + GROUP_PAD,
    },
  },
  {
    label: "Execution",
    step: 3,
    box: {
      x: S3_X,
      y: BOXES.projectPrep.y - GROUP_PAD,
      w: S3_W,
      h: BOXES.feasibility.y + ROW - BOXES.projectPrep.y + GROUP_PAD * 2,
    },
  },
  {
    label: "Finality",
    step: 4,
    box: {
      x: S3_X,
      y: BOXES.finality.y - GROUP_PAD,
      w: S3_W,
      h: BOXES.completion.y + ROW - BOXES.finality.y + GROUP_PAD * 2,
    },
  },
  {
    label: "Memory",
    step: 5,
    box: {
      x: S3_X,
      y: BOXES.memory.y - GROUP_PAD,
      w: S3_W,
      h: BOXES.memory.h + GROUP_PAD * 2,
    },
  },
];


function GroupFrame({
  label,
  step,
  box,
  emphasis,
  active,
}: {
  label: string;
  step: number;
  box: Box;
  /** A bolder, brighter border — used for Step 1, which otherwise reads too faint against the
   * busier top row of the diagram. */
  emphasis?: boolean;
  /** Whichever step the deal is actually in right now gets a soft green wash behind its frame —
   * shifts from step to step as the deal moves on, so it's always obvious where things stand. */
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-xl border transition-colors duration-500",
        // Same alpha as before (not bolder) — just a paler, whiter tint of the same hue.
        emphasis ? "border-[oklch(0.95_0.03_178)]/55" : "border-[oklch(0.95_0.03_178)]/40",
        active && "bg-gradient-to-br from-primary/14 via-primary/5 to-transparent",
      )}
      style={{ left: pctX(box.x), top: pctY(box.y), width: pctX(box.w), height: pctY(box.h) }}
    >
      <span className="absolute -top-3 left-2.5 rounded-full border border-primary/50 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
        Step {step} · {label}
      </span>
    </div>
  );
}

function ArrowLayer() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <marker id="mj-arrowhead" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" className="fill-muted-foreground/50" />
        </marker>
      </defs>
      {ARROWS.map((a, i) => (
        <path
          key={i}
          d={a.d}
          fill="none"
          className="stroke-muted-foreground/40"
          strokeWidth={1.5}
          markerEnd={a.arrow === false ? undefined : "url(#mj-arrowhead)"}
        />
      ))}
    </svg>
  );
}

/** One workflow-diagram button, absolutely positioned on the shared coordinate system. Reuses
 * the same tick/lock coloring language as the Classic view's nodes. */
function MjNode({
  box,
  label,
  labelClassName,
  sub,
  subClassName,
  icon: Icon,
  state,
  onClick,
  tone = "neutral",
  frameClassName,
}: {
  box: Box;
  label: string;
  /** Overrides the label's default color — used to pick Choice out in sky blue while keeping the
   * same frame styling as its neighbors. */
  labelClassName?: string;
  /** A small second line inside the node, under the label — used for WaD's "hard gate" note. */
  sub?: string;
  /** Overrides the sub line's default color — used for WaD's terracotta "non-waivable" note. */
  subClassName?: string;
  icon?: typeof Search;
  state: NodeState;
  onClick?: () => void;
  tone?: "neutral" | "danger" | "header" | "light";
  /** Overrides the whole frame's border/fill/text, whatever the state — used to pick a single
   * node out permanently (e.g. Search AI + AI+'s terracotta fill), not just while it's active. */
  frameClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ left: pctX(box.x), top: pctY(box.y), width: pctX(box.w), height: pctY(box.h) }}
      className={cn(
        "absolute flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 text-center text-[11px] font-semibold leading-tight tracking-tight transition-colors sm:text-xs",
        // Register Bid/Offer pulse as an open invitation to click the moment nothing has started
        // yet — same idea as the active-step pulse elsewhere, just for the two starting moves.
        tone === "header" && state === "open" && "bg-black text-[#00e5ff] border-[#00e5ff] hover:border-[#00e5ff] animate-throb-aqua",
        tone === "header" && state !== "done" && state !== "open" && "bg-slate-700/40 text-foreground border-border hover:border-primary/40",
        tone === "header" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "neutral" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "neutral" && state === "active" && "border-[#00e5ff] bg-[#00e5ff]/15 text-[#00e5ff] animate-throb-aqua",
        tone === "neutral" && state === "open" && "border-white bg-black text-white hover:border-white",
        tone === "neutral" &&
          state === "locked" &&
          "cursor-not-allowed border-white/40 bg-black text-white/50",
        tone === "danger" && state !== "done" && "border-[#F59E0B]/60 bg-[#F59E0B]/10 text-[#F59E0B]",
        tone === "danger" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "light" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "light" && state === "active" && "border-[#00e5ff] bg-[#00e5ff]/15 text-[#00e5ff] animate-throb-aqua",
        tone === "light" &&
          (state === "open" || state === "locked") &&
          cn(
            "border-white bg-black text-white hover:border-white",
            state === "locked" && "cursor-not-allowed text-white/50",
          ),
        frameClassName,
      )}
    >
      <span className="flex items-center gap-1.5">
        {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", labelClassName)} />}
        <span className={cn("truncate", labelClassName)}>{label}</span>
      </span>
      {sub && (
        <span
          className={cn(
            "truncate text-[9px] font-semibold uppercase tracking-wide",
            subClassName ?? (tone === "danger" ? "text-[#F59E0B]" : "text-current opacity-95"),
          )}
        >
          {sub}
        </span>
      )}
    </button>
  );
}

/** The Mahjong view: the whole deal pipeline laid out as the product's workflow diagram — boxes
 * and arrows in the same relative positions as the source flowchart — instead of the Classic
 * view's vertical gate list. Each node opens the same step form as its Classic-view counterpart. */
export function MahjongView({
  tx,
  reload,
  readOnly,
  onRegister,
  onOpenClassic,
}: {
  tx: Transaction;
  reload: () => void;
  readOnly?: boolean;
  /** Fires when "Register Bid"/"Register Offer" is clicked, before any real deal exists — the
   * caller switches to the form that actually records it (same one the Classic view uses). */
  onRegister?: (direction: "bid" | "offer") => void;
  /** When given, clicking a node hands over to the Classic view's detailed sequence instead of
   * opening the step inline on the map. */
  onOpenClassic?: (stage: StageKey, step: string) => void;
}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string } | null>(null);

  const open = (stage: StageKey, step: string) => {
    if (readOnly) return;
    if (onOpenClassic) {
      onOpenClassic(stage, step);
      return;
    }
    setPanel((p) => (p?.stage === stage && p?.step === step ? null : { stage, step }));
  };

  const st = (stage: StageKey, step: string) => nodeState(stage, step, tx);
  const active = panel && !readOnly ? panel : null;
  const activeStep = currentStepNumber(tx);

  return (
    <div className="ink-grid relative rounded-3xl border border-border p-3 sm:p-4">

      <div
        className="relative mx-auto"
        style={{
          aspectRatio: `${W} / ${H}`,
          // Keeps the whole diagram inside the viewport, so it never needs scrolling.
          width: `min(100%, calc((100vh - 230px) * ${W} / ${H}))`,
        }}
      >

        <ArrowLayer />
        {GROUPS.map((g) => (
          <GroupFrame key={g.label} {...g} active={g.step === activeStep} />
        ))}

        <MjNode
          box={BOXES.bid}
          label="Submit a Bid"
          tone="header"
          state={readOnly ? "open" : st("trading", "bid-offer")}
          // Always starts a fresh bid, even when a deal is already loaded on this canvas — it's a
          // new registration, not a way back into whatever's currently open.
          onClick={() => onRegister?.("bid")}
        />
        <MjNode
          box={BOXES.offer}
          label="Submit a Response"
          tone="header"
          state={readOnly ? "open" : st("trading", "bid-offer")}
          onClick={() => onRegister?.("offer")}
        />

        <MjNode
          box={BOXES.search}
          label="Search AI + AI+"
          icon={Search}
          tone="light"
          frameClassName="border-white bg-[#C1653D] text-white hover:border-white"
          state={st("trading", "search")}
          onClick={() => open("trading", "search")}
        />
        <MjNode
          box={BOXES.surfaceRoutes}
          label="Online Media Screening"
          icon={Globe}
          tone="light"
          state={st("trading", "online-media")}
          onClick={() => open("trading", "online-media")}
        />

        <MjNode
          box={BOXES.choice}
          label="Choice"
          labelClassName="text-white"
          icon={ListChecks}
          tone="light"
          frameClassName="border-info bg-info text-white hover:border-info"
          state={st("trading", "choice")}
          onClick={() => open("trading", "choice")}
        />
        <MjNode
          box={BOXES.poi}
          label="Proof of Intent"
          labelClassName="text-primary"
          icon={FileText}
          tone="light"
          frameClassName="border-primary bg-primary/15 text-primary hover:border-primary"
          state={st("trading", "poi")}
          onClick={() => open("trading", "poi")}
        />
        <MjNode
          box={BOXES.wad}
          label="Without a Doubt"
          labelClassName="text-primary"
          sub="Hard gate · non-waivable"
          subClassName="text-[#C1653D]"
          icon={ShieldCheck}
          tone="light"
          frameClassName="border-primary bg-primary/15 text-primary hover:border-primary"
          state={st("compliance", "wad")}
          onClick={() => open("compliance", "wad")}
        />
        <MjNode
          box={BOXES.projectPrep}
          tone="light"
          label="Project Preparation"
          icon={Briefcase}
          state={st("execution", "preparation")}
          onClick={() => open("execution", "preparation")}
        />
        <MjNode
          box={BOXES.execution}
          tone="light"
          label="Execution"
          icon={Hammer}
          state={st("execution", "entry")}
          onClick={() => open("execution", "entry")}
        />
        <MjNode
          box={BOXES.finality}
          tone="light"
          label="Finality"
          icon={CheckCircle2}
          state={st("finality", "entry")}
          onClick={() => open("finality", "entry")}
        />

        <MjNode
          box={BOXES.concept}
          tone="light"
          label="Concept"
          state={st("execution", "preparation")}
          onClick={() => open("execution", "preparation")}
        />
        <MjNode
          box={BOXES.prefeasibility}
          tone="light"
          label="Pre-feasibility"
          state={st("execution", "preparation")}
          onClick={() => open("execution", "preparation")}
        />
        <MjNode
          box={BOXES.feasibility}
          tone="light"
          label="Feasibility"
          state={st("execution", "preparation")}
          onClick={() => open("execution", "preparation")}
        />
        <MjNode
          box={BOXES.bankability}
          tone="light"
          label="Bankability"
          state={st("execution", "bankability")}
          onClick={() => open("execution", "bankability")}
        />
        <MjNode
          box={BOXES.implementation}
          tone="light"
          label="Implementation"
          state={st("execution", "implementation")}
          onClick={() => open("execution", "implementation")}
        />
        <MjNode
          box={BOXES.payment}
          tone="light"
          label="Payment"
          icon={Banknote}
          state={st("finality", "type")}
          onClick={() => open("finality", "type")}
        />
        <MjNode
          box={BOXES.completion}
          tone="light"
          label="Completion"
          state={st("finality", "record")}
          onClick={() => open("finality", "record")}
        />
        <MjNode
          box={BOXES.memory}
          tone="light"
          label="Memory"
          icon={Database}
          state={st("memory", "ledger")}
          onClick={() => open("memory", "ledger")}
        />
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
