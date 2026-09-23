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
  MousePointerClick,
  Search,
  ShieldCheck,
  Share2,
  Tag,
  Users,
} from "lucide-react";
import { InlineFrame } from "./DealCanvas";
import { ArtefactHint } from "./ArtefactHint";
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
// Grown (was 816) to fit Step 3 and Step 4's individual sub-step tiles, matching the vertical
// stepper's own item list instead of collapsing each step into a single combined tile — and
// again to make room for Step 5's bigger circle without crowding the row above it.
const H = 1050;
const px = (v: number) => `${(v / W) * 100}%`;
const py = (v: number) => `${(v / H) * 100}%`;

type Box = { x: number; y: number; w: number; h: number };

/** Rows and columns are aligned so every connector is a straight horizontal or vertical run. */
const BOXES = {
  // Raised (was 80) so Step 1's frame starts level with the Bid Registration frame in the Live
  // Workspace column beside it, instead of sitting lower with a bigger gap above it.
  // Moved down slightly so the arrow into Load Deal Documents matches the length of every other
  // down-arrow on the map (20 units — the same span as Online Screening into Express Intent).
  bid: { x: 40, y: 62, w: 160, h: 56 },
  loadDocs: { x: 40, y: 138, w: 160, h: 56 },
  // Load Deal Documents, Search, Search Results, Choice and Online Screening — five tiles across
  // the row on even gaps. Choice sits between Search Results and Online Screening: pick a
  // counterparty from what the search found, then screening runs on that pick.
  search: { x: 225, y: 135, w: 160, h: 62 },
  steps: { x: 410, y: 134, w: 140, h: 64 },
  choice: { x: 575, y: 138, w: 150, h: 56 },
  // After Seal Intent: The Offer and its Counter Offer / Challenge loop sit side by side.
  offer: { x: 45, y: 450, w: 170, h: 54 },
  counterOffer: { x: 235, y: 450, w: 120, h: 54 },
  // Last tile on the row.
  socialMedia: { x: 750, y: 136, w: 170, h: 56 },
  // Confirm Intent moves up into the row Online Screening used to occupy, now that row is free —
  // Step 1 ends one row earlier than it used to.
  expressIntent: { x: 510, y: 214, w: 280, h: 48 },
  // Step 2 (GRC)'s remaining checks, spaced out with the extra height the frame gained now that
  // Step 1 above it is shorter — 40-unit gaps instead of 20, so the column doesn't just end in a
  // block of empty space at the bottom of the taller frame.
  poi: { x: 60, y: 362, w: 280, h: 48 },
  // KYC/KYB/PEP/AML no longer gets its own tile (still runs, just not shown separately), so
  // Without a Doubt sits directly under Proof of Intent now.
  withoutADoubt: { x: 60, y: 544, w: 280, h: 54 },
  businessDocs: { x: 60, y: 638, w: 280, h: 54 },
  // Step 3 (Execution, with Entry/Exit beside it) and Step 4 (Finality) each get their own column,
  // one tile per row matching the vertical stepper's own item list instead of a single combined
  // tile — same row heights and gaps down both columns so they read as a matched pair.
  // Dropped 15 units further from the frame's top edge (was 10) so the floating pill heading has
  // clear air above the first tile instead of nearly touching it.
  concept: { x: 45, y: 780, w: 310, h: 36 },
  prefeasibility: { x: 45, y: 830, w: 310, h: 36 },
  feasibility: { x: 45, y: 880, w: 310, h: 36 },
  bankability: { x: 45, y: 930, w: 310, h: 36 },
  implementation: { x: 45, y: 980, w: 310, h: 36 },
  // Vertically centred in its own, shorter frame — no longer stretched to match the tall
  // Execution/Finality columns beside it, just tall enough for the tile itself, the same height
  // as Search Results' own tile.
  entryExit: { x: 424, y: 872, w: 112, h: 37 },
  payment: { x: 605, y: 780, w: 310, h: 36 },
  signoff: { x: 605, y: 880, w: 310, h: 36 },
  handover: { x: 605, y: 980, w: 310, h: 36 },

} as const satisfies Record<string, Box>;

