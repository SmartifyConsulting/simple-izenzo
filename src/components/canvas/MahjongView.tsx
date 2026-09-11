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
// other regardless of viewport width.
const W = 1246;
const pctX = (v: number) => `${(v / W) * 100}%`;

const ROW = 46; // shared node height
const PITCH = 86; // vertical distance from one row's top to the next
const CENTER_W = 360; // shared width for the center-column nodes, matched to Choice
const TOP_Y = 24;

const GROUP_PAD = 20;
// Vertical gap between one step's frame and the next, whether expanded or collapsed.
const STEP_GAP = 52;
// Height of a collapsed step — just enough room for its label bar.
const COLLAPSED_H = 34;

const S3_W = 620;
const COL_GAP = (W - S3_W) / 2;
const S3_X = COL_GAP;

// Inner content bounds of the Execution frame.
const S3_L = S3_X + GROUP_PAD;
const S3_R = S3_X + S3_W - GROUP_PAD;

const PREP_W = 330;
const SUB_W = 165;
const EXEC_W = 210;
const FIN_W = S3_W - GROUP_PAD * 2;
const MEM_W = S3_W - GROUP_PAD * 2;

type Box = { x: number; y: number; w: number; h: number };
// Left edge shared by the Trading, Compliance & Governance and Execution frames, so Steps 1, 2
// and 3 all line up on the same left margin.
const STEP_X = S3_L;
// Create a Bid / Make an Offer sit side by side, sharing Search's width, one on each half.
const BID_OFFER_GAP = 14;
const BID_OFFER_W = (CENTER_W - BID_OFFER_GAP) / 2;

// Each step's content height when fully expanded (excludes GROUP_PAD framing).
const STEP1_H = PITCH * 3 + ROW; // bid+offer (shared row), search, surfaceRoutes, choice
const STEP2_H = PITCH + ROW; // poi, wad
const STEP3_H = PITCH * 2 + ROW; // projectPrep/execution, concept/prefeasibility/implementation, feasibility/bankability
const STEP4_H = PITCH * 2 + ROW; // finality, payment, completion
const STEP5_H = ROW; // memory

const STEP_FULL_H: Record<number, number> = { 1: STEP1_H, 2: STEP2_H, 3: STEP3_H, 4: STEP4_H, 5: STEP5_H };

type Collapsed = Record<number, boolean>;

/** Frame top (outer, including GROUP_PAD) for each step, given which steps are collapsed —
 * steps stack top to bottom, each one's height shrinking to COLLAPSED_H when collapsed, so
 * collapsing a step reclaims the space every step below it. */
function stepFrameTops(collapsed: Collapsed): Record<number, number> {
  const tops: Record<number, number> = {};
  let y = TOP_Y - GROUP_PAD;
  for (const step of [1, 2, 3, 4, 5]) {
    tops[step] = y;
    const contentH = collapsed[step] ? COLLAPSED_H - GROUP_PAD * 2 : STEP_FULL_H[step]!;
    y += contentH + GROUP_PAD * 2 + STEP_GAP;
  }
  return tops;
}

/** Builds every node box and frame box for the current collapse state. Boxes belonging to a
 * collapsed step are still returned (so arrows/lookups don't break) but are simply not rendered. */
