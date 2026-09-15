import { useState } from "react";
import {
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
// Grown 20 units (Step 2-4 shifted down the same amount) to make room for the arrow into Step 2.
const H = 940;
const px = (v: number) => `${(v / W) * 100}%`;
const py = (v: number) => `${(v / H) * 100}%`;

type Box = { x: number; y: number; w: number; h: number };

/** Rows and columns are aligned so every connector is a straight horizontal or vertical run. */
const BOXES = {
  // Raised (was 80) so Step 1's frame starts level with the Bid Registration frame in the Live
  // Workspace column beside it, instead of sitting lower with a bigger gap above it.
  // Moved down slightly so the arrow into Load Deal Documents matches the length of every other
  // down-arrow on the map (20 units — the same span as Online Screening into Express Intent).
  bid: { x: 40, y: 76, w: 160, h: 56 },
  loadDocs: { x: 40, y: 152, w: 160, h: 56 },
  // Search sits level with Load Deal Documents (same centre-line, for a straight connector), and
  // the Search Results card sits directly beneath Search — now a single compact line of results
  // rather than a tall stacked list, so Choice/Counter Offer/Online Media Screening can all sit
  // higher, letting the rest of the diagram move up to fit without scrolling.
  // Load Deal Documents → Search → Search Results → Choice now sit on three equal
  // horizontal gaps (~23.3 units each) instead of the first gap reading wider than the other two.
  search: { x: 223.3, y: 149, w: 160, h: 62 },
  // Search Results now sits in line between Search and Choice, all on the same row.
  steps: { x: 406.7, y: 148, w: 140, h: 64 },
  // Offer/Choice/Counter Offer/Online Media Screening move further right to leave room for the
  // Search Results card between Search and Choice.
  offer: { x: 570, y: 58, w: 160, h: 56 },
  choice: { x: 570, y: 152, w: 160, h: 56 },
  // Counter Offer sits at the very right edge of the Trading frame, level with Choice and Search.
  counterOffer: { x: 750, y: 148, w: 150, h: 64 },
  // Wide enough that "Online Screening" fits on one line instead of wrapping, and only one line
  // tall — so the Step 1 frame loses the height the two-line tile needed. Moved up 5 units (with
  // Express Intent below it) so its own arrow into Choice above it is also a 20-unit span.
  socialMedia: { x: 550, y: 228, w: 200, h: 48 },
  // Express Intent now lives inside Step 1's own frame, directly under Online Screening — it's
  // the "Steps" list order (Choice, Online Media Screening, Intent) mirrored on the map, instead
  // of visually grouped with Step 2's checks even though it advances the same trading stage.
  expressIntent: { x: 510, y: 296, w: 280, h: 48 },
  // Step 2 (GRC)'s remaining checks — every connecting arrow between them is the same 20-unit span
  // as Online Screening → Express Intent above, instead of three different lengths; Step 3/4
  // follow well beneath it, with the gap to each neighbour trimmed slightly (was 50) so they still
  // fit on the canvas. Step 2 through 4 and Entry/Exit all shifted down 20 units together
  // (relative positions between them unchanged) to open up room below Step 1 for the arrow
  // pointing into Step 2.
  poi: { x: 60, y: 462, w: 280, h: 48 },
  // The KYC/KYB/PEP/AML checks now run before Without a Doubt, so they sit above it.
  wad: { x: 60, y: 530, w: 280, h: 54 },
  withoutADoubt: { x: 60, y: 604, w: 280, h: 54 },
  businessDocs: { x: 60, y: 678, w: 280, h: 54 },
  // Step 3 (Execution, with Entry/Exit beside it) and Step 4 (Finality) sit well clear of Step 2,
  // all 40% flatter than before — and wider, so their detail lines still fit.
  execution: { x: 45, y: 841, w: 310, h: 58 },
  // Width trimmed 20% (was 140) and re-centred on the same midpoint.
  entryExit: { x: 424, y: 851, w: 112, h: 37 },
  finality: { x: 605, y: 841, w: 310, h: 58 },

} as const satisfies Record<string, Box>;

// One outer frame holds the whole trading step — Bid, Load Deal Documents, Search, the Search
// Results card, the counterparty tiles (Offer, Choice, Counter Offer, Online Screening) and now
// Express Intent — trimmed to its actual content height, and raised (was y: 46) to align with
// the Bid Registration frame beside it.
const TRADE_ENGINE_FRAME: Box = { x: 14, y: 24, w: 932, h: 343 };
// Taller again now its four checks are spread further apart. Shifted down 20 units (with
// everything below it) to open up room below Step 1 for the arrow pointing into Step 2.
const COMPLIANCE_FRAME: Box = { x: 30, y: 422, w: 340, h: 376 };
// Execution and Entry/Exit+Finality get the same bordered, labelled group frame as Steps 1 and
// 2, with the gap above trimmed slightly so the row fits on the canvas.
const EXECUTION_FRAME: Box = { x: 30, y: 833, w: 340, h: 73 };
const FINALITY_FRAME: Box = { x: 590, y: 833, w: 340, h: 73 };
// Width trimmed 20% (was 180), centred in the same gap between Step 3 and 4.
const ENTRY_EXIT_FRAME: Box = { x: 408, y: 833, w: 144, h: 73 };
// Kept beside Step 2 (not stacked under it) and re-centred on GRC's now-taller frame.
const MEMORY = { cx: 570, cy: 610, r: 110 };


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
  // Straight down into Express Intent — both tiles share the same centre-line now that it sits
  // directly under Online Screening inside Step 1's own frame.
  line(bottomOf(BOXES.socialMedia), topOf(BOXES.expressIntent)),
  // Out of Step 1 and into Step 2's checks: down, then left to Proof of Intent's centre-line,
  // stopping just short of the GRC frame's edge (matching the Step 2 → Step 3 connector below).
  path(
    bottomOf(BOXES.expressIntent),
    { x: cx(BOXES.expressIntent), y: (TRADE_ENGINE_FRAME.y + TRADE_ENGINE_FRAME.h + COMPLIANCE_FRAME.y) / 2 },
    { x: cx(BOXES.poi), y: (TRADE_ENGINE_FRAME.y + TRADE_ENGINE_FRAME.h + COMPLIANCE_FRAME.y) / 2 },
    { x: cx(BOXES.poi), y: COMPLIANCE_FRAME.y - ARROW_GAP },
  ),
  line(bottomOf(BOXES.poi), topOf(BOXES.wad)),
  line(bottomOf(BOXES.wad), topOf(BOXES.withoutADoubt)),
  line(bottomOf(BOXES.withoutADoubt), topOf(BOXES.businessDocs)),
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
  // Step 4 into Memory: straight up out of the Finality frame, then a single right-angle turn
  // left into the circle at its centre height, rather than looping down and back up.
  path(
    { x: cx(BOXES.finality), y: FINALITY_FRAME.y - ARROW_GAP },
    { x: cx(BOXES.finality), y: MEMORY.cy },
    { x: MEMORY.cx + MEMORY.r + ARROW_GAP, y: MEMORY.cy },
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
      </defs>
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

/**
 * "Step 5 · Memory" as a straight black pill inside the Memory circle, near its top — not on the
 * curve, so its text is a plain, always-horizontal heading like every other step label.
 */
function MemoryArcLabel() {
  return (
    <div
      className="pointer-events-none absolute z-10 flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full bg-black px-2.5 py-0.5 text-center font-sans text-[11px] font-semibold uppercase leading-none tracking-[0.09em] text-white"
      style={{ left: px(MEMORY.cx), top: py(MEMORY.cy - MEMORY.r * 0.42) }}
      aria-hidden
    >
      Step 5 · Memory
    </div>
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
        <span className="label-caps absolute -top-2 left-5 whitespace-nowrap rounded-full bg-[var(--step-pill-bg)] px-2.5 py-0.5 text-[var(--step-pill-fg)]">
          {label}
        </span>
      )}
      {subLabel && (
        <span className="label-caps absolute left-5 top-3 whitespace-nowrap rounded-full bg-[var(--step-pill-bg)] px-2.5 py-0.5 text-[var(--step-pill-fg)]">
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
  onOpenStep?: ((stage: StageKey, step: string, viewOnly: boolean) => void) | undefined;
  /** The same override map the step list uses, keyed by its row names, so the map pulses on
   * exactly the same activity the stepper does. */
  overrideStates?: Record<string, NodeState> | undefined;
}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string; viewOnly: boolean } | null>(null);

  // A "done" tile is a past stage — clicking it does nothing for now. A real read-only view of
  // completed steps is planned for a later phase; showing the live editable upload/search/results
  // UI for a step that's already behind the current pulse was confusing, so it's disabled rather
  // than shipped half-right.
  const open = (stage: StageKey, step: string, viewOnly = false) => {
    if (readOnly || !tx || viewOnly) return;
    if (onOpenStep) {
      onOpenStep(stage, step, viewOnly);
      return;
    }
    setPanel((p) => (p?.stage === stage && p?.step === step ? null : { stage, step, viewOnly }));
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
      onClick={
        opts?.onClick ?? (() => open(stage, step, (opts?.state ?? st(stage, step, opts?.overrideKey)) === "done"))
      }
    />
  );

  const memoryState = st("memory", "ledger");

  return (
    <div className="relative h-full w-full">
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <ArrowLayer />
        <MemoryArcLabel />


        <Frame box={TRADE_ENGINE_FRAME} label="Step 1 · Trading" />
        <Frame box={COMPLIANCE_FRAME} label="Step 2 · GRC" />
        <Frame box={EXECUTION_FRAME} label="Step 3 · Execution" />
        <Frame box={ENTRY_EXIT_FRAME} />
        <Frame box={FINALITY_FRAME} label="Step 4 · Finality" />

        {/* Mirrors Search's own state (same overrideKey) — once the pulse has moved on to Choice,
            the search is done, so its results read as green/ticked here too, not a plain
            placeholder forever. */}
        {node("steps", "Search Results", "trading", "search", ListChecks, { overrideKey: "search" })}

        {/* Step 1 — trading. Bid and Load Deal Documents drive the workspace beside the map. */}
        {node("bid", "Bid", "trading", "bid-offer", Gavel, {
          overrideKey: "bidRegistration",
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
            <div className="h-1 w-full overflow-hidden rounded-full bg-progress-track">
              <div className="h-full w-1/3 animate-[slide-in-right_1.4s_ease-in-out_infinite] rounded-full bg-success" />
            </div>
          </div>
        )}
        {node("offer", "Offer", "trading", "counterparties", Tag)}
        {node("choice", "Choice", "trading", "choice", Share2, { overrideKey: "choice" })}
        {/* Counter Offer is an optional side-loop, not a mandatory step in the linear flow — it
            should never read as "done" (ticked/green) just because the deal has moved past this
            point, since a counteroffer may never actually have happened. */}
        {node("counterOffer", "Counter Offer", "trading", "counterparties", RefreshCw, {
          // Pulses while a counter offer is out and unanswered; otherwise a plain side-loop tile.
          state: overrideStates?.["counterOffer"] ?? "open",
        })}

        {node("socialMedia", "Online Screening", "trading", "online-media", Users, {
          overrideKey: "onlineMedia",
        })}

        {/* Step 2 — compliance & governance */}
        {node("expressIntent", "Express Intent", "trading", "intent", ShieldCheck, {
          overrideKey: "intent",
        })}
        {node("poi", "Proof of Intent", "trading", "poi", Building2, { overrideKey: "poi" })}
        {node("wad", "KYC, KYB, PEP, AML", "compliance", "wad", Users, {
          overrideKey: "kycKyb",
        })}
        {node("withoutADoubt", "Without a Doubt", "compliance", "wad", ShieldCheck, {
          overrideKey: "wad",
          sub: "Hard gate · non-waivable",
          subTone: "gate",
        })}
        {node("businessDocs", "Business Docs", "execution", "business-docs", FolderClosed, {
          sub: "POI, NDA, MOU, Contract",
          overrideKey: "businessDocs",
        })}

        {/* Step 3 — execution. The word "Execution" is the frame's heading, so the tile carries only
            its detail line. */}
        <MapNode
          box={BOXES.execution}
          label=""
          sub="Concept, Pre-feasibility, Feasibility, Bankability, Implementation"
          subSize="xs"

          state={st("execution", "preparation", "execution")}
          lock={lock("execution", "preparation")}
          onClick={() => open("execution", "preparation")}
          plain
        />
        {/* Entry/Exit sits between the Step 3 and Step 4 frames, on its own. */}
        {node("entryExit", "Entry / Exit", "execution", "stakeholders", LogIn, { plain: true })}
        {/* Step 4 — finality. "Finality" is the frame heading, so the tile shows only its detail. */}
        {node("finality", "", "finality", "entry", undefined, {
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
            // A fixed 1:1 aspect ratio (rather than deriving height from H the way every
            // rectangular frame does) keeps this a true circle even if the canvas's own
            // rendered aspect ratio ever drifts from W/H — width alone then decides the size.
            aspectRatio: "1 / 1",
          }}
          className={cn(
            // Border always reads like the other steps' group frames (a steady border-border)
            // rather than dimming when locked — only the text/icon show that state.
            "absolute rounded-full border border-border bg-card/40 px-5 text-center font-sans transition-colors",
            memoryState === "open" && "text-foreground hover:border-primary/60",
            memoryState === "done" && "border-success/70 text-success",
            memoryState === "active" && "animate-throb-aqua border-primary text-primary",
            memoryState === "locked" && "cursor-not-allowed text-muted-foreground",
          )}
        >
          {/* Aligned with the Finality → Memory arrow, which enters this circle at its exact
              vertical centre — not just centred within whatever space is left under the Step 5
              pill. */}
          <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap">
            <Database className={cn("h-3.5 w-3.5 shrink-0", memoryState === "open" && "text-primary")} />
            <span className="text-[11px] font-medium leading-tight">Compounding CDA</span>
          </span>
          <span className="absolute left-1/2 top-[calc(50%+15px)] w-[75%] -translate-x-1/2 text-center text-[9px] leading-snug text-muted-foreground">
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
          viewOnly={panel.viewOnly}
        />
      )}
    </div>
  );
}