// One outer frame holds the whole trading step — Bid, Load Deal Documents, Search, the Search
// Results card, the counterparty tiles (Offer, Choice, Counter Offer, Online Screening) and
// Express Intent — trimmed to its actual content height. Shorter than it used to be now that
// Online Screening sits in line with Search Results instead of on its own row.
const TRADE_ENGINE_FRAME: Box = { x: 14, y: 18, w: 932, h: 262 };
// Moved up to close the extra gap Step 1's shorter frame would otherwise leave, and made taller —
// the reclaimed height goes into wider gaps between its own tiles (Proof of Intent, the Offer,
// Without a Doubt, Business Docs) rather than empty space at the bottom of the frame.
const COMPLIANCE_FRAME: Box = { x: 30, y: 337, w: 340, h: 380 };
// Execution and Entry/Exit+Finality get the same bordered, labelled group frame as Steps 1 and 2.
// Tall enough to hold Execution's five sub-step tiles (and Finality's three) stacked one per row.
// Sits a little lower than Step 2's own bottom edge to leave room for Step 5's bigger circle
// beside it.
const EXECUTION_FRAME: Box = { x: 30, y: 755, w: 340, h: 270 };
const FINALITY_FRAME: Box = { x: 590, y: 755, w: 340, h: 270 };
// Shorter now — just tall enough for its own tile, the same height as Search Results, rather than
// stretched to match the Execution/Finality columns either side of it — centred in that same row.
const ENTRY_EXIT_FRAME: Box = { x: 408, y: 858, w: 144, h: 64 };
// Kept beside Step 2 (not stacked under it). Net +40% versus the original (65% bigger, then
// trimmed 15%) — this is where AI+ actually draws from and keeps learning, so it still earns the
// biggest shape on the map, just not quite so dominant.
const MEMORY = { cx: 570, cy: 555, r: 147 };



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
type Arrow = string;

// Step 1's own internal connectors, plus the one leaving it for Step 2 — all hidden together when
// the Trading frame is folded away.
const TRADING_ARROWS: Arrow[] = [
  // Trading step: Bid down into Load Deal Documents, straight across into Search (same centre-
  // line), down into the step chips, then across into Choice.
  line(bottomOf(BOXES.bid), topOf(BOXES.loadDocs)),
  line(rightOf(BOXES.loadDocs), leftOf(BOXES.search)),
  // Search Results now sits in line between Search and Choice, all on Search's row — Online
  // Screening joins the same row now too, as the last tile in it. Choice sits between Search
  // Results and Online Screening: pick a counterparty from what the search found, then screening
  // runs on that pick.
  line(rightOf(BOXES.search), leftOf(BOXES.steps)),
  line(rightOf(BOXES.steps), leftOf(BOXES.choice)),
  line(rightOf(BOXES.choice), leftOf(BOXES.socialMedia)),
  // Down out of Online Screening, then left to Confirm Intent's centre-line, into the row it moved
  // up into (the one Online Screening vacated).
  path(
    bottomOf(BOXES.socialMedia),
    { x: cx(BOXES.socialMedia), y: BOXES.socialMedia.y + BOXES.socialMedia.h + 10 },
    { x: cx(BOXES.expressIntent), y: BOXES.socialMedia.y + BOXES.socialMedia.h + 10 },
    topOf(BOXES.expressIntent),
  ),
  // Out of Step 1 and into Step 2's checks: down, then left to Proof of Intent's centre-line,
  // stopping just short of the GRC frame's edge (matching the Step 2 → Step 3 connector below).
  path(
    bottomOf(BOXES.expressIntent),
    { x: cx(BOXES.expressIntent), y: (TRADE_ENGINE_FRAME.y + TRADE_ENGINE_FRAME.h + COMPLIANCE_FRAME.y) / 2 },
    { x: cx(BOXES.poi), y: (TRADE_ENGINE_FRAME.y + TRADE_ENGINE_FRAME.h + COMPLIANCE_FRAME.y) / 2 },
    { x: cx(BOXES.poi), y: COMPLIANCE_FRAME.y - ARROW_GAP },
  ),
];

