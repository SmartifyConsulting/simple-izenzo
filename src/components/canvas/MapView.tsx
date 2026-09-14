import { useState } from "react";
import {
  Banknote,
  Briefcase,
  Building2,
  CheckCircle2,
  Database,
  FileText,
  FolderClosed,
  Gavel,
  ListChecks,
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
  // A brand-new workspace already carries its own BID number, so Bid is behind us: Upload Files is
  // the thing to do next and pulses instead.
  if (!tx) {
    if (step === "bid-offer") return "done";
    return step === "documents" ? "active" : "locked";
  }
  if (lockReason(stage, step, tx)) return "locked";
  const idx = stepIndex(stage, step);
  const currentIdx = stepIndex(tx.stage, tx.step);
  if (idx < currentIdx) return "done";
  if (idx === currentIdx) return "active";
  return "open";
}

// Fixed diagram coordinate system, proportioned for the workflow column beside the Live
// Workspace: everything is placed on this canvas and scaled to the container with percentages, so
// tiles and their connecting lines always stay aligned however wide that column is.
const W = 960;
const H = 900;
const px = (v: number) => `${(v / W) * 100}%`;
const py = (v: number) => `${(v / H) * 100}%`;

type Box = { x: number; y: number; w: number; h: number };

/** Rows and columns are aligned so every connector is a straight horizontal or vertical run. */
const BOXES = {
  bid: { x: 40, y: 80, w: 160, h: 56 },
  loadDocs: { x: 40, y: 174, w: 160, h: 56 },
  // Search sits level with Load Deal Documents (same centre-line, for a straight connector), and
  // the Search Results card sits directly beneath Search — now a single compact line of results
  // rather than a tall stacked list, so Choice/Counter Offer/Online Media Screening can all sit
  // higher, letting the rest of the diagram move up to fit without scrolling.
  search: { x: 230, y: 171, w: 160, h: 62 },
  // Search Results now sits in line between Search and Choice, all on the same row.
  steps: { x: 410, y: 170, w: 140, h: 64 },
  // Offer/Choice/Counter Offer/Online Media Screening move further right to leave room for the
  // Search Results card between Search and Choice.
  offer: { x: 570, y: 80, w: 160, h: 56 },
  choice: { x: 570, y: 174, w: 160, h: 56 },
  // Counter Offer sits at the very right edge of the Trading frame, level with Choice and Search.
  counterOffer: { x: 750, y: 170, w: 150, h: 64 },
  // Wide enough that "Online Media Screening" fits on one line instead of wrapping.
  // Same width and centre-line as Choice, so the connector between them is straight. A little
  // extra padding between Step 1's horizontal rows.
  socialMedia: { x: 570, y: 255, w: 160, h: 64 },
  // Step 2 (Compliance & Governance) moves further down from Step 1's frame; Step 3/4 shift down
  // to match so the connector between them (unchanged below) doesn't have to stretch or overlap.
  // Extra clearance below the frame's floating heading + "Governance" row so Express Intent
  // never touches either of them.
  // Widened and centred within the (also widened) Compliance frame.
  expressIntent: { x: 60, y: 420, w: 280, h: 48 },
  poi: { x: 60, y: 476, w: 280, h: 48 },
  withoutADoubt: { x: 60, y: 532, w: 280, h: 54 },
  wad: { x: 60, y: 594, w: 280, h: 54 },
  businessDocs: { x: 60, y: 656, w: 280, h: 54 },
  // Step 3 (Execution, with Entry/Exit beside it) and Step 4 (Finality) sit directly under Step 2,
  // aligned with the Compliance frame's left edge instead of off to its right.
  // Moved down ~1cm from Step 2, with even gaps between Execution, Entry/Exit and Finality.
  execution: { x: 70, y: 778, w: 260, h: 90 },
  // Centred inside its own frame, which itself sits centred in the gap between Step 3 and Step 4.
  // Same size as the Search Results tile.
  entryExit: { x: 410, y: 794, w: 140, h: 62 },
  finality: { x: 635, y: 778, w: 250, h: 90 },
} as const satisfies Record<string, Box>;

