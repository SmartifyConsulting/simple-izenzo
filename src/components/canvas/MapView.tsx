import { useState } from "react";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Database,
  FileText,
  FolderClosed,
  Gavel,
  LogIn,
  RefreshCw,
  Search,
  ShieldCheck,
  Share2,
  Tag,
  Users,
} from "lucide-react";
import { InlineFrame } from "./DealCanvas";
import { lockReason, stepIndex, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/tx";

type NodeState = "locked" | "open" | "active" | "done";

/** Node state comes straight from the live deal record and the shared gating rules — the same
 * `lockReason`/`stepIndex` logic the step list uses, unchanged. With no deal open yet, only Bid
 * is available and it pulses as the thing to do first. */
function nodeState(stage: StageKey, step: string, tx: Transaction | null): NodeState {
  if (!tx) return step === "bid-offer" ? "active" : "locked";
  if (lockReason(stage, step, tx)) return "locked";
  const idx = stepIndex(stage, step);
  const currentIdx = stepIndex(tx.stage, tx.step);
  if (idx < currentIdx) return "done";
  if (idx === currentIdx) return "active";
  return "open";
}

// Fixed diagram coordinate system, matching the source map's proportions. Everything is placed
// on this canvas and scaled to the container with percentages, so boxes and their connecting
// arrows always stay aligned however wide the screen is.
const W = 1600;
const H = 1060;
const px = (v: number) => `${(v / W) * 100}%`;
const py = (v: number) => `${(v / H) * 100}%`;

type Box = { x: number; y: number; w: number; h: number };

const BOXES = {
  bid: { x: 35, y: 68, w: 212, h: 78 },
  loadDocs: { x: 35, y: 206, w: 212, h: 86 },
  search: { x: 335, y: 218, w: 286, h: 68 },
  steps: { x: 670, y: 196, w: 150, h: 148 },
  offer: { x: 1018, y: 124, w: 206, h: 72 },
  choice: { x: 1018, y: 240, w: 206, h: 70 },
  counterOffer: { x: 1268, y: 226, w: 178, h: 74 },
  socialMedia: { x: 1018, y: 360, w: 256, h: 70 },
  expressIntent: { x: 335, y: 432, w: 280, h: 62 },
  poi: { x: 335, y: 524, w: 280, h: 62 },
  withoutADoubt: { x: 335, y: 622, w: 280, h: 62 },
  wad: { x: 335, y: 714, w: 280, h: 62 },
  businessDocs: { x: 335, y: 810, w: 280, h: 62 },
  execution: { x: 775, y: 892, w: 308, h: 142 },
  entryExit: { x: 1128, y: 906, w: 182, h: 68 },
  finality: { x: 1350, y: 902, w: 196, h: 78 },
} as const satisfies Record<string, Box>;

// Group frames. Bid, Load Deal Documents, Search and the Step 1–5 card all live inside one
// outer frame — the trade engine — rather than the search box carrying a small frame of its own.
const TRADE_ENGINE_FRAME: Box = { x: 14, y: 26, w: 838, h: 322 };
const COUNTERPARTY_FRAME: Box = { x: 990, y: 88, w: 478, h: 370 };
const COMPLIANCE_FRAME: Box = { x: 313, y: 352, w: 330, h: 542 };
const MEMORY = { cx: 1196, cy: 655, r: 150 };

const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;
const topOf = (b: Box) => ({ x: cx(b), y: b.y });
const bottomOf = (b: Box) => ({ x: cx(b), y: b.y + b.h });
const leftOf = (b: Box) => ({ x: b.x, y: cy(b) });
const rightOf = (b: Box) => ({ x: b.x + b.w, y: cy(b) });

type Point = { x: number; y: number };
const line = (a: Point, b: Point) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
/** Elbow: `via: "x"` turns horizontally first (final leg vertical, arrowhead points down/up);
 * `"y"` turns vertically first (final leg horizontal). */
function elbow(a: Point, b: Point, via: "x" | "y" = "y"): string {
  const mid: Point = via === "y" ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
  return `M ${a.x} ${a.y} L ${mid.x} ${mid.y} L ${b.x} ${b.y}`;
}

const ARROWS: string[] = [
  // Trading engine, left to right.
  line(bottomOf(BOXES.bid), topOf(BOXES.loadDocs)),
  line(rightOf(BOXES.loadDocs), leftOf(BOXES.search)),
  line(rightOf(BOXES.search), leftOf(BOXES.steps)),
  // One clean connector from the Step 1–5 card into the counterparty group; Offer is fed from
  // inside that group, so no second overlapping line is drawn here.
  line(rightOf(BOXES.steps), leftOf(BOXES.choice)),
  // Counterparty group's own loop.
  line(bottomOf(BOXES.offer), topOf(BOXES.choice)),
  line(rightOf(BOXES.choice), leftOf(BOXES.counterOffer)),
  line(leftOf(BOXES.counterOffer), rightOf(BOXES.choice)),
  `M ${cx(BOXES.counterOffer)} ${BOXES.counterOffer.y} L ${cx(BOXES.counterOffer)} ${BOXES.offer.y + 22} L ${BOXES.offer.x + BOXES.offer.w} ${BOXES.offer.y + 22}`,
  line(bottomOf(BOXES.choice), topOf(BOXES.socialMedia)),
  // Compliance engine chain.
  line(rightOf(BOXES.expressIntent), { x: COUNTERPARTY_FRAME.x, y: cy(BOXES.socialMedia) - 22 }),
  line(bottomOf(BOXES.expressIntent), topOf(BOXES.poi)),
  line(bottomOf(BOXES.poi), topOf(BOXES.withoutADoubt)),
  line(bottomOf(BOXES.withoutADoubt), topOf(BOXES.wad)),
  line(bottomOf(BOXES.wad), topOf(BOXES.businessDocs)),
  // Into execution, then finality, then memory.
  line({ x: BOXES.businessDocs.x + BOXES.businessDocs.w - 20, y: BOXES.businessDocs.y + BOXES.businessDocs.h }, { x: BOXES.execution.x, y: BOXES.execution.y + 24 }),
  line(rightOf(BOXES.execution), leftOf(BOXES.entryExit)),
  line(rightOf(BOXES.entryExit), leftOf(BOXES.finality)),
  line({ x: cx(BOXES.finality) - 40, y: BOXES.finality.y }, { x: MEMORY.cx + 96, y: MEMORY.cy + 106 }),
];

const STEP_CHIPS = ["+STEP 1", "+STEP 2", "+STEP 3", "+STEP 4", "+STEP 5"];

function ArrowLayer() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <marker id="map-arrowhead" markerWidth="9" markerHeight="9" refX="8.5" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" className="fill-foreground/70" />
        </marker>
      </defs>
      {ARROWS.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          className="stroke-foreground/60"
          strokeWidth={2}
          markerEnd="url(#map-arrowhead)"
        />
      ))}
    </svg>
  );
}