const REST_ARROWS: Arrow[] = [
  // The KYC/KYB/PEP/AML tile itself is no longer shown separately (it still runs, and still
  // drives its own pulse state — just folded into Without a Doubt visually), so this arrow now
  // runs straight from Proof of Intent to Without a Doubt instead of stopping at it first.
  // Seal Intent → The Offer, the Offer ⇄ Counter Offer/Challenge loop, then agreement → WAD.
  path(bottomOf(BOXES.poi), { x: cx(BOXES.poi), y: BOXES.poi.y + BOXES.poi.h + 10 }, { x: cx(BOXES.offer), y: BOXES.poi.y + BOXES.poi.h + 10 }, topOf(BOXES.offer)),
  line({ x: BOXES.offer.x + BOXES.offer.w, y: cy(BOXES.offer) - 9 }, { x: BOXES.counterOffer.x, y: cy(BOXES.offer) - 9 }),
  line({ x: BOXES.counterOffer.x, y: cy(BOXES.offer) + 9 }, { x: BOXES.offer.x + BOXES.offer.w, y: cy(BOXES.offer) + 9 }),
  path(bottomOf(BOXES.offer), { x: cx(BOXES.offer), y: BOXES.offer.y + BOXES.offer.h + 10 }, { x: cx(BOXES.withoutADoubt), y: BOXES.offer.y + BOXES.offer.h + 10 }, topOf(BOXES.withoutADoubt)),
  line(bottomOf(BOXES.withoutADoubt), topOf(BOXES.businessDocs)),
  // Step 2 into Step 3: straight down out of Business Docs, stopping just short of the Step 3
  // frame's edge — pointing at it (and the heading floating on it) rather than touching it.
  line(bottomOf(BOXES.businessDocs), { x: cx(BOXES.businessDocs), y: EXECUTION_FRAME.y - ARROW_GAP }),
  // Execution's own sub-steps, top to bottom — Project Preparation's three (Concept,
  // Pre-feasibility, Feasibility) into Bankability, then across into Execution's own
  // Implementation, matching the vertical stepper's item order exactly.
  line(bottomOf(BOXES.concept), topOf(BOXES.prefeasibility)),
  line(bottomOf(BOXES.prefeasibility), topOf(BOXES.feasibility)),
  line(bottomOf(BOXES.feasibility), topOf(BOXES.bankability)),
  line(bottomOf(BOXES.bankability), topOf(BOXES.implementation)),
  // Finality's own sub-steps, top to bottom.
  line(bottomOf(BOXES.payment), topOf(BOXES.signoff)),
  line(bottomOf(BOXES.signoff), topOf(BOXES.handover)),
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
    { x: cx(FINALITY_FRAME), y: FINALITY_FRAME.y - ARROW_GAP },
    { x: cx(FINALITY_FRAME), y: MEMORY.cy },
    { x: MEMORY.cx + MEMORY.r + ARROW_GAP, y: MEMORY.cy },
  ),
];