function layout(collapsed: Collapsed) {
  const frameTop = stepFrameTops(collapsed);
  const y1 = frameTop[1]! + GROUP_PAD;
  const y2 = frameTop[2]! + GROUP_PAD;
  const y3 = frameTop[3]! + GROUP_PAD;
  const y4 = frameTop[4]! + GROUP_PAD;
  const y5 = frameTop[5]! + GROUP_PAD;

  const boxes = {
    bid: { x: STEP_X, y: y1, w: BID_OFFER_W, h: ROW },
    offer: { x: STEP_X + BID_OFFER_W + BID_OFFER_GAP, y: y1, w: BID_OFFER_W, h: ROW },
    search: { x: STEP_X, y: y1 + PITCH, w: CENTER_W, h: ROW },
    surfaceRoutes: { x: STEP_X, y: y1 + PITCH * 2, w: CENTER_W, h: ROW },
    choice: { x: STEP_X, y: y1 + PITCH * 3, w: CENTER_W, h: ROW },

    poi: { x: STEP_X, y: y2, w: CENTER_W, h: ROW },
    wad: { x: STEP_X, y: y2 + PITCH, w: CENTER_W, h: ROW },

    projectPrep: { x: S3_L, y: y3, w: PREP_W, h: ROW },
    execution: { x: S3_R - EXEC_W, y: y3, w: EXEC_W, h: ROW },
    concept: { x: S3_L, y: y3 + PITCH, w: SUB_W, h: ROW },
    prefeasibility: { x: S3_L + PREP_W - SUB_W, y: y3 + PITCH, w: SUB_W, h: ROW },
    implementation: { x: S3_R - EXEC_W, y: y3 + PITCH, w: EXEC_W, h: ROW },
    feasibility: { x: S3_L, y: y3 + PITCH * 2, w: SUB_W, h: ROW },
    bankability: { x: S3_L + PREP_W - SUB_W, y: y3 + PITCH * 2, w: SUB_W, h: ROW },

    finality: { x: S3_L, y: y4, w: FIN_W, h: ROW },
    payment: { x: S3_L, y: y4 + PITCH, w: FIN_W, h: ROW },
    completion: { x: S3_L, y: y4 + PITCH * 2, w: FIN_W, h: ROW },

    memory: { x: S3_L, y: y5, w: MEM_W, h: ROW },
  } as const satisfies Record<string, Box>;

  const groups: { label: string; step: number; box: Box; emphasis?: boolean }[] = [
    {
      label: "Trading",
      step: 1,
      emphasis: true,
      box: { x: S3_X, y: frameTop[1]!, w: S3_W, h: collapsed[1] ? COLLAPSED_H : STEP1_H + GROUP_PAD * 2 },
    },
    {
      label: "Compliance & Governance",
      step: 2,
      box: { x: S3_X, y: frameTop[2]!, w: S3_W, h: collapsed[2] ? COLLAPSED_H : STEP2_H + GROUP_PAD * 2 },
    },
    {
      label: "Execution",
      step: 3,
      box: { x: S3_X, y: frameTop[3]!, w: S3_W, h: collapsed[3] ? COLLAPSED_H : STEP3_H + GROUP_PAD * 2 },
    },
    {
      label: "Finality",
      step: 4,
      box: { x: S3_X, y: frameTop[4]!, w: S3_W, h: collapsed[4] ? COLLAPSED_H : STEP4_H + GROUP_PAD * 2 },
    },
    {
      label: "Memory",
      step: 5,
      box: { x: S3_X, y: frameTop[5]!, w: S3_W, h: collapsed[5] ? COLLAPSED_H : STEP5_H + GROUP_PAD * 2 },
    },
  ];

  const totalH = frameTop[5]! + (collapsed[5] ? COLLAPSED_H : STEP5_H + GROUP_PAD * 2) + 20;

  return { boxes, groups, totalH };
}

// Connector points sit exactly on each box's border, so a line leaves touching the box it comes
// from and its arrowhead tip lands on the border of the box it points at.
const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;
const top = (b: Box) => ({ x: cx(b), y: b.y });
const bottom = (b: Box) => ({ x: cx(b), y: b.y + b.h });
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

/** Every connector, keyed by the pair of steps it runs between — hidden if either endpoint's
 * step is currently collapsed, since the boxes at each end aren't shown. */
function buildArrows(boxes: ReturnType<typeof layout>["boxes"]): { d: string; steps: [number, number] }[] {
  return [
    { d: elbow(bottom(boxes.bid), topAt(boxes.search, 0.28), "x"), steps: [1, 1] },
    { d: elbow(bottom(boxes.offer), topAt(boxes.search, 0.72), "x"), steps: [1, 1] },
    { d: elbow(bottom(boxes.search), top(boxes.surfaceRoutes), "x"), steps: [1, 1] },
    { d: elbow(bottom(boxes.surfaceRoutes), top(boxes.choice), "x"), steps: [1, 1] },
    { d: elbow(bottom(boxes.choice), top(boxes.poi), "x"), steps: [1, 2] },
    { d: elbow(bottom(boxes.poi), top(boxes.wad), "x"), steps: [2, 2] },
    ...branchDown(bottom(boxes.wad), [top(boxes.projectPrep), top(boxes.execution)], 44).map(
      (d): { d: string; steps: [number, number] } => ({ d, steps: [2, 3] }),
    ),
    { d: elbow(bottom(boxes.execution), top(boxes.implementation), "x"), steps: [3, 3] },
    { d: elbow(bottom(boxes.execution), top(boxes.finality), "x"), steps: [3, 4] },
    { d: elbow(bottom(boxes.finality), top(boxes.payment), "x"), steps: [4, 4] },
    { d: elbow(bottom(boxes.payment), top(boxes.completion), "x"), steps: [4, 4] },
    { d: elbow(bottom(boxes.completion), top(boxes.memory), "x"), steps: [4, 5] },
    ...branchDown(bottom(boxes.projectPrep), [top(boxes.concept), top(boxes.prefeasibility)], 14).map(
      (d): { d: string; steps: [number, number] } => ({ d, steps: [3, 3] }),
    ),
    { d: elbow(bottom(boxes.concept), top(boxes.feasibility), "x"), steps: [3, 3] },
    { d: elbow(bottom(boxes.prefeasibility), top(boxes.bankability), "x"), steps: [3, 3] },
  ];
}

