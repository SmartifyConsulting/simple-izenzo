import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
  Users,
} from "lucide-react";
import { InlineFrame } from "./DealCanvas";
import { lockReason, stepIndex, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fallbackReference } from "@/lib/tx";
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
const H = 760;
const pctX = (v: number) => `${(v / W) * 100}%`;
const pctY = (v: number) => `${(v / H) * 100}%`;

const ROW = 42; // shared node height
const PITCH = 72; // vertical distance from one row's top to the next
const CENTER_W = 310; // shared width for the center-column nodes, matched to Choice
const SIDE_W = 220;
const TOP_Y = 20;
// Extra vertical room between the Step 1 and Step 2 frames — without it the two frames' borders
// (and Step 2's "Step 2 · Compliance & Governance" label, which sits above its own frame) overlap.
const STEP2_GAP_EXTRA = 34;
// A little breathing room before the three parallel branches split off from KYC/KYB.
const BRANCH_Y = TOP_Y + PITCH * 6 + 58 + STEP2_GAP_EXTRA;

const GROUP_PAD = 18;
// Used where two frames sit close together (Step 1 above Step 2), so their borders don't overlap.
const GROUP_PAD_TIGHT = 10;
// A touch more height on the Step 1 frame so its bottom border stays clear of the Step 2 label.
const STEP1_EXTRA_H = 10;
// Gap between the Step 2 frame's top border and the Proof of Intent box it contains, so the
// "Step 2 · Compliance & Governance" label (which sits above that border) doesn't crowd it.
const STEP2_TOP_PAD = GROUP_PAD_TIGHT + 12;


// Steps 3, 4 and 5 are laid out as three frames with identical gaps between them (and the same
// gap to each canvas edge), so the bottom band reads as evenly spaced columns.
const S3_W = 556;
const S4_W = 250;
const S5_W = 220;
const COL_GAP = (W - (S3_W + S4_W + S5_W)) / 4;
const S3_X = COL_GAP;
const S4_X = S3_X + S3_W + COL_GAP;
const S5_X = S4_X + S4_W + COL_GAP;

// Inner content bounds of each bottom frame.
const S3_L = S3_X + GROUP_PAD;
const S3_R = S3_X + S3_W - GROUP_PAD;
const S4_L = S4_X + GROUP_PAD;
const S5_L = S5_X + GROUP_PAD;

const PREP_W = 300;
const SUB_W = 145;
const EXEC_W = 190;
const FIN_W = S4_W - GROUP_PAD * 2;
const MEM_W = S5_W - GROUP_PAD * 2;

type Box = { x: number; y: number; w: number; h: number };
const BOXES = {
  bid: { x: 60, y: TOP_Y, w: SIDE_W, h: ROW },
  // Left-aligned with the Memory box in Step 5, now that Step 1's frame extends that far right.
  offer: { x: S5_L, y: TOP_Y, w: SIDE_W, h: ROW },

  loadDocs: { x: 60, y: TOP_Y + PITCH, w: SIDE_W, h: ROW },
  search: { x: 470, y: TOP_Y + PITCH, w: CENTER_W, h: ROW },
  counterparty: { x: S5_L, y: TOP_Y + PITCH, w: SIDE_W, h: ROW },

  surfaceRoutes: { x: S5_L, y: TOP_Y + PITCH * 2, w: SIDE_W, h: ROW },
  choice: { x: 470, y: TOP_Y + PITCH * 2, w: CENTER_W, h: ROW },

  poi: { x: 470, y: TOP_Y + PITCH * 3 + STEP2_GAP_EXTRA, w: CENTER_W, h: ROW },
  wad: { x: 470, y: TOP_Y + PITCH * 4 + STEP2_GAP_EXTRA, w: CENTER_W, h: ROW },
  kyc: { x: 470, y: TOP_Y + PITCH * 5 + STEP2_GAP_EXTRA, w: CENTER_W, h: ROW },

  projectPrep: { x: S3_L, y: BRANCH_Y, w: PREP_W, h: ROW },
  execution: { x: S3_R - EXEC_W, y: BRANCH_Y, w: EXEC_W, h: ROW },
  finality: { x: S4_L, y: BRANCH_Y, w: FIN_W, h: ROW },

  // Sub-nodes align with the nearest edge of their parent: Concept/Feasibility flush with Project
  // Preparation's left edge, Pre-feasibility/Bankability flush with its right edge.
  concept: { x: S3_L, y: BRANCH_Y + PITCH, w: SUB_W, h: ROW },
  prefeasibility: { x: S3_L + PREP_W - SUB_W, y: BRANCH_Y + PITCH, w: SUB_W, h: ROW },
  implementation: { x: S3_R - EXEC_W, y: BRANCH_Y + PITCH, w: EXEC_W, h: ROW },
  payment: { x: S4_L, y: BRANCH_Y + PITCH, w: FIN_W, h: ROW },

  feasibility: { x: S3_L, y: BRANCH_Y + PITCH * 2, w: SUB_W, h: ROW },
  bankability: { x: S3_L + PREP_W - SUB_W, y: BRANCH_Y + PITCH * 2, w: SUB_W, h: ROW },
  completion: { x: S4_L, y: BRANCH_Y + PITCH * 2, w: FIN_W, h: ROW },

  // Memory matches Completion's size and sits on the same line, so the arrow between them is a
  // straight horizontal run.
  memory: { x: S5_L, y: BRANCH_Y + PITCH * 2, w: MEM_W, h: ROW },

} as const satisfies Record<string, Box>;