// One outer frame holds the whole trading step — Bid, Load Deal Documents, Search, the Search
// Results card and the counterparty tiles (Offer, Choice, Counter Offer, Online Media Screening),
// which no longer carry a frame of their own. Trimmed to its actual content height (rather than
// leaving a tall gap beneath it) so Compliance can sit right below without the diagram needing a
// scroll.
const TRADE_ENGINE_FRAME: Box = { x: 14, y: 46, w: 932, h: 305 };
const COMPLIANCE_FRAME: Box = { x: 30, y: 386, w: 340, h: 346 };
// Execution and Entry/Exit+Finality get the same bordered, labelled group frame as Steps 1 and
// 2, instead of sitting as bare tiles with no frame of their own.
const EXECUTION_FRAME: Box = { x: 30, y: 762, w: 340, h: 122 };
const FINALITY_FRAME: Box = { x: 590, y: 762, w: 340, h: 122 };
// Entry/Exit gets the same bordered frame treatment, centred in the gap between Step 3 and 4.
const ENTRY_EXIT_FRAME: Box = { x: 390, y: 762, w: 180, h: 122 };
const MEMORY = { cx: 570, cy: 520, r: 118 };

// A connector arriving at a group frame stops this many units short of its border, so the tip
// points at the frame (and the heading floating on it) instead of touching or crossing into it.
const ARROW_GAP = 8;

const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;
const topOf = (b: Box) => ({ x: cx(b), y: b.y });
const bottomOf = (b: Box) => ({ x: cx(b), y: b.y + b.h });
const leftOf = (b: Box) => ({ x: b.x, y: cy(b) });
const rightOf = (b: Box) => ({ x: b.x + b.w, y: cy(b) });

type Point = { x: number; y: number };
const line = (a: Point, b: Point) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
/** An orthogonal run through the given turning points — every leg horizontal or vertical. */
const path = (...pts: Point[]) => pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");

const ARROWS: string[] = [
  // Trading step: Bid down into Load Deal Documents, straight across into Search (same centre-
  // line), down into the step chips, then across into Choice.
  line(bottomOf(BOXES.bid), topOf(BOXES.loadDocs)),
  line(rightOf(BOXES.loadDocs), leftOf(BOXES.search)),
  // Search Results now sits in line between Search and Choice, all on Search's row.
  line(rightOf(BOXES.search), leftOf(BOXES.steps)),
  line(rightOf(BOXES.steps), leftOf(BOXES.choice)),
  // Counterparty loop: Offer into Choice, Choice out to Counter Offer and back, then Social Media.
  line(bottomOf(BOXES.offer), topOf(BOXES.choice)),
  path({ x: BOXES.choice.x + BOXES.choice.w, y: cy(BOXES.choice) - 11 }, { x: BOXES.counterOffer.x, y: cy(BOXES.choice) - 11 }),
  path({ x: BOXES.counterOffer.x, y: cy(BOXES.choice) + 11 }, { x: BOXES.choice.x + BOXES.choice.w, y: cy(BOXES.choice) + 11 }),
  path(topOf(BOXES.counterOffer), { x: cx(BOXES.counterOffer), y: cy(BOXES.offer) }, rightOf(BOXES.offer)),
  line(bottomOf(BOXES.choice), topOf(BOXES.socialMedia)),
  // Out of trading and down into the compliance step.
  path(bottomOf(BOXES.socialMedia), { x: cx(BOXES.socialMedia), y: 366 }, { x: cx(BOXES.expressIntent), y: 366 }, topOf(BOXES.expressIntent)),
  line(bottomOf(BOXES.expressIntent), topOf(BOXES.poi)),
  line(bottomOf(BOXES.poi), topOf(BOXES.withoutADoubt)),
  line(bottomOf(BOXES.withoutADoubt), topOf(BOXES.wad)),
  line(bottomOf(BOXES.wad), topOf(BOXES.businessDocs)),
  // Step 2 into Step 3: straight down out of Business Docs, stopping just short of the Step 3
  // frame's edge — pointing at it (and the heading floating on it) rather than touching it.
  line(bottomOf(BOXES.businessDocs), { x: cx(BOXES.businessDocs), y: EXECUTION_FRAME.y - ARROW_GAP }),
  // Execution, Entry/Exit and Finality sit in a single row — connectors run frame edge to frame
  // edge with a small gap at each end, so the tip points at the frame/heading without touching it.
  line(
    { x: EXECUTION_FRAME.x + EXECUTION_FRAME.w + ARROW_GAP, y: cy(ENTRY_EXIT_FRAME) },
    { x: ENTRY_EXIT_FRAME.x - ARROW_GAP, y: cy(ENTRY_EXIT_FRAME) },
  ),
  line(
    { x: ENTRY_EXIT_FRAME.x + ENTRY_EXIT_FRAME.w + ARROW_GAP, y: cy(FINALITY_FRAME) },
    { x: FINALITY_FRAME.x - ARROW_GAP, y: cy(FINALITY_FRAME) },
  ),
  path(
    { x: cx(BOXES.finality), y: FINALITY_FRAME.y - ARROW_GAP },
    { x: cx(BOXES.finality), y: 700 },
    { x: MEMORY.cx, y: 700 },
    { x: MEMORY.cx, y: MEMORY.cy + MEMORY.r + ARROW_GAP },
  ),
];

