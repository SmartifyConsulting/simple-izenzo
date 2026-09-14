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

// Fixed diagram coordinate system, proportioned for the workflow column beside the Live
// Workspace: everything is placed on this canvas and scaled to the container with percentages, so
// tiles and their connecting lines always stay aligned however wide that column is.
const W = 960;
const H = 1090;
const px = (v: number) => `${(v / W) * 100}%`;
const py = (v: number) => `${(v / H) * 100}%`;

type Box = { x: number; y: number; w: number; h: number };

/** Rows and columns are aligned so every connector is a straight horizontal or vertical run. */
const BOXES = {
  bid: { x: 40, y: 80, w: 160, h: 56 },
  loadDocs: { x: 40, y: 164, w: 160, h: 56 },
  // Search sits level with Load Deal Documents (same centre-line, for a straight connector), and
  // the Search Results card sits directly beneath Search — now a single compact line of results
  // rather than a tall stacked list, so Choice/Counter Offer/Online Media Screening can all sit
  // higher, letting the rest of the diagram move up to fit without scrolling.
  search: { x: 230, y: 161, w: 160, h: 62 },
  steps: { x: 230, y: 248, w: 160, h: 64 },
  // Offer/Choice/Counter Offer/Online Media Screening spread out further right, using the
  // frame's full width instead of clustering against Search's column.
  offer: { x: 460, y: 80, w: 160, h: 56 },
  // Choice sits level with the (now shorter) Search Results card, so that connector is a single
  // straight run; Counter Offer matches it so its loop back to Choice stays attached.
  choice: { x: 460, y: 252, w: 160, h: 56 },
  counterOffer: { x: 650, y: 248, w: 150, h: 64 },
  socialMedia: { x: 460, y: 323, w: 160, h: 64 },
  // Step 2 (Compliance & Governance) moves further down from Step 1's frame; Step 3/4 shift down
  // to match so the connector between them (unchanged below) doesn't have to stretch or overlap.
  expressIntent: { x: 60, y: 545, w: 240, h: 54 },
  poi: { x: 60, y: 623, w: 240, h: 54 },
  withoutADoubt: { x: 60, y: 701, w: 240, h: 62 },
  wad: { x: 60, y: 787, w: 240, h: 62 },
  businessDocs: { x: 60, y: 873, w: 240, h: 62 },
  // Step 3 (Execution) and Step 4 (Entry/Exit, Finality) now share one row instead of stacking,
  // flush with the bottom of the Compliance frame.
  execution: { x: 430, y: 945, w: 260, h: 104 },
  entryExit: { x: 705, y: 969, w: 90, h: 56 },
  finality: { x: 810, y: 945, w: 110, h: 104 },
} as const satisfies Record<string, Box>;

// One outer frame holds the whole trading step — Bid, Load Deal Documents, Search, the Search
// Results card and the counterparty tiles (Offer, Choice, Counter Offer, Online Media Screening),
// which no longer carry a frame of their own. Trimmed to its actual content height (rather than
// leaving a tall gap beneath it) so Compliance can sit right below without the diagram needing a
// scroll.
const TRADE_ENGINE_FRAME: Box = { x: 14, y: 46, w: 932, h: 365 };
const COMPLIANCE_FRAME: Box = { x: 30, y: 511, w: 288, h: 434 };
const MEMORY = { cx: 560, cy: 685, r: 127 };

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
  line(bottomOf(BOXES.search), topOf(BOXES.steps)),
  // Choice sits level with the Search Results card, so this is one straight run.
  line(rightOf(BOXES.steps), leftOf(BOXES.choice)),
  // Counterparty loop: Offer into Choice, Choice out to Counter Offer and back, then Social Media.
  line(bottomOf(BOXES.offer), topOf(BOXES.choice)),
  path({ x: BOXES.choice.x + BOXES.choice.w, y: cy(BOXES.choice) - 11 }, { x: BOXES.counterOffer.x, y: cy(BOXES.choice) - 11 }),
  path({ x: BOXES.counterOffer.x, y: cy(BOXES.choice) + 11 }, { x: BOXES.choice.x + BOXES.choice.w, y: cy(BOXES.choice) + 11 }),
  path(topOf(BOXES.counterOffer), { x: cx(BOXES.counterOffer), y: cy(BOXES.offer) }, rightOf(BOXES.offer)),
  line(bottomOf(BOXES.choice), topOf(BOXES.socialMedia)),
  // Out of trading and down into the compliance step.
  path(bottomOf(BOXES.socialMedia), { x: cx(BOXES.socialMedia), y: 466 }, { x: cx(BOXES.expressIntent), y: 466 }, topOf(BOXES.expressIntent)),
  line(bottomOf(BOXES.expressIntent), topOf(BOXES.poi)),
  line(bottomOf(BOXES.poi), topOf(BOXES.withoutADoubt)),
  line(bottomOf(BOXES.withoutADoubt), topOf(BOXES.wad)),
  line(bottomOf(BOXES.wad), topOf(BOXES.businessDocs)),
  // Step 2 into Step 3: off the right edge of the Compliance frame itself, level with Business
  // Docs, rather than out of the Business Docs tile directly.
  path(
    { x: COMPLIANCE_FRAME.x + COMPLIANCE_FRAME.w, y: cy(BOXES.businessDocs) },
    { x: cx(BOXES.execution), y: cy(BOXES.businessDocs) },
    topOf(BOXES.execution),
  ),
  // Execution, Entry/Exit and Finality now share one row.
  line(rightOf(BOXES.execution), leftOf(BOXES.entryExit)),
  line(rightOf(BOXES.entryExit), leftOf(BOXES.finality)),
  path(topOf(BOXES.finality), { x: cx(BOXES.finality), y: 900 }, { x: MEMORY.cx, y: 900 }, { x: MEMORY.cx, y: MEMORY.cy + MEMORY.r }),
];