// Connector points sit exactly on each box's border, so a line leaves touching the box it comes
// from and its arrowhead tip lands on the border of the box it points at.
const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;
const top = (b: Box) => ({ x: cx(b), y: b.y });
const bottom = (b: Box) => ({ x: cx(b), y: b.y + b.h });
const left = (b: Box) => ({ x: b.x, y: cy(b) });
const right = (b: Box) => ({ x: b.x + b.w, y: cy(b) });

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
  { d: elbow(bottom(BOXES.bid), top(BOXES.loadDocs), "x") },
  { d: elbow(bottom(BOXES.offer), top(BOXES.counterparty), "x") },
  { d: elbow(right(BOXES.loadDocs), left(BOXES.search), "y") },
  { d: elbow(left(BOXES.counterparty), right(BOXES.search), "y") },
  { d: elbow(bottom(BOXES.counterparty), top(BOXES.surfaceRoutes), "x") },
  { d: elbow(bottom(BOXES.search), top(BOXES.choice), "x") },
  { d: elbow(bottom(BOXES.loadDocs), left(BOXES.choice), "y") },
  { d: elbow(left(BOXES.surfaceRoutes), right(BOXES.choice), "y") },
  { d: elbow(bottom(BOXES.choice), top(BOXES.poi), "x") },
  { d: elbow(bottom(BOXES.poi), top(BOXES.wad), "x") },
  { d: elbow(bottom(BOXES.wad), top(BOXES.kyc), "x") },
  ...branchDown(
    bottom(BOXES.kyc),
    [top(BOXES.projectPrep), top(BOXES.execution), top(BOXES.finality)],
    44,
  ).map((d) => ({ d })),

  { d: elbow(bottom(BOXES.execution), top(BOXES.implementation), "x") },
  { d: elbow(bottom(BOXES.finality), top(BOXES.payment), "x") },
  { d: elbow(bottom(BOXES.payment), top(BOXES.completion), "x") },
  { d: elbow(right(BOXES.completion), left(BOXES.memory), "y") },
  ...branchDown(
    bottom(BOXES.projectPrep),
    [top(BOXES.concept), top(BOXES.prefeasibility)],
    14,
  ).map((d) => ({ d })),

  { d: elbow(bottom(BOXES.concept), top(BOXES.feasibility), "x") },
  { d: elbow(bottom(BOXES.prefeasibility), top(BOXES.bankability), "x") },
];


// Frames the diagram into the same 5 stages as the Journey banner above it — Step 1 (Trading,
// everything through Choice), Step 2 (Compliance & Governance: POI, WaD, KYC/KYB), Step 3
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
      // Register Offer/Counterparty/Online Media Screening are left-aligned with Memory (Step 5),
      // so the frame's right edge follows from their own position rather than a separate constant.
      w: BOXES.offer.x + BOXES.offer.w - BOXES.bid.x + GROUP_PAD * 2,
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
      h: BOXES.kyc.y + ROW - BOXES.poi.y + STEP2_TOP_PAD + GROUP_PAD,
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
      x: S4_X,
      y: BOXES.finality.y - GROUP_PAD,
      w: S4_W,
      h: BOXES.completion.y + ROW - BOXES.finality.y + GROUP_PAD * 2,
    },
  },
  {
    label: "Memory",
    step: 5,
    box: {
      x: S5_X,
      y: BOXES.memory.y - GROUP_PAD,
      w: S5_W,
      h: BOXES.memory.h + GROUP_PAD * 2,
    },
  },
];


// Same x and width as the shared center column (Search · AI + AI+, Choice, Proof of Intent, …),
// so it lines up with that column and reads as part of the same diagram, not a stray element.
const SEARCH_BOX: Box = { x: BOXES.search.x, y: TOP_Y, w: CENTER_W, h: ROW };

type DealSuggestion = {
  id: string;
  reference: string;
  title: string;
  direction: "bid" | "offer";
};

/** A search bar for jumping straight to an existing bid/offer by name, sitting right between the
 * two "Register" boxes it's an alternative to. Shows the most recently active deals by default,
 * narrows to whatever's typed, and opens the picked one in the Live Deal Engine. */