function GroupFrame({
  label,
  step,
  box,
  active,
  collapsed,
  onToggle,
  h,
}: {
  label: string;
  step: number;
  box: Box;
  /** Whichever step the deal is actually in right now gets a soft green wash behind its frame —
   * shifts from step to step as the deal moves on, so it's always obvious where things stand. */
  active?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  h: (v: number) => string;
}) {
  return (
    <>
      <div
        className="pointer-events-none absolute rounded-xl"
        style={{ left: pctX(box.x), top: h(box.y), width: pctX(box.w), height: h(box.h) }}
      />
      {/* Positioned in the canvas's own left margin (before STEP_X) rather than overflowing the
       * frame box, so it's never clipped by the diagram's own bounding box. */}
      <button
        type="button"
        onClick={onToggle}
        style={{ left: pctX(0), top: h(box.y + 24), width: pctX(STEP_X - 16) }}
        className="pointer-events-auto absolute -translate-y-1/2 text-right text-[10px] font-semibold uppercase leading-tight tracking-wide text-white transition-colors hover:text-primary"
        aria-expanded={!collapsed}
      >
        {collapsed ? "+ " : "− "}Step {step} · {label}
      </button>
    </>
  );
}

function ArrowLayer({
  arrows,
  collapsed,
  w,
  h,
}: {
  arrows: { d: string; steps: [number, number] }[];
  collapsed: Collapsed;
  totalW: number;
  totalH: number;
  w: number;
  h: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <marker id="mj-arrowhead" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" className="fill-muted-foreground/50" />
        </marker>
      </defs>
      {arrows
        .filter((a) => !collapsed[a.steps[0]] && !collapsed[a.steps[1]])
        .map((a, i) => (
          <path
            key={i}
            d={a.d}
            fill="none"
            className="stroke-muted-foreground/40"
            strokeWidth={1.5}
            markerEnd="url(#mj-arrowhead)"
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
  pctY,
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
  pctY: (v: number) => string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ left: pctX(box.x), top: pctY(box.y), width: pctX(box.w), height: pctY(box.h) }}
      className={cn(
        "absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border px-2 text-center text-[12px] font-semibold leading-tight tracking-tight transition-colors sm:text-sm",
        // Register Bid/Offer pulse as an open invitation to click the moment nothing has started
        // yet — same idea as the active-step pulse elsewhere, just for the two starting moves.
        tone === "header" && state === "open" && "bg-black text-[#00e5ff] border-[#00e5ff] hover:border-[#00e5ff] animate-throb-aqua",
        tone === "header" && state !== "done" && state !== "open" && "bg-slate-700/40 text-foreground border-border hover:border-primary/40",
        tone === "header" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "neutral" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "neutral" && state === "active" && "border-[#00e5ff] bg-[#00e5ff]/15 text-[#00e5ff] animate-throb-aqua",
        tone === "neutral" && state === "open" && "border-white/50 bg-black font-normal text-white hover:border-white/70",
        tone === "neutral" &&
          state === "locked" &&
          "cursor-not-allowed border-white/40 bg-black font-normal text-white/50",
        tone === "danger" && state !== "done" && "border-[#F59E0B]/60 bg-[#F59E0B]/10 text-[#F59E0B]",
        tone === "danger" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "light" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
        tone === "light" && state === "active" && "border-[#00e5ff] bg-[#00e5ff]/15 text-[#00e5ff] animate-throb-aqua",
        tone === "light" &&
          (state === "open" || state === "locked") &&
          cn(
            "border-white/50 bg-black font-normal text-white hover:border-white/70",
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
 * view's vertical gate list. Each node opens the same step form as its Classic-view counterpart.
 * Each of the 5 numbered steps collapses independently, like an accordion. */
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
  const [collapsed, setCollapsed] = useState<Collapsed>({});

  const open = (stage: StageKey, step: string) => {
    if (readOnly) return;
    if (onOpenClassic) {
      onOpenClassic(stage, step);
      return;
    }
    setPanel((p) => (p?.stage === stage && p?.step === step ? null : { stage, step }));
  };

  const toggleStep = (step: number) => setCollapsed((c) => ({ ...c, [step]: !c[step] }));

  const st = (stage: StageKey, step: string) => nodeState(stage, step, tx);
  const active = panel && !readOnly ? panel : null;
  const activeStep = currentStepNumber(tx);

  const { boxes: BOXES, groups: GROUPS, totalH: H } = layout(collapsed);
  const ARROWS = buildArrows(BOXES);
  const pctYFn = (v: number) => `${(v / H) * 100}%`;

  return (
    <div className="relative h-full">
      <div className="flex h-full items-start justify-center overflow-hidden">
        <div
          className="relative"
          style={{ height: "100%", aspectRatio: `${W} / ${H}`, maxWidth: "100%" }}
        >

        <ArrowLayer arrows={ARROWS} collapsed={collapsed} totalW={W} totalH={H} w={W} h={H} />
        {GROUPS.map((g) => (
          <GroupFrame
            key={g.label}
            {...g}
            active={g.step === activeStep}
            collapsed={Boolean(collapsed[g.step])}
            onToggle={() => toggleStep(g.step)}
            h={pctYFn}
          />
        ))}

        {!collapsed[1] && (
          <>
            <MjNode
              box={BOXES.bid}
              label="Create a Bid"
              tone="header"
              state={readOnly ? "open" : st("trading", "bid-offer")}
              // Always starts a fresh bid, even when a deal is already loaded on this canvas —
              // it's a new registration, not a way back into whatever's currently open.
              onClick={() => onRegister?.("bid")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.offer}
              label="Make an Offer"
              tone="header"
              state={readOnly ? "open" : st("trading", "bid-offer")}
              onClick={() => onRegister?.("offer")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.search}
              label="Search AI + AI+"
              icon={Search}
              tone="light"
              frameClassName="border-white/50 bg-[#C1653D] text-white hover:border-white/70"
              state={st("trading", "search")}
              onClick={() => open("trading", "search")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.surfaceRoutes}
              label="Online Media Screening"
              icon={Globe}
              tone="light"
              state={st("trading", "online-media")}
              onClick={() => open("trading", "online-media")}
              pctY={pctYFn}
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
              pctY={pctYFn}
            />
          </>
        )}

        {!collapsed[2] && (
          <>
            <MjNode
              box={BOXES.poi}
              label="Proof of Intent"
              labelClassName="text-primary"
              icon={FileText}
              tone="light"
              frameClassName="border-primary bg-primary/15 text-primary hover:border-primary"
              state={st("trading", "poi")}
              onClick={() => open("trading", "poi")}
              pctY={pctYFn}
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
              pctY={pctYFn}
            />
          </>
        )}

        {!collapsed[3] && (
          <>
            <MjNode
              box={BOXES.projectPrep}
              tone="light"
              label="Project Preparation"
              icon={Briefcase}
              state={st("execution", "preparation")}
              onClick={() => open("execution", "preparation")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.execution}
              tone="light"
              label="Execution"
              icon={Hammer}
              state={st("execution", "entry")}
              onClick={() => open("execution", "entry")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.concept}
              tone="light"
              label="Concept"
              state={st("execution", "preparation")}
              onClick={() => open("execution", "preparation")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.prefeasibility}
              tone="light"
              label="Pre-feasibility"
              state={st("execution", "preparation")}
              onClick={() => open("execution", "preparation")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.feasibility}
              tone="light"
              label="Feasibility"
              state={st("execution", "preparation")}
              onClick={() => open("execution", "preparation")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.bankability}
              tone="light"
              label="Bankability"
              state={st("execution", "bankability")}
              onClick={() => open("execution", "bankability")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.implementation}
              tone="light"
              label="Implementation"
              state={st("execution", "implementation")}
              onClick={() => open("execution", "implementation")}
              pctY={pctYFn}
            />
          </>
        )}

        {!collapsed[4] && (
          <>
            <MjNode
              box={BOXES.finality}
              tone="light"
              label="Finality"
              icon={CheckCircle2}
              state={st("finality", "entry")}
              onClick={() => open("finality", "entry")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.payment}
              tone="light"
              label="Payment"
              icon={Banknote}
              state={st("finality", "type")}
              onClick={() => open("finality", "type")}
              pctY={pctYFn}
            />
            <MjNode
              box={BOXES.completion}
              tone="light"
              label="Completion"
              state={st("finality", "record")}
              onClick={() => open("finality", "record")}
              pctY={pctYFn}
            />
          </>
        )}

        {!collapsed[5] && (
          <MjNode
            box={BOXES.memory}
            tone="light"
            label="Memory"
            icon={Database}
            state={st("memory", "ledger")}
            onClick={() => open("memory", "ledger")}
            pctY={pctYFn}
          />
        )}
        </div>
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