function Frame({
  box,
  className,
  label,
  labelClassName,
}: {
  box: Box;
  className: string;
  label?: string | undefined;
  labelClassName?: string | undefined;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute rounded-2xl border", className)}
      style={{ left: px(box.x), top: py(box.y), width: px(box.w), height: py(box.h) }}
    >
      {label && (
        <span
          className={cn(
            "absolute left-4 top-3 text-[11px] font-semibold uppercase leading-tight tracking-wide sm:text-xs",
            labelClassName,
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function MapNode({
  box,
  label,
  icon: Icon,
  state,
  onClick,
  lock,
  fill,
  sub,
}: {
  box: Box;
  label: string;
  icon?: typeof Search | undefined;
  state: NodeState;
  onClick?: (() => void) | undefined;
  lock?: string | null | undefined;
  /** Tile colour taken from the source map. */
  fill: string;
  sub?: string | undefined;
}) {
  const locked = state === "locked";
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      disabled={locked || !onClick}
      title={locked ? (lock ?? undefined) : undefined}
      style={{ left: px(box.x), top: py(box.y), width: px(box.w), height: py(box.h) }}
      className={cn(
        "absolute flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 px-3 text-center text-[11px] font-bold uppercase leading-tight tracking-wide transition-colors sm:text-[13px]",
        fill,
        state === "done" && "border-success text-success",
        state === "active" && "animate-throb-aqua border-[#00e5ff]",
        locked && "cursor-not-allowed opacity-40",
        !locked && onClick && "hover:brightness-110",
      )}
    >
      <span className="flex w-full items-center justify-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="whitespace-normal break-words leading-tight">{label}</span>
        {state === "done" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />}
      </span>
      {sub && <span className="w-full text-[9px] font-medium normal-case leading-snug opacity-90">{sub}</span>}
    </button>
  );
}

function SideLabel({ x, y, text, className }: { x: number; y: number; text: string; className?: string }) {
  return (
    <span
      className={cn("pointer-events-none absolute text-[11px] font-semibold leading-tight sm:text-sm", className)}
      style={{ left: px(x), top: py(y) }}
    >
      {text}
    </span>
  );
}

/**
 * The Map screen: the whole deal pipeline drawn as the product's own workflow diagram, in the
 * same positions as the source map. Every tile reads its state from the live deal record and the
 * shared gating rules, and opens exactly the same step frame the step list opens.
 */
export function MapView({
  tx,
  reload,
  readOnly,
  onBid,
  onLoadDocuments,
  searching,
}: {
  tx: Transaction | null;
  reload: () => void;
  readOnly?: boolean | undefined;
  /** Bid tile — opens the registration workspace beside the map. */
  onBid?: (() => void) | undefined;
  /** Load Deal Documents tile — opens the search prompt + upload window. */
  onLoadDocuments?: (() => void) | undefined;
  /** True while AI and AI+ are running, so Search pulses and shows its own progress bar. */
  searching?: boolean | undefined;
}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string } | null>(null);

  const open = (stage: StageKey, step: string) => {
    if (readOnly || !tx) return;
    setPanel((p) => (p?.stage === stage && p?.step === step ? null : { stage, step }));
  };
  const st = (stage: StageKey, step: string) => nodeState(stage, step, tx);
  const lock = (stage: StageKey, step: string) => (tx ? lockReason(stage, step, tx) : "Register a bid or offer first");

  const node = (
    key: keyof typeof BOXES,
    label: string,
    stage: StageKey,
    step: string,
    fill: string,
    icon?: typeof Search,
    sub?: string,
    override?: { state?: NodeState; onClick?: () => void },
  ) => (
    <MapNode
      box={BOXES[key]}
      label={label}
      icon={icon}
      sub={sub}
      fill={fill}
      state={override?.state ?? st(stage, step)}
      lock={lock(stage, step)}
      onClick={override?.onClick ?? (() => open(stage, step))}
    />
  );

  const YELLOW = "border-[#e6b422] bg-[#fbe08a] text-[#1c1c2b]";
  const BLUE = "border-[#c9d4ef] bg-[#e8edf9] text-[#1c1c2b]";
  const CREAM = "border-[#d9c48a] bg-[#fdf6e0] text-[#1c1c2b]";
  const MINT = "border-[#8fd3bc] bg-[#e4f6ef] text-[#12312a]";
  const LAVENDER = "border-[#b9b5e8] bg-[#eceafb] text-[#232046]";

  return (
    <div className="relative h-full w-full">
      <div className="flex h-full w-full items-start justify-center overflow-hidden">
        <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}`, maxHeight: "100%" }}>
          <ArrowLayer />

          {/* Engine frames */}
          <Frame
            box={TRADE_ENGINE_FRAME}
            className="border-[#8fd3bc] bg-[#e4f6ef]/40"
            label="1. Trade Engine"
            labelClassName="text-[#12312a]"
          />
          <Frame
            box={COUNTERPARTY_FRAME}
            className="border-[#e6d9a8] bg-[#fdf6e0]/60"
          />
          <Frame
            box={COMPLIANCE_FRAME}
            className="border-[#8fd3bc] bg-[#e4f6ef]/50"
            label="2. Compliance & Governance Engine"
            labelClassName="text-[#12312a]"
          />

          <SideLabel x={415} y={176} text="AI and AI+" className="text-foreground" />
          <SideLabel x={648} y={726} text="KYC, KYB, PEP, AML" className="text-foreground" />
          <SideLabel x={648} y={822} text="POI, NDA, MOU, Contract" className="text-foreground" />
          <SideLabel x={1310} y={1012} text="Payment, Signoff, Handover" className="text-foreground" />

          {/* Step card between Search and the counterparty group */}
          <div
            className="pointer-events-none absolute rounded-lg border-2 border-[#3f5bd9] bg-[#fdf6e0] px-2 py-2"
            style={{
              left: px(BOXES.steps.x),
              top: py(BOXES.steps.y),
              width: px(BOXES.steps.w),
              height: py(BOXES.steps.h),
            }}
          >
            <ul className="flex h-full flex-col justify-between">
              {STEP_CHIPS.map((s) => (
                <li key={s} className="text-[10px] font-semibold text-[#1c1c2b] sm:text-[11px]">
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* 1. Trade engine — Bid and Load Deal Documents drive the workspace beside the map. */}
          {node("bid", "Bid", "trading", "bid-offer", YELLOW, Gavel, undefined, {
            ...(onBid ? { onClick: onBid } : {}),
          })}
          {node("loadDocs", "Load Deal Documents", "trading", "documents", BLUE, FileText, undefined, {
            ...(onLoadDocuments ? { onClick: onLoadDocuments } : {}),
          })}
          {node("search", "Search", "trading", "search", MINT, Search, undefined,
            searching ? { state: "active" } : {})}
          {searching && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: px(BOXES.search.x),
                top: py(BOXES.search.y + BOXES.search.h + 8),
                width: px(BOXES.search.w),
              }}
            >
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#cfe9df]">
                <div className="h-full w-1/3 animate-[slide-in-right_1.4s_ease-in-out_infinite] rounded-full bg-[#12312a]" />
              </div>
              <p className="mt-1 text-center text-[10px] font-semibold text-foreground">AI and AI+ searching…</p>
            </div>
          )}
          {node("offer", "Offer", "trading", "counterparties", CREAM, Tag)}
          {node("choice", "Choice", "trading", "choice", CREAM, Share2)}
          {node("counterOffer", "Counter Offer", "trading", "counterparties", CREAM, RefreshCw)}
          {node("socialMedia", "Social Media", "trading", "online-media", CREAM, Users)}

          {/* 2. Compliance & governance engine */}
          {node("expressIntent", "Express Intent", "trading", "intent", MINT, ShieldCheck)}
          {node("poi", "POI", "trading", "poi", MINT, Building2)}
          {node("withoutADoubt", "Without a Doubt", "trading", "media", MINT, FileText)}
          {node("wad", "WaD", "compliance", "wad", MINT, ShieldCheck)}
          {node("businessDocs", "Business Docs", "execution", "entry", MINT, FolderClosed)}

          {/* 3. Execution engine */}
          <MapNode
            box={BOXES.execution}
            label="3. Execution Engine"
            fill={LAVENDER}
            sub="Concept, Pre-Reqs, Feas, Bankability, Project Prep, Implementation"
            state={st("execution", "preparation")}
            lock={lock("execution", "preparation")}
            onClick={() => open("execution", "preparation")}
          />
          {node("entryExit", "Entry / Exit", "execution", "stakeholders", LAVENDER, LogIn)}
          {node("finality", "4. Finality", "finality", "entry", LAVENDER, Banknote)}

          {/* 5. Memory engine */}
          <button
            type="button"
            onClick={() => open("memory", "ledger")}
            disabled={st("memory", "ledger") === "locked"}
            title={lock("memory", "ledger") ?? undefined}
            style={{
              left: px(MEMORY.cx - MEMORY.r),
              top: py(MEMORY.cy - MEMORY.r),
              width: px(MEMORY.r * 2),
              height: py(MEMORY.r * 2),
            }}
            className={cn(
              "absolute flex flex-col items-center justify-center gap-1 rounded-full border-2 px-6 text-center transition-colors",
              LAVENDER,
              st("memory", "ledger") === "done" && "border-success",
              st("memory", "ledger") === "active" && "animate-throb-aqua border-[#00e5ff]",
              st("memory", "ledger") === "locked" ? "cursor-not-allowed opacity-40" : "hover:brightness-110",
            )}
          >
            <Database className="h-6 w-6" />
            <span className="text-[11px] font-bold uppercase tracking-wide sm:text-sm">5. Memory Engine</span>
            <span className="text-[11px] font-semibold sm:text-[13px]">Compounding CDA</span>
            <span className="text-[9px] opacity-80 sm:text-[10px]">(Capital Deployment Assessment)</span>
          </button>
        </div>
      </div>

      {panel && !readOnly && (
        <InlineFrame
          tx={tx}
          stage={panel.stage}
          step={panel.step}
          reload={reload}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