function BidOfferSearch() {
  const { org } = useAuth();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const { data: deals = [] } = useQuery({
    queryKey: ["my-trades", org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, bid_offers(direction, created_at)")
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (
        (data ?? []) as unknown as (Transaction & {
          bid_offers: { direction: string; created_at: string }[];
        })[]
      ).map((t): DealSuggestion => {
        const earliest = [...t.bid_offers].sort(
          (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
        )[0];
        const direction: "bid" | "offer" = earliest?.direction === "offer" ? "offer" : "bid";
        return { id: t.id, reference: t.reference ?? fallbackReference(t.id, direction), title: t.title, direction };
      });
    },
    staleTime: 30_000,
  });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? deals.filter((d) => d.title.toLowerCase().includes(q) || d.reference.toLowerCase().includes(q))
      : deals;
    return list.slice(0, 8);
  }, [deals, query]);

  return (
    <div
      className="absolute"
      style={{ left: pctX(SEARCH_BOX.x), top: pctY(SEARCH_BOX.y), width: pctX(SEARCH_BOX.w), height: pctY(SEARCH_BOX.h) }}
    >
      <div className="relative h-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search a bid or offer…"
          className="h-full w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:border-primary/50"
        />
        {focused && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            {results.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-slate-400">
                {query.trim() ? "No matching bids or offers." : "Nothing recorded yet."}
              </p>
            ) : (
              <>
                {!query.trim() && (
                  <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Recently active
                  </p>
                )}
                {results.map((d) => (
                  <Link
                    key={d.id}
                    to="/live-deal-engine"
                    search={{ tx: d.id }}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-100"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium",
                        d.direction === "bid" ? "bg-primary/12 text-primary" : "bg-slate-200 text-slate-700",
                      )}
                    >
                      {d.reference}
                    </span>
                    <span className="min-w-0 truncate text-[13px] text-slate-800">{d.title}</span>
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
        emphasis ? "border-[oklch(0.88_0.05_178)]/55" : "border-[oklch(0.88_0.05_178)]/40",
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
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ left: pctX(box.x), top: pctY(box.y), width: pctX(box.w), height: pctY(box.h) }}
      className={cn(
        "absolute flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 text-center text-[11px] font-semibold leading-tight tracking-tight transition-colors sm:text-xs",
        tone === "header" && state !== "done" && "bg-slate-700/40 text-foreground border-border hover:border-primary/40",
        tone === "header" && state === "done" && "border-primary/50 bg-primary/12 text-primary",
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
            "border-white/35 bg-muted/20 text-foreground hover:border-white/60",
            state === "locked" && "cursor-not-allowed text-muted-foreground/70",
          ),
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
            subClassName ?? (tone === "danger" ? "text-[#F97316]" : "text-current opacity-80"),
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
          label="Register Bid"
          tone="header"
          state={readOnly ? "open" : st("trading", "bid-offer")}
          // Always starts a fresh bid, even when a deal is already loaded on this canvas — it's a
          // new registration, not a way back into whatever's currently open.
          onClick={() => onRegister?.("bid")}
        />
        <BidOfferSearch />
        <MjNode
          box={BOXES.offer}
          label="Register Offer"
          tone="header"
          state={readOnly ? "open" : st("trading", "bid-offer")}
          onClick={() => onRegister?.("offer")}
        />

        <MjNode
          box={BOXES.loadDocs}
          label="Load deal docs"
          icon={FileText}
          tone="light"
          state={st("trading", "documents")}
          onClick={() => open("trading", "documents")}
        />
        <MjNode
          box={BOXES.search}
          label="Search AI + AI+"
          icon={Search}
          tone="light"
          state={st("trading", "search")}
          onClick={() => open("trading", "search")}
        />
        <MjNode
          box={BOXES.counterparty}
          label="Counterparty"
          icon={Users}
          tone="light"
          state={st("trading", "counterparties")}
          onClick={() => open("trading", "counterparties")}
        />
        <MjNode
          box={BOXES.surfaceRoutes}
          label="Online Media Screening"
          sub="Surface Routes/Paths"
          icon={Globe}
          tone="light"
          state={st("trading", "online-media")}
          onClick={() => open("trading", "online-media")}
        />

        <MjNode
          box={BOXES.choice}
          label="Choice"
          labelClassName="text-info"
          icon={ListChecks}
          tone="light"
          state={st("trading", "choice")}
          onClick={() => open("trading", "choice")}
        />
        <MjNode
          box={BOXES.poi}
          label="Proof of Intent"
          icon={FileText}
          tone="light"
          state={st("trading", "poi")}
          onClick={() => open("trading", "poi")}
        />
        <MjNode
          box={BOXES.wad}
          label="Without a Doubt"
          sub="Hard gate · non-waivable"
          subClassName="text-[#C1653D]"
          icon={ShieldCheck}
          tone="light"
          state={st("compliance", "wad")}
          onClick={() => open("compliance", "wad")}
        />
        <MjNode
          box={BOXES.kyc}
          label="KYC / KYB"
          icon={Users}
          tone="light"
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