const SEARCH_RESULT_CHIPS = ["Result 1", "Result 2", "Result 3", "Result 4", "Result 5"];

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

/** A group frame: a hairline rounded outline with its name set into the top edge — drawn from the
 * theme's own colours, so it reads the same way on cream as it does on black. */
function Frame({ box, label }: { box: Box; label?: string | undefined }) {
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
}: {
  box: Box;
  label: string;
  icon?: typeof Search | undefined;
  state: NodeState;
  onClick?: (() => void) | undefined;
  lock?: string | null | undefined;
  sub?: string | undefined;
  /** "gate" prints the sub-line in the warning colour, as with Without a Doubt. */
  subTone?: "muted" | "gate" | undefined;
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
        "absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border bg-card/40 px-2 text-center font-sans text-[11px] font-semibold leading-tight transition-colors",
        state === "open" && "border-border text-foreground hover:border-primary/60",
        state === "done" && "border-success/70 text-success",
        state === "active" && "animate-throb-aqua border-primary text-primary",
        locked && "cursor-not-allowed border-border/50 text-muted-foreground opacity-50",
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
            "w-full text-[8.5px] font-semibold uppercase leading-snug tracking-wide",
            subTone === "gate" ? "text-[#C1653D]" : "font-medium normal-case tracking-normal text-muted-foreground",
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
      subTone?: "muted" | "gate";
      overrideKey?: string;
      state?: NodeState;
      onClick?: () => void;
    },
  ) => (
    <MapNode
      box={BOXES[key]}
      label={label}
      icon={icon}
      {...(opts?.sub ? { sub: opts.sub } : {})}
      {...(opts?.subTone ? { subTone: opts.subTone } : {})}
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
        <Frame box={COMPLIANCE_FRAME} label="Step 2 · Compliance & Governance" />

        {/* What Search actually returns — a placeholder list of results/findings, not steps of
            the workflow, shown as a small card beneath Search. */}
        <div
          className="pointer-events-none absolute overflow-hidden rounded-xl border border-border bg-card/40 px-3 py-2"
          style={{
            left: px(BOXES.steps.x),
            top: py(BOXES.steps.y),
            width: px(BOXES.steps.w),
            height: py(BOXES.steps.h),
          }}
        >
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            Search Results
          </p>
          <p className="mt-1 text-[9px] font-medium leading-tight text-muted-foreground">
            {SEARCH_RESULT_CHIPS.join(", ")}
          </p>
        </div>

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
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-[slide-in-right_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
          </div>
        )}
        {node("offer", "Offer", "trading", "counterparties", Tag)}
        {node("choice", "Choice", "trading", "choice", Share2, { overrideKey: "choice" })}
        {node("counterOffer", "Counter Offer", "trading", "counterparties", RefreshCw)}
        {node("socialMedia", "Online Media Screening", "trading", "online-media", Users, {
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

        {/* Step 3 — execution */}
        <MapNode
          box={BOXES.execution}
          label="Step 3 · Execution"
          sub="Concept, Pre-Reqs, Feasibility, Bankability, Project Prep, Implementation"
          state={st("execution", "preparation")}
          lock={lock("execution", "preparation")}
          onClick={() => open("execution", "preparation")}
        />
        {node("entryExit", "Entry / Exit", "execution", "stakeholders", LogIn)}
        {node("finality", "Finality", "finality", "entry", Banknote, {
          sub: "Payment, Signoff, Handover",
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
            "absolute flex flex-col items-center justify-center gap-1 rounded-full border bg-card/40 px-5 text-center font-sans transition-colors",
            memoryState === "open" && "border-border text-foreground hover:border-primary/60",
            memoryState === "done" && "border-success/70 text-success",
            memoryState === "active" && "animate-throb-aqua border-primary text-primary",
            memoryState === "locked" && "cursor-not-allowed border-border/50 text-muted-foreground opacity-50",
          )}
        >
          <Database className={cn("h-4 w-4", memoryState === "open" && "text-primary")} />
          <span className="text-[11px] font-semibold leading-tight">Step 5 · Memory</span>
          <span className="text-[10px] font-medium leading-tight">Compounding CDA</span>
          <span className="text-[8.5px] leading-snug text-muted-foreground">
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