function ArrowLayer() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <marker id="map-arrowhead" markerWidth="7" markerHeight="7" refX="6.5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" className="fill-muted-foreground" />
        </marker>
        {/* The upper semicircle of the Memory circle's own outline, so "Step 5 · Memory" can run
            along its circumference instead of sitting as a flat line inside it. */}
        <path
          id="memory-arc"
          fill="none"
          d={`M ${MEMORY.cx - MEMORY.r} ${MEMORY.cy} A ${MEMORY.r} ${MEMORY.r} 0 0 1 ${MEMORY.cx + MEMORY.r} ${MEMORY.cy}`}
        />
      </defs>
      <text
        className="fill-primary text-[11px] font-semibold uppercase tracking-[0.09em]"
        textAnchor="middle"
      >
        <textPath href="#memory-arc" startOffset="50%">
          Step 5 · Memory
        </textPath>
      </text>
      {ARROWS.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          className="stroke-muted-foreground/60"
          strokeWidth={1.25}
          strokeLinejoin="round"
          markerEnd="url(#map-arrowhead)"
        />
      ))}
    </svg>
  );
}

/** A group frame: a hairline rounded outline with its name set into the top edge — drawn from the
 * theme's own colours, so it reads the same way on cream as it does on black. */
function Frame({
  box,
  label,
  subLabel,
}: {
  box: Box;
  label?: string | undefined;
  /** A second line that wraps onto its own row sitting inside the frame's top edge, rather than
   * floating on the border with the main label — used to split a long name like "Compliance &
   * Governance" across two rows instead of squeezing it onto the one that floats on the line. */
  subLabel?: string | undefined;
}) {
  return (
    <div
      className="pointer-events-none absolute rounded-3xl border border-border"
      style={{ left: px(box.x), top: py(box.y), width: px(box.w), height: py(box.h) }}
    >
      {label && (
        <span className="label-caps absolute -top-2 left-5 whitespace-nowrap bg-background px-2 text-primary">
          {label}
        </span>
      )}
      {subLabel && (
        <span className="label-caps absolute left-5 top-3 whitespace-nowrap text-primary">
          {subLabel}
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
  sub,
  subTone,
  plain,
  subSize,
}: {
  box: Box;
  label: string;
  icon?: typeof Search | undefined;
  state: NodeState;
  onClick?: (() => void) | undefined;
  lock?: string | null | undefined;
  sub?: string | undefined;
  /** "gate" prints the sub-line in the warning colour, as with Without a Doubt. */
  subTone?: "muted" | "gate" | "id" | undefined;
  /** No border/background of its own — used when the node already sits directly inside its own
   * group Frame (Step 3, Step 4), so it doesn't draw a second, redundant box inside that one. */
  plain?: boolean | undefined;
  /** Execution/Finality's own sub-text reads larger than the compact gate/manual-doc notes on
   * other tiles. */
  subSize?: "xs" | "sm" | undefined;
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
        "absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden px-2 text-center font-sans text-[11px] font-semibold leading-tight transition-colors",
        // Border always stays a steady, visible border-border — like every group Frame — rather
        // than dimming to border-border/50 when locked; only the text/icon show that state.
        plain ? "rounded-none border-0 bg-transparent" : "rounded-xl border border-border bg-card/40",
        !plain && state === "open" && "text-foreground hover:border-primary/60",
        plain && state === "open" && "text-foreground",
        state === "done" && (plain ? "text-success" : "border-success/70 text-success"),
        state === "active" && (plain ? "animate-throb-aqua text-primary" : "animate-throb-aqua border-primary text-primary"),
        locked && "cursor-not-allowed text-muted-foreground",
      )}
    >
      <span className="flex w-full items-center justify-center gap-1.5">
        {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", state === "open" && "text-primary")} />}
        <span className="whitespace-normal break-words leading-tight">{label}</span>
        {state === "done" && <CheckCircle2 className="h-3 w-3 shrink-0 text-success" />}
      </span>
      {sub && (
        <span
          className={cn(
            "w-full font-semibold uppercase leading-snug tracking-wide",
            subSize === "sm" ? "text-[10px]" : "text-[9.5px]",
            subTone === "gate"
              ? "text-[#C1653D]"
              : subTone === "id"
                ? "font-mono font-bold tracking-normal text-foreground"
                : "font-medium normal-case tracking-normal text-muted-foreground",
          )}
        >
          {sub}
        </span>
      )}
    </button>
  );
}

/**
 * The deal map: the whole pipeline drawn as the product's own workflow diagram, shown above the
 * vertical stepper so a person can see where they are in the deal cycle at a glance. Every tile
 * reads its state from the live deal record and the shared gating rules, and opens exactly the
 * same step frame the step list opens.
 */
export function MapView({
  tx,
  reload,
  readOnly,
  onBid,
  onLoadDocuments,
  searching,
  reference,
  onOpenStep,
  overrideStates,
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
  /** The bid/offer number this map belongs to — shown inside the Bid tile, including on a brand-new
   * workspace whose number has been issued but whose bid is not recorded yet. */
  reference?: string | null | undefined;
  /** When given, a tile hands the (stage, step) to the caller instead of opening its own inline
   * frame — used when the map sits beside the Live Workspace. */
  onOpenStep?: ((stage: StageKey, step: string) => void) | undefined;
  /** The same override map the step list uses, keyed by its row names, so the map pulses on
   * exactly the same activity the stepper does. */
  overrideStates?: Record<string, NodeState> | undefined;
}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string } | null>(null);

  const open = (stage: StageKey, step: string) => {
    if (readOnly || !tx) return;
    if (onOpenStep) {
      onOpenStep(stage, step);
      return;
    }
    setPanel((p) => (p?.stage === stage && p?.step === step ? null : { stage, step }));
  };
  const st = (stage: StageKey, step: string, overrideKey?: string): NodeState =>
    (overrideKey ? overrideStates?.[overrideKey] : undefined) ?? nodeState(stage, step, tx);
  const lock = (stage: StageKey, step: string) => (tx ? lockReason(stage, step, tx) : "Register a bid or offer first");

  const node = (
    key: keyof typeof BOXES,
    label: string,
    stage: StageKey,
    step: string,
    icon?: typeof Search,
    opts?: {
      sub?: string;
      subTone?: "muted" | "gate" | "id";
      overrideKey?: string;
      state?: NodeState;
      onClick?: () => void;
      plain?: boolean;
      subSize?: "xs" | "sm";
    },
  ) => (
    <MapNode
      box={BOXES[key]}
      label={label}
      icon={icon}
      {...(opts?.sub ? { sub: opts.sub } : {})}
      {...(opts?.subTone ? { subTone: opts.subTone } : {})}
      {...(opts?.plain ? { plain: true } : {})}
      {...(opts?.subSize ? { subSize: opts.subSize } : {})}
      state={opts?.state ?? st(stage, step, opts?.overrideKey)}
      lock={lock(stage, step)}
      onClick={opts?.onClick ?? (() => open(stage, step))}
    />
  );

  const memoryState = st("memory", "ledger");

  return (
    <div className="relative h-full w-full">
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <ArrowLayer />

        <Frame box={TRADE_ENGINE_FRAME} label="Step 1 · Trading" />
        <Frame box={COMPLIANCE_FRAME} label="Step 2 · Compliance" subLabel="Governance" />
        <Frame box={EXECUTION_FRAME} label="Step 3 · Execution" />
        <Frame box={ENTRY_EXIT_FRAME} />
        <Frame box={FINALITY_FRAME} label="Step 4 · Finality" />

        {/* A placeholder for what Search returns — just labelled, no results content shown. */}
        <div
          className="pointer-events-none absolute flex items-center justify-center overflow-hidden rounded-xl border border-border bg-card/40 px-3 py-2"
          style={{
            left: px(BOXES.steps.x),
            top: py(BOXES.steps.y),
            width: px(BOXES.steps.w),
            height: py(BOXES.steps.h),
          }}
        >
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5 shrink-0" />
            Search Results
          </p>
        </div>

        {/* Step 1 — trading. Bid and Load Deal Documents drive the workspace beside the map. */}
        {node("bid", "Bid", "trading", "bid-offer", Gavel, {
          overrideKey: "bidRegistration",
          ...(reference ? { sub: reference, subTone: "id" as const } : {}),
          ...(onBid ? { onClick: onBid } : {}),
        })}
        {node("loadDocs", "Upload Files", "trading", "documents", FileText, {
          overrideKey: "docSubmission",
          ...(onLoadDocuments ? { onClick: onLoadDocuments } : {}),
        })}
        {node("search", "Search", "trading", "search", Search, {
          overrideKey: "search",
          sub: "AI and AI+",
          ...(searching ? { state: "active" as NodeState } : {}),
        })}
        {searching && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: px(BOXES.search.x),
              top: py(BOXES.search.y + BOXES.search.h + 6),
              width: px(BOXES.search.w),
            }}
          >
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-[slide-in-right_1.4s_ease-in-out_infinite] rounded-full bg-success" />
            </div>
          </div>
        )}
        {node("offer", "Offer", "trading", "counterparties", Tag)}
        {node("choice", "Choice", "trading", "choice", Share2, { overrideKey: "choice" })}
        {node("counterOffer", "Counter Offer", "trading", "counterparties", RefreshCw)}
        {node("socialMedia", "Online Screening", "trading", "online-media", Users, {
          overrideKey: "onlineMedia",
        })}

        {/* Step 2 — compliance & governance */}
        {node("expressIntent", "Express Intent", "trading", "intent", ShieldCheck, {
          overrideKey: "intent",
        })}
        {node("poi", "Proof of Intent", "trading", "poi", Building2, { overrideKey: "poi" })}
        {node("withoutADoubt", "Without a Doubt", "compliance", "wad", ShieldCheck, {
          overrideKey: "wad",
          sub: "Hard gate · non-waivable",
          subTone: "gate",
        })}
        {node("wad", "KYC / KYB", "compliance", "wad", Users, {
          overrideKey: "wad",
          sub: "KYC, KYB, PEP, AML",
        })}
        {node("businessDocs", "Business Docs", "execution", "entry", FolderClosed, {
          sub: "POI, NDA, MOU, Contract",
        })}

        {/* Step 3 — execution. No border of its own — it sits directly inside the Step 3 frame. */}
        <MapNode
          box={BOXES.execution}
          label="Execution"
          icon={Briefcase}
          sub="Concept, Pre-Reqs, Feasibility, Bankability, Project Prep, Implementation"
          subSize="sm"
          state={st("execution", "preparation")}
          lock={lock("execution", "preparation")}
          onClick={() => open("execution", "preparation")}
          plain
        />
        {/* Entry/Exit sits between the Step 3 and Step 4 frames, on its own. */}
        {node("entryExit", "Entry / Exit", "execution", "stakeholders", LogIn, { plain: true })}
        {/* Step 4 — finality. No border of its own — it sits directly inside the Step 4 frame. */}
        {node("finality", "Finality", "finality", "entry", Banknote, {
          sub: "Payment, Signoff, Handover",
          subSize: "sm",
          plain: true,
        })}

        {/* Step 5 — memory */}
        <button
          type="button"
          onClick={() => open("memory", "ledger")}
          disabled={memoryState === "locked"}
          title={lock("memory", "ledger") ?? undefined}
          style={{
            left: px(MEMORY.cx - MEMORY.r),
            top: py(MEMORY.cy - MEMORY.r),
            width: px(MEMORY.r * 2),
            height: py(MEMORY.r * 2),
          }}
          className={cn(
            // Border always reads like the other steps' group frames (a steady border-border)
            // rather than dimming when locked — only the text/icon show that state.
            "absolute flex flex-col items-center justify-center gap-1 rounded-full border border-border bg-card/40 px-5 text-center font-sans transition-colors",
            memoryState === "open" && "text-foreground hover:border-primary/60",
            memoryState === "done" && "border-success/70 text-success",
            memoryState === "active" && "animate-throb-aqua border-primary text-primary",
            memoryState === "locked" && "cursor-not-allowed text-muted-foreground",
          )}
        >
          <Database className={cn("h-4 w-4", memoryState === "open" && "text-primary")} />
          <span className="text-[12px] font-medium leading-tight">Compounding CDA</span>
          <span className="text-[10px] leading-snug text-muted-foreground">
            Capital Deployment Assessment
          </span>
        </button>
      </div>

      {panel && !readOnly && tx && (
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
