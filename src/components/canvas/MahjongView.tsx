import { useState } from "react";
import {
  Banknote,
  Briefcase,
  CheckCircle2,
  Database,
  FileText,
  Hammer,
  ListChecks,
  Search,
  ShieldCheck,
  Users,
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

// Diagram coordinate system — everything below is placed on this fixed canvas and scaled to the
// container with percentages, so boxes and their connecting arrows always stay aligned with each
// other regardless of viewport width. Every step in the main flow (Search through KYC/KYB, plus
// the branch headers and their sub-steps) shares one height and an equal vertical pitch between
// rows; the center column shares Choice's width too.
const W = 1246;
const H = 960;
const pctX = (v: number) => `${(v / W) * 100}%`;
const pctY = (v: number) => `${(v / H) * 100}%`;

const ROW = 46; // shared node height
const PITCH = 82; // vertical distance from one row's top to the next
const CENTER_W = 310; // shared width for the center-column nodes, matched to Choice
const SIDE_W = 220;
// Extra breathing room before the three parallel branches split off from KYC/KYB, so the branch
// frames sit clearly lower and don't crowd the gate row above them.
const BRANCH_Y = 110 + PITCH * 5 + 100;

type Box = { x: number; y: number; w: number; h: number };
const BOXES = {
  bid: { x: 60, y: 20, w: SIDE_W, h: ROW },
  offer: { x: 860, y: 20, w: SIDE_W, h: ROW },

  loadDocs: { x: 60, y: 110, w: SIDE_W, h: ROW },
  search: { x: 470, y: 110, w: CENTER_W, h: ROW },
  counterparty: { x: 860, y: 110, w: SIDE_W, h: ROW },

  surfaceRoutes: { x: 860, y: 110 + PITCH, w: SIDE_W, h: ROW },
  choice: { x: 470, y: 110 + PITCH, w: CENTER_W, h: ROW },

  poi: { x: 470, y: 110 + PITCH * 2, w: CENTER_W, h: ROW },
  wad: { x: 470, y: 110 + PITCH * 3, w: CENTER_W, h: ROW },
  kyc: { x: 470, y: 110 + PITCH * 4, w: CENTER_W, h: ROW },

  projectPrep: { x: 50, y: BRANCH_Y, w: 330, h: ROW },
  execution: { x: 525, y: BRANCH_Y, w: 200, h: ROW },
  finality: { x: 800, y: BRANCH_Y, w: 200, h: ROW },

  concept: { x: 5, y: BRANCH_Y + PITCH, w: 150, h: ROW },
  prefeasibility: { x: 165, y: BRANCH_Y + PITCH, w: 150, h: ROW },
  implementation: { x: 525, y: BRANCH_Y + PITCH, w: 200, h: ROW },
  payment: { x: 800, y: BRANCH_Y + PITCH, w: 200, h: ROW },

  feasibility: { x: 5, y: BRANCH_Y + PITCH * 2, w: 150, h: ROW },
  bankability: { x: 165, y: BRANCH_Y + PITCH * 2, w: 150, h: ROW },
  completion: { x: 800, y: BRANCH_Y + PITCH * 2, w: 200, h: ROW },

  memory: { x: 1050, y: BRANCH_Y + PITCH, w: 180, h: PITCH + ROW },
} as const satisfies Record<string, Box>;

// Every connector point sits a few units clear of its box's actual border, so lines stop short
// of the edge instead of visually running into (or under) the node.
const EDGE_GAP = 5;
const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;
const top = (b: Box) => ({ x: cx(b), y: b.y - EDGE_GAP });
const bottom = (b: Box) => ({ x: cx(b), y: b.y + b.h + EDGE_GAP });
const left = (b: Box) => ({ x: b.x - EDGE_GAP, y: cy(b) });
const right = (b: Box) => ({ x: b.x + b.w + EDGE_GAP, y: cy(b) });

type Point = { x: number; y: number };
/** An elbow connector: straight from `a`, turning once, ending at `b`. `via: "x"` turns
 * horizontally first then vertically (so the final leg is vertical — use this when `b` is a
 * box's top/bottom); `"y"` turns vertically first then horizontally (final leg horizontal — use
 * when `b` is a box's left/right). */
function elbow(a: Point, b: Point, via: "x" | "y" = "y"): string {
  const mid: Point = via === "y" ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
  return `M ${a.x} ${a.y} L ${mid.x} ${mid.y} L ${b.x} ${b.y}`;
}

/** A tree connector: a short vertical stub clears `a`'s box before the line fans out — so
 * multiple branches leaving the same point (e.g. three arrows off KYC/KYB's bottom edge) don't
 * bunch up and cross right at the box border — then drops straight down into each target's top. */
function branchDown(a: Point, targets: Point[], stub = 9): string[] {
  const trunkY = a.y + stub;
  return targets.map((t) => `M ${a.x} ${a.y} L ${a.x} ${trunkY} L ${t.x} ${trunkY} L ${t.x} ${t.y}`);
}

// Frame padding, defined here (ahead of GROUPS below) so the KYC → Step 3/4 branch arrows can
// stop right at each frame's outer border instead of continuing past it into the frame's
// interior to touch the node itself.
const GROUP_PAD = 16;
const GROUP_PAD_TIGHT = 6;
const STEP3_INSET = 14;
const STEP3_FRAME_TOP = BOXES.projectPrep.y - GROUP_PAD;
const STEP4_FRAME_TOP = BOXES.finality.y - GROUP_PAD;

const ARROWS: { d: string; arrow?: boolean }[] = [
  { d: elbow(bottom(BOXES.bid), top(BOXES.loadDocs)) },
  { d: elbow(bottom(BOXES.offer), top(BOXES.counterparty)) },
  { d: elbow(right(BOXES.loadDocs), left(BOXES.search)) },
  { d: elbow(left(BOXES.counterparty), right(BOXES.search)) },
  { d: elbow(top(BOXES.surfaceRoutes), bottom(BOXES.counterparty)), arrow: false },
  { d: elbow(bottom(BOXES.search), top(BOXES.choice)) },
  { d: elbow(bottom(BOXES.loadDocs), left(BOXES.choice), "y") },
  { d: elbow(bottom(BOXES.surfaceRoutes), right(BOXES.choice), "y") },
  { d: elbow(bottom(BOXES.choice), top(BOXES.poi)) },
  { d: elbow(bottom(BOXES.poi), top(BOXES.wad)) },
  { d: elbow(bottom(BOXES.wad), top(BOXES.kyc)) },
  ...branchDown(bottom(BOXES.kyc), [
    { x: cx(BOXES.projectPrep), y: STEP3_FRAME_TOP },
    { x: cx(BOXES.execution), y: STEP3_FRAME_TOP },
    { x: cx(BOXES.finality), y: STEP4_FRAME_TOP },
  ]).map((d) => ({ d })),
  { d: elbow(bottom(BOXES.execution), top(BOXES.implementation)) },
  { d: elbow(bottom(BOXES.finality), top(BOXES.payment)) },
  { d: elbow(bottom(BOXES.payment), top(BOXES.completion)) },
  { d: elbow(right(BOXES.completion), left(BOXES.memory), "x") },
  ...branchDown(bottom(BOXES.projectPrep), [top(BOXES.concept), top(BOXES.prefeasibility)]).map((d) => ({ d })),
  { d: elbow(bottom(BOXES.concept), top(BOXES.feasibility)) },
  { d: elbow(bottom(BOXES.prefeasibility), top(BOXES.bankability)) },
];

// Frames the diagram into the same 5 stages as the Journey banner above it — Step 1 (Trading,
// everything through Choice), Step 2 (Compliance & Governance: POI, WaD, KYC/KYB), Step 3
// (Execution, spanning Project Preparation through Implementation), Step 4 (Finality) and Step 5
// (Memory).
const GROUPS: { label: string; step: number; box: Box }[] = [
  {
    label: "Trading",
    step: 1,
    box: {
      x: BOXES.bid.x - GROUP_PAD,
      y: BOXES.bid.y - GROUP_PAD,
      w: BOXES.offer.x + BOXES.offer.w - BOXES.bid.x + GROUP_PAD * 2,
      h: BOXES.choice.y + ROW - BOXES.bid.y + GROUP_PAD + GROUP_PAD_TIGHT,
    },
  },
  {
    label: "Compliance & Governance",
    step: 2,
    box: {
      x: BOXES.poi.x - GROUP_PAD,
      y: BOXES.poi.y - GROUP_PAD_TIGHT,
      w: BOXES.poi.w + GROUP_PAD * 2,
      h: BOXES.kyc.y + ROW - BOXES.poi.y + GROUP_PAD_TIGHT + GROUP_PAD,
    },
  },
  {
    label: "Execution",
    step: 3,
    box: {
      x: -GROUP_PAD + STEP3_INSET,
      y: BOXES.projectPrep.y - GROUP_PAD,
      w: 730 + GROUP_PAD * 2 - STEP3_INSET * 2,
      h: BOXES.feasibility.y + ROW - BOXES.projectPrep.y + GROUP_PAD * 2,
    },
  },
  {
    label: "Finality",
    step: 4,
    box: {
      x: 792 - GROUP_PAD,
      y: BOXES.finality.y - GROUP_PAD,
      w: 216 + GROUP_PAD + GROUP_PAD_TIGHT,
      h: BOXES.completion.y + ROW - BOXES.finality.y + GROUP_PAD * 2,
    },
  },
  {
    label: "Memory",
    step: 5,
    box: {
      x: 1042 - GROUP_PAD_TIGHT,
      y: BOXES.memory.y - GROUP_PAD,
      w: 196 + GROUP_PAD_TIGHT + GROUP_PAD,
      h: BOXES.memory.h + GROUP_PAD * 2,
    },
  },
];

function GroupFrame({ label, step, box }: { label: string; step: number; box: Box }) {
  return (
    <div
      className="pointer-events-none absolute rounded-xl border-2 border-primary/40"
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
        <marker id="mj-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
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
  sub,
  icon: Icon,
  state,
  onClick,
  tone = "neutral",
}: {
  box: Box;
  label: string;
  /** A small second line inside the node, under the label — used for WaD's "hard gate" note. */
  sub?: string;
  icon?: typeof Search;
  state: NodeState;
  onClick?: () => void;
  tone?: "neutral" | "danger" | "header" | "light";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ left: pctX(box.x), top: pctY(box.y), width: pctX(box.w), height: pctY(box.h) }}
      className={cn(
        "absolute flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 text-center text-[11px] font-semibold leading-tight tracking-tight transition-colors sm:text-xs",
        tone === "header" && "bg-slate-700/40 text-foreground border-border",
        tone === "neutral" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "neutral" && state === "active" && "border-primary bg-primary/20 text-primary animate-signal-pulse",
        tone === "neutral" && state === "open" && "border-border bg-muted/30 text-foreground hover:border-primary/40",
        tone === "neutral" &&
          state === "locked" &&
          "cursor-not-allowed border-border/60 bg-muted/10 text-muted-foreground/60",
        tone === "danger" && state !== "done" && "border-[#F97316]/60 bg-[#F97316]/10 text-[#F97316]",
        tone === "danger" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "light" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "light" && state === "active" && "border-primary bg-primary/20 text-primary animate-signal-pulse",
        tone === "light" &&
          (state === "open" || state === "locked") &&
          cn(
            "border-white/80 bg-muted/20 text-foreground hover:border-white",
            state === "locked" && "cursor-not-allowed text-muted-foreground/70",
          ),
      )}
    >
      <span className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </span>
      {sub && (
        <span
          className={cn(
            "truncate text-[9px] font-semibold uppercase tracking-wide",
            tone === "danger" ? "text-[#F97316]" : "text-current opacity-80",
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
}: {
  tx: Transaction;
  reload: () => void;
  readOnly?: boolean;
}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string } | null>(null);

  const open = (stage: StageKey, step: string) => {
    if (readOnly) return;
    setPanel((p) => (p?.stage === stage && p?.step === step ? null : { stage, step }));
  };

  const st = (stage: StageKey, step: string) => nodeState(stage, step, tx);
  const active = panel && !readOnly ? panel : null;

  return (
    <div className="ink-grid relative rounded-3xl border border-border p-4 sm:p-6">

      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <ArrowLayer />
        {GROUPS.map((g) => (
          <GroupFrame key={g.label} {...g} />
        ))}

        <MjNode box={BOXES.bid} label="Register Bid" tone="header" state="open" />
        <MjNode box={BOXES.offer} label="Register Offer" tone="header" state="open" />

        <MjNode
          box={BOXES.loadDocs}
          label="Load deal docs"
          icon={FileText}
          state={st("trading", "documents")}
          onClick={() => open("trading", "documents")}
        />
        <MjNode
          box={BOXES.search}
          label="Search · AI + AI+"
          icon={Search}
          state={st("trading", "search")}
          onClick={() => open("trading", "search")}
        />
        <MjNode
          box={BOXES.counterparty}
          label="Counterparty"
          icon={Users}
          state={st("trading", "counterparties")}
          onClick={() => open("trading", "counterparties")}
        />
        <MjNode
          box={BOXES.surfaceRoutes}
          label="Surface routes / paths"
          icon={Search}
          state={st("trading", "media")}
          onClick={() => open("trading", "media")}
        />

        <MjNode
          box={BOXES.choice}
          label="Choice"
          icon={ListChecks}
          state={st("trading", "choice")}
          onClick={() => open("trading", "choice")}
        />
        <MjNode
          box={BOXES.poi}
          label="Proof of Intent"
          icon={FileText}
          state={st("trading", "poi")}
          onClick={() => open("trading", "poi")}
        />
        <MjNode
          box={BOXES.wad}
          label="Without a Doubt"
          sub="Hard gate · non-waivable"
          icon={ShieldCheck}
          tone="danger"
          state={st("compliance", "wad")}
          onClick={() => open("compliance", "wad")}
        />
        <MjNode
          box={BOXES.kyc}
          label="KYC / KYB"
          icon={Users}
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