function ArrowLayer() {
  const shown = [...TRADING_ARROWS, ...REST_ARROWS];
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
      {shown.map((d, i) => (
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
 * "Step 5 · Memory" as a straight pill inside the Memory circle, near its top — not on the curve,
 * so its text is a plain, always-horizontal heading like every other step label, in the same
 * light-grey/black-text style as the Step 1/2 frame pills.
 */
function MemoryArcLabel() {
  return (
    <div
      className="pointer-events-none absolute z-10 flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full bg-[var(--step-pill-bg)] px-2.5 py-0.5 text-center font-sans text-[11px] font-semibold uppercase leading-none tracking-[0.09em] text-[var(--step-pill-fg)]"
      style={{ left: px(MEMORY.cx), top: py(MEMORY.cy - MEMORY.r * 0.42) }}
      aria-hidden
    >
      Step 5 · Memory
    </div>
  );
}


/** A group frame: a hairline rounded outline with its name set into the top edge — drawn from the
 * theme's own colours, so it reads the same way on cream as it does on black. Passing `onToggle`
 * turns the floating label into a collapse toggle for everything inside the frame. */
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
  step,
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
  /** The spine step this tile represents — drives the hoverable artefact icon, when this step
   * actually produces one. */
  step?: string | undefined;
}) {
  const locked = state === "locked";
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      // A native `disabled` button blocks pointer/hover events on everything inside it — including
      // the artefact-hint tooltip below, so hovering it while the step is locked showed the
      // browser's not-allowed cursor and the tooltip could never open. `aria-disabled` keeps the
      // same locked appearance and still no-ops the click (onClick is already undefined when
      // locked), without swallowing hover events from its children.
      aria-disabled={locked || !onClick}
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
        // animate-throb-aqua always draws its own 2px border, which read as a sharp-cornered box
        // on a "plain" tile (border-0/rounded-none otherwise) — rounded-xl keeps its pulse the
        // same shape as every other node's, instead of the only rectangular one on the map.
        state === "active" && (plain ? "animate-throb-aqua rounded-xl text-primary" : "animate-throb-aqua border-primary text-primary"),
        locked && "cursor-not-allowed text-muted-foreground",
      )}
    >
      <span className="flex w-full items-center justify-center gap-1.5">
        {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", state === "open" && "text-primary")} />}
        <span className="whitespace-normal break-words leading-tight">{label}</span>
        {state === "done" && <CheckCircle2 className="h-3 w-3 shrink-0 text-success" />}
        {step && <ArtefactHint step={step} />}
      </span>
      {sub && (
        <span
          className={cn(
            "w-full text-center font-semibold uppercase leading-snug tracking-wide",
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
      /** Suppresses the hoverable document-artefact icon — for a tile that shares its gating step
       * with another tile that already shows it (The Offer and Counter Offer both gate on "wad",
       * but the KYC/KYB/AML/PEP artefacts it lists belong to the Without a Doubt tile itself). */
      noArtefact?: boolean;
    },
  ) => (
    <MapNode
      box={BOXES[key]}
      label={label}
      icon={icon}
      step={opts?.noArtefact ? undefined : step}
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
  // Memory is fed continuously from the moment the counterparty choice has been made until Step 4
  // (Finality) is complete — a clockwise sweep round its rim shows that it is constantly updating
  // while the process is underway.
  const memoryUpdating =
    Boolean(tx) &&
    tx!.stage !== "memory" &&
    !tx!.finality_sealed_at &&
    stepIndex(tx!.stage, tx!.step) > stepIndex("trading", "choice");

  return (
    <div className="relative h-full w-full">
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <ArrowLayer />
        <MemoryArcLabel />


        <Frame box={TRADE_ENGINE_FRAME} label="Step 1 · Trading" />
        <Frame box={COMPLIANCE_FRAME} label="Step 2 · GRC" />
        <Frame box={EXECUTION_FRAME} label="Step 3 · Execution" />
        <Frame box={ENTRY_EXIT_FRAME} />
        <Frame box={FINALITY_FRAME} label="Step 4 · Finality" />

        {/* Mirrors Search's own state (same overrideKey) — both pulse together while the search is
            running, and once it's done the pulse moves straight on to Choice. */}
        {node("steps", "Search Results", "trading", "search", ListChecks, { overrideKey: "search" })}
        {node("choice", "Choice", "trading", "choice", MousePointerClick)}

        {/* Step 1 — trading. Bid and Load Deal Documents drive the workspace beside the map. */}

        {node("bid", "Register Bid/Offer", "trading", "bid-offer", Gavel, {
          overrideKey: "bidRegistration",
          ...(onBid ? { onClick: onBid } : {}),
        })}
        {node("loadDocs", "Upload Files", "trading", "documents", FileText, {
          overrideKey: "docSubmission",
          ...(onLoadDocuments ? { onClick: onLoadDocuments } : {}),
        })}
        {node("search", "Search", "trading", "search", Search, {
          overrideKey: "search",
          sub: "AI and AI+ Match",
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
        {node("socialMedia", "Online Screening", "trading", "online-media", Users, {
          overrideKey: "onlineMedia",
        })}

        {/* Confirm Intent closes out Step 1's own frame. */}
        {node("expressIntent", "Confirm Intent", "trading", "intent", ShieldCheck, {
          overrideKey: "intent",
        })}

        {/* Step 2 — compliance & governance */}
        {node("poi", "Seal Intent", "trading", "poi", Building2, { overrideKey: "poi" })}

        {/* After Seal Intent the Responder reviews The Offer: Approve, Reject or Challenge — the
            Counter Offer loop can go back and forth until agreement, which opens Without a Doubt. */}
        {node("offer", "The Offer", "compliance", "wad", Tag, { noArtefact: true })}
        {node("counterOffer", "Counter Offer", "compliance", "wad", undefined, {
          state: overrideStates?.["counterOffer"] ?? (lock("compliance", "wad") ? "locked" : "open"),
          noArtefact: true,
        })}
        {node("withoutADoubt", "Without a Doubt", "compliance", "wad", ShieldCheck, {
          overrideKey: "wad",
          sub: "KYC & KYB on each other",
          subTone: "gate",
        })}
        {node("businessDocs", "Business Docs", "execution", "business-docs", FolderClosed, {
          sub: "Digital sign-off by both parties",
          overrideKey: "businessDocs",
        })}

        {/* Step 3 — execution. The frame heading stays "Step 3 · Execution"; each tile below it is
            one item from the vertical stepper's own Execution list, in the same order: Project
            Preparation's three sub-steps, then Bankability, then Implementation. */}
        {node("concept", "Concept", "execution", "preparation")}
        {node("prefeasibility", "Pre-feasibility", "execution", "preparation")}
        {node("feasibility", "Feasibility", "execution", "preparation")}
        {node("bankability", "Bankability", "execution", "bankability")}
        {node("implementation", "Implementation", "execution", "implementation")}
        {/* Entry/Exit sits between the Step 3 and Step 4 frames, on its own. */}
        {node("entryExit", "Entry / Exit", "execution", "stakeholders", LogIn, { plain: true })}
        {/* Step 4 — finality. "Finality" is the frame heading; each tile below it is one item from
            the vertical stepper's own Finality list, in the same order. */}
        {node("payment", "Payment", "finality", "type")}
        {node("signoff", "Signoff", "finality", "validation")}
        {node("handover", "Handover", "finality", "record")}

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
            // This is where AI+ actually draws from and keeps learning — a gold fill with a
            // steady black outline sets it apart from every other tile on the map, rather than
            // reading as just another step.
            "absolute rounded-full border-2 border-black bg-amber-400/35 px-5 text-center font-sans transition-colors",
            memoryState === "open" && "text-foreground hover:bg-amber-400/50",
            memoryState === "done" && "text-success",
            memoryState === "active" && "animate-throb-aqua text-primary",
            memoryState === "locked" && "cursor-not-allowed text-muted-foreground",
          )}
        >
          {/* Aligned with the Finality → Memory arrow, which enters this circle at its exact
              vertical centre — not just centred within whatever space is left under the Step 5
              pill. */}
          {memoryUpdating && (
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              className="pointer-events-none absolute -inset-[7px] h-[calc(100%+14px)] w-[calc(100%+14px)] animate-spin [animation-duration:3s]"
            >
              <circle
                cx="50"
                cy="50"
                r="48.5"
                fill="none"
                stroke="rgb(245 158 11)"
                strokeWidth="2.2"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray="28 72"
              />
              <circle
                cx="50"
                cy="50"
                r="48.5"
                fill="none"
                stroke="rgb(245 158 11)"
                strokeOpacity="0.35"
                strokeWidth="1"
                pathLength="100"
                strokeDasharray="2 6"
              />
            </svg>
          )}
          <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap">
            <Database className={cn("h-3.5 w-3.5 shrink-0", memoryState === "open" && "text-primary")} />
            <span className="text-[11px] font-medium leading-tight">Compounding CDA</span>
          </span>
          <span className="absolute left-1/2 top-[calc(50%+15px)] w-[75%] -translate-x-1/2 text-center text-[9px] leading-snug text-muted-foreground">
            Capital Deployment Assessment
          </span>
          {/* Explains the sweeping ring above: memory is being fed for as long as the deal is between
              the counterparty choice and Finality. */}
          {memoryUpdating && (
            <span
              role="status"
              className="absolute left-1/2 top-[calc(50%+42px)] flex -translate-x-1/2 items-baseline whitespace-nowrap text-[9px] italic leading-snug text-amber-700"
            >
              Updating memory
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  aria-hidden
                  className="animate-ellipsis-dot"
                  style={{ animationDelay: `${i * 0.18}s` }}
                >
                  .
                </span>
              ))}
            </span>
          )}
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
