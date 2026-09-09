import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileUp,
  Radar,
  Users,
  MousePointerClick,
  Handshake,
  ShieldCheck,
  Hammer,
  Landmark,
  BookLock,
  ArrowLeftRight,
  Newspaper,
  Loader2,
  X,
} from "lucide-react";
import { CanvasNode, Connector, GateBar, type NodeState } from "./CanvasNode";
import { StepScreen } from "@/components/steps/StepScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommoditySearch } from "@/components/CommoditySearch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ensureOrg } from "@/lib/org";
import { lockReason, stepDef, stepIndex, type StageKey } from "@/lib/spine";
import { advance, money, recordEvent, when, type Transaction, type TxEvent } from "@/lib/tx";
import { setCounterpartyShortlist } from "@/lib/izenzo.functions";
import { CURRENCIES } from "@/lib/currencies";
import { UNITS } from "@/lib/units";
import { cn } from "@/lib/utils";

type NodeRef = { stage: StageKey; step: string; label?: string; icon?: typeof Radar };

// Reduce the Bid/Offer (and Documents) lanes by two grid squares (the ink-grid repeats every
// 44px) while keeping their outer edges flush with the canvas — the lane shrinks from its inner
// edge only.
const LANE_INSET = 88;

/** A non-real transaction used purely to render the full pipeline (Trading → Compliance →
 * Execution → Finality → Memory) fully ticked, so landing on the canvas with no deal yet still
 * shows the whole flowchart at a glance rather than just the "start here" button. Never inserted,
 * never saved — passed straight into DealCanvas in read-only preview mode. */
export const FLOWCHART_PREVIEW_TX: Transaction = {
  id: "preview",
  org_id: "preview",
  counterparty_org_id: null,
  title: "Izenzo Deal Engine",
  commodity: "Copper cathode",
  quantity: 100,
  unit: "Metric tonnes",
  price: 9500,
  currency: "USD",
  incoterms: "CIF Rotterdam",
  jurisdiction: "South Africa",
  stage: "memory",
  step: "ledger",
  status: "open",
  intent_confirmed_at: new Date(0).toISOString(),
  poi_sealed_at: new Date(0).toISOString(),
  poi_hash: "preview",
  // Left uncleared on purpose — with everything else cleared, this is the one place the preview
  // demonstrates the "<gate> to be cleared" wording rather than only ever showing "cleared".
  wad_completed_at: null,
  finality_sealed_at: new Date(0).toISOString(),
  created_at: new Date(0).toISOString(),
};

function useNodeState(tx: Transaction) {
  const currentIdx = stepIndex(tx.stage, tx.step);
  return (stage: StageKey, step: string): NodeState => {
    if (lockReason(stage, step, tx)) return "locked";
    const idx = stepIndex(stage, step);
    if (idx < currentIdx) return "done";
    if (idx === currentIdx) return "active";
    return "open";
  };
}

export function DealCanvas({
  tx,
  reload,
  deals,
  onSelectDeal,
  readOnly,
  hideBidOfferGroups,
  focusSide,
  onBackToWorkflow,
}: {
  tx: Transaction;
  reload: () => void;
  deals?: Transaction[];
  onSelectDeal?: (id: string) => void;
  /** Shows a control that returns to the empty-state "Open a bid or an offer" workflow preview
   * screen, leaving this deal selected but out of view. Omitted on the read-only preview itself. */
  onBackToWorkflow?: () => void;
  /** Renders the pipeline for display only — no node opens, nothing mutates. Used for the
   * flowchart preview shown before any real deal exists. */
  readOnly?: boolean;
  /** Hides the "{ Bid" / "{ Offer" groups — used on the read-only preview once the real
   * CanvasStart picker is active elsewhere on the page, so they don't look duplicated. */
  hideBidOfferGroups?: boolean;
  /** Once a side is picked elsewhere on the page, the preview drops all mention of the other
   * side — no Responder lane, no "Next steps" for Responder — since this deal is now Bidder-only
   * (or Responder-only). */
  focusSide?: "bid" | "offer" | null;
}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string } | null>(null);
  const [direction, setDirection] = useState<"bid" | "offer" | null>(null);
  const stateOf = useNodeState(tx);

  // Which side placed the bid vs offer — read from the record itself (not just local `direction`
  // state, which resets on reload) so the results panel mirrors correctly at every step.
  const { data: recordedDirection } = useQuery({
    queryKey: ["bid-direction", tx.id],
    enabled: !readOnly,
    queryFn: async () => {
      const { data } = await supabase
        .from("bid_offers")
        .select("direction")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.direction as "bid" | "offer" | undefined) ?? null;
    },
  });
  const bidDirection = direction ?? recordedDirection ?? "bid";

  const node = (
    n: NodeRef,
    opts?: { side?: "left" | "right" | "center"; note?: string; compact?: boolean; delay?: number },
  ) => {
    const def = stepDef(n.stage, n.step);
    const isOpen = panel?.stage === n.stage && panel?.step === n.step;
    return (
      <div>
        <CanvasNode
          label={n.label ?? def?.label ?? n.step}
          blurb={opts?.compact ? undefined : def?.blurb}
          state={stateOf(n.stage, n.step)}
          icon={n.icon}
          side={opts?.side}
          note={opts?.note}
          compact={opts?.compact}
          delay={opts?.delay}
          onClick={readOnly ? undefined : () => setPanel(isOpen ? null : { stage: n.stage, step: n.step })}
        />
        {isOpen && !readOnly && (
          <InlineFrame tx={tx} stage={n.stage} step={n.step} reload={reload} onClose={() => setPanel(null)} />
        )}
      </div>
    );
  };

  const poi = Boolean(tx.poi_sealed_at);
  const wad = Boolean(tx.wad_completed_at);
  const matchingPhase =
    tx.stage === "trading" && ["search", "ai", "ai-plus"].includes(tx.step);
  const pickingDirection = tx.stage === "trading" && tx.step === "bid-offer";

  // Progressive reveal: only the current step and everything already completed are shown — the
  // canvas builds itself up one frame at a time instead of exposing the whole flowchart at once.
  // While AI/AI+ matching runs, cap reveal at "documents" so those three steps collapse into a
  // single ribbon rather than three individual frames.
  const currentIdx = stepIndex(tx.stage, tx.step);
  const revealUpTo = matchingPhase ? stepIndex("trading", "documents") : currentIdx;
  const visible = (stage: StageKey, step: string) => stepIndex(stage, step) <= revealUpTo;

  const executionItems = ["entry", "preparation", "bankability", "implementation", "stakeholders"].filter(
    (s) => visible("execution", s),
  );
  const finalityItems = ["entry", "type", "evidence", "change", "validation", "record"].filter((s) =>
    visible("finality", s),
  );

  // Once the canvas is focused on one side, the remaining pipeline steps sit under that side's
  // lane at half the usual width instead of spanning the full centered column.
  const stepsBoxClass = cn(
    focusSide ? "max-w-[24rem]" : "mx-auto max-w-3xl",
    focusSide === "bid" && "mr-auto",
    focusSide === "offer" && "ml-auto",
  );

  return (
    <div className={cn("relative rounded-3xl p-3 sm:p-5", focusSide ? "" : "ink-grid border border-border")}>
      {!readOnly && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {onBackToWorkflow && (
              <button
                type="button"
                onClick={onBackToWorkflow}
                className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                ← Back to workflow
              </button>
            )}
            <p className="label-caps">Live deal engine</p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{tx.title}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{money(tx.price, tx.currency)}</p>
        </div>
      )}


      {/* Lane headers — once a side is focused elsewhere (top panel), the "Bidder"/"Responder"
          label doesn't need repeating here too; "Next steps" below is enough context. */}
      {!focusSide && (
        <div className="grid grid-cols-2 gap-4 sm:gap-8">
          <LaneHeader label="Bidder" side="left" />
          <LaneHeader label="Responder" side="right" />
        </div>
      )}
      {hideBidOfferGroups && (
        <div className="mt-1 grid grid-cols-2 gap-4 sm:gap-8">
          {focusSide !== "offer" && (
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white">Next steps</p>
          )}
          {focusSide !== "bid" && (
            <p className="text-right text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white">
              Next steps
            </p>
          )}
        </div>
      )}

      {pickingDirection ? (
        // Choosing bid vs offer: clicking one hides the other, opens the recording form inline
        // in its place, and the opposite lane becomes a static record of what's been recorded.
        <div className="mt-3 grid grid-cols-2 gap-4 sm:gap-8">
          <div className="space-y-3">
            {direction === "offer" ? (
              <SelectionRecord txId={tx.id} />
            ) : direction === "bid" ? (
              <InlineFrame tx={tx} stage="trading" step="bid-offer" reload={reload} onClose={() => setDirection(null)} />
            ) : (
              <div style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
                <PickButton
                  label="Submit a Bid"
                  blurb="Record the opening bid and its terms."
                  side="left"
                  onClick={() => setDirection("bid")}
                  examples={BID_EXAMPLES}
                />
              </div>
            )}
          </div>
          <div className="space-y-3">
            {direction === "bid" ? (
              <SelectionRecord txId={tx.id} />
            ) : direction === "offer" ? (
              <InlineFrame tx={tx} stage="trading" step="bid-offer" reload={reload} onClose={() => setDirection(null)} />
            ) : (
              <div className="ml-auto" style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
                <PickButton
                  label="Submit an Offer"
                  blurb="State what you're supplying, at what price, and your delivery terms."
                  side="right"
                  onClick={() => setDirection("offer")}
                  examples={OFFER_EXAMPLES}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        !hideBidOfferGroups && (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:gap-8">
            <div style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
              <GateGroup title="Bid">
                <div className="space-y-3">
                  {node(
                    { stage: "trading", step: "bid-offer", label: "Bid", icon: ArrowLeftRight },
                    { side: "left", delay: 0 },
                  )}
                  {visible("trading", "documents") &&
                    node(
                      { stage: "trading", step: "documents", label: "Deal documents", icon: FileUp },
                      { side: "left", delay: 90 },
                    )}
                </div>
              </GateGroup>
            </div>
            <div className="ml-auto" style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
              <GateGroup title="Offer">
                <div className="space-y-3">
                  {node(
                    { stage: "trading", step: "bid-offer", label: "Offer", icon: ArrowLeftRight },
                    { side: "right", delay: 45 },
                  )}
                  {visible("trading", "documents") &&
                    node(
                      { stage: "trading", step: "documents", label: "Deal documents", icon: FileUp },
                      { side: "right", delay: 135 },
                    )}
                </div>
              </GateGroup>
            </div>
          </div>
        )
      )}

      {matchingPhase && tx.step === "search" && (
        <div className="mx-auto mt-4 max-w-3xl overflow-hidden rounded-xl border border-primary/20">
          <div className="flex items-center gap-3 bg-primary/5 px-4 py-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            <p className="text-sm text-primary">Running AI search and match…</p>
          </div>
          <div className="h-1.5 w-full animate-ribbon-sweep" />
        </div>
      )}

      {matchingPhase && (tx.step === "ai" || tx.step === "ai-plus") && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-8">
          <div className={cn(bidDirection === "bid" ? "" : "flex flex-col items-end")}>
            {bidDirection === "offer" && (
              <div style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
                <CounterpartyRecord txId={tx.id} />
              </div>
            )}
          </div>
          <div className={cn(bidDirection === "offer" ? "" : "ml-auto")}>
            {bidDirection === "bid" && (
              <div style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
                <CounterpartyRecord txId={tx.id} />
              </div>
            )}
          </div>
        </div>
      )}

      {visible("trading", "counterparties") && (
        <>
          <Connector />
          <GateGroup title="Proof of Intent">
            <div className={cn(stepsBoxClass, "space-y-3")}>
              {node({ stage: "trading", step: "counterparties", icon: Users }, { side: "center" })}
              {visible("trading", "choice") &&
                node({ stage: "trading", step: "choice", icon: MousePointerClick }, { side: "center" })}
              {visible("trading", "media") &&
                node(
                  { stage: "trading", step: "media", label: "Background screening", icon: Newspaper },
                  { side: "center", compact: true, note: "runs quietly" },
                )}
              {visible("trading", "intent") &&
                node({ stage: "trading", step: "intent", icon: Handshake }, { side: "center" })}
              {visible("trading", "poi") &&
                node(
                  { stage: "trading", step: "poi", icon: ShieldCheck },
                  { side: "center", note: "1 token · USD 10" },
                )}
            </div>
            {visible("trading", "poi") && <GateBar label="Proof of Intent" cleared={poi} />}
          </GateGroup>
        </>
      )}

      {visible("compliance", "wad") && (
        <GateGroup title="Without a Doubt">
          <div className={stepsBoxClass}>
            {node(
              { stage: "compliance", step: "wad", icon: ShieldCheck },
              { side: "center", note: "3 tokens · USD 30" },
            )}
          </div>
          <GateBar label="Without a Doubt" cleared={wad} />
        </GateGroup>
      )}

      {executionItems.length > 0 && (
        <GateGroup title="Execution">
          <div className={cn("grid gap-3", focusSide ? cn("grid-cols-1", stepsBoxClass) : "sm:grid-cols-3")}>
            {executionItems.map((s) => node({ stage: "execution", step: s, icon: Hammer }, { compact: true }))}
          </div>
        </GateGroup>
      )}

      {finalityItems.length > 0 && (
        <GateGroup title="Finality">
          <div className={cn("grid gap-3", focusSide ? cn("grid-cols-1", stepsBoxClass) : "sm:grid-cols-3")}>
            {finalityItems.map((s) => node({ stage: "finality", step: s, icon: Landmark }, { compact: true }))}
          </div>
        </GateGroup>
      )}

      {visible("memory", "ledger") && (
        <GateGroup title="Memory">
          <div className={stepsBoxClass}>
            {node({ stage: "memory", step: "ledger", icon: BookLock }, { side: "center" })}
          </div>
        </GateGroup>
      )}
    </div>
  );
}

/** The deal ticker at the top of the canvas: stays put when every deal already fits the row's
 * width, and only starts auto-scrolling once there are more deals than fit — never shows a
 * scrollbar either way. */
/** A step's completion form, rendered inline right where its node sits — continuing the canvas
 * as a frame rather than popping up as a modal window. */
function InlineFrame({
  tx,
  stage,
  step,
  reload,
  onClose,
}: {
  tx: Transaction;
  stage: StageKey;
  step: string;
  reload: () => void;
  onClose: () => void;
}) {
  const def = stepDef(stage, step);
  const locked = lockReason(stage, step, tx);
  return (
    <div className="glass-node animate-node-rise mt-2 p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight">{def?.label ?? step}</p>
          {def?.blurb && <p className="mt-1 text-[13px] text-muted-foreground">{def.blurb}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {locked ? (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">{locked}.</p>
      ) : (
        <StepScreen tx={tx} stage={stage} step={step} reload={reload} />
      )}
    </div>
  );
}

/** The static record panel that stands in for whichever side (Bid or Offer) wasn't picked —
 * a running log of everything recorded on the transaction so far. */
type CounterpartyCandidate = {
  id: string;
  name: string;
  jurisdiction: string | null;
  sector: string | null;
  score: number | null;
  source: string | null;
  shortlisted?: boolean;
};

/** Same "Record" panel as `SelectionRecord`, but for the AI/AI+ search results phase: each
 * candidate gets a checkbox so a bidder (or responder) can mark who they're interested in, without
 * yet making the single final pick (that stays ChoiceStep's job). */
function CounterpartyRecord({ txId }: { txId?: string | null }) {
  const qc = useQueryClient();
  const setShortlist = useServerFn(setCounterpartyShortlist);

  const { data: candidates = [] } = useQuery({
    queryKey: ["counterparties", txId],
    enabled: !!txId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("*")
        .eq("transaction_id", txId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CounterpartyCandidate[];
    },
  });

  async function toggle(c: CounterpartyCandidate, next: boolean) {
    qc.setQueryData<CounterpartyCandidate[]>(["counterparties", txId], (prev) =>
      (prev ?? []).map((row) => (row.id === c.id ? { ...row, shortlisted: next } : row)),
    );
    try {
      await setShortlist({ data: { counterpartyId: c.id, shortlisted: next } });
    } catch (err) {
      toast.error((err as Error).message);
      qc.invalidateQueries({ queryKey: ["counterparties", txId] });
    }
  }

  return (
    <div className="rounded-2xl border-2 border-primary bg-slate-100 p-4">
      <p className="label-caps text-primary">Record</p>
      {candidates.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Searching for counterparties…</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {candidates.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <Checkbox
                id={`shortlist-${c.id}`}
                checked={Boolean(c.shortlisted)}
                onCheckedChange={(v) => toggle(c, Boolean(v))}
                className="mt-0.5"
              />
              <label htmlFor={`shortlist-${c.id}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{c.name}</span>
                  {c.score != null && (
                    <Badge variant="secondary" className="font-normal">
                      {c.score}/100
                    </Badge>
                  )}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {[c.jurisdiction, c.sector].filter(Boolean).join(" · ") || (c.source ?? "manual")}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SelectionRecord({ txId }: { txId?: string | null }) {
  const { data: events = [] } = useQuery({
    queryKey: ["canvas-record", txId],
    enabled: !!txId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_events")
        .select("*")
        .eq("transaction_id", txId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TxEvent[];
    },
  });

  return (
    <div className="rounded-2xl border-2 border-primary bg-slate-100 p-4">
      <p className="label-caps text-primary">Record</p>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {events.map((e) => (
            <li key={e.id}>
              <p className="text-sm font-medium text-slate-900">{e.summary ?? e.action}</p>
              <p className="text-[11px] text-slate-500">{when(e.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The Bid/Offer picking affordance: plain content sitting directly on the canvas grid, not a
 * card of its own — the canvas is the only frame. */
const BID_EXAMPLES = ["buyers for cashew in India", "copper cathode suppliers", "hemp fibre wholesalers South Africa"];
const OFFER_EXAMPLES = ["cashew nuts ready to ship ex-Lagos", "copper cathode available FOB Durban", "hemp fibre bulk lot for export"];

function PickButton({
  label,
  blurb,
  side,
  onClick,
  examples,
}: {
  label: string;
  blurb: string;
  side: "left" | "right";
  onClick: () => void;
  examples: string[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("group block w-full animate-node-rise py-1", side === "right" ? "text-right" : "text-left")}
    >
      <span className={cn("flex items-center gap-2", side === "right" && "flex-row-reverse")}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary bg-primary/20 text-primary transition-transform group-hover:scale-105">
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13.5px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
          {label}
        </span>
      </span>
      <span className="mt-1.5 block text-[12px] leading-relaxed text-muted-foreground">{blurb}</span>
      <span className="mt-1 block truncate text-[11px] text-muted-foreground/80">
        Try: {examples.map((e) => `"${e}"`).join("  ")}
      </span>
    </button>
  );
}

function LaneHeader({
  label,
  side,
  className,
}: {
  label: string;
  side: "left" | "right";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "label-caps flex items-center gap-2 text-primary/80",
        side === "right" && "flex-row-reverse",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-signal-pulse" />
      {label}
    </p>
  );
}

/** A gate's steps, collapsible behind a large brace — click the +/- label to fold the whole
 * gate down to just its heading, or open it back up to see every step inside. */
function GateGroup({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3 flex items-start gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex shrink-0 items-start gap-2 text-left"
      >
        <span
          aria-hidden
          className="select-none font-serif text-4xl leading-[0.6] text-muted-foreground/50"
        >
          {"{"}
        </span>
        <span className="label-caps mt-1.5 text-muted-foreground transition-colors hover:text-foreground">
          {open ? "−" : "+"}
          {title}
        </span>
      </button>
      {open && <div className="min-w-0 flex-1 space-y-3">{children}</div>}
    </div>
  );
}

/** Shown on the canvas when there is nothing to work on yet. Clicking the card reveals the Bid
 * and Offer frames inline — nothing else on the flowchart shows until one of them is opened and
 * completed, at which point the parent (given the new transaction id) switches to the real
 * DealCanvas, which then reveals its own next frame the same way. */
export function CanvasStart({
  onCreated,
  onPickingChange,
  onDirectionChange,
}: {
  onCreated: (id: string) => void;
  /** Fires whenever picking starts/stops, so the caller can hide anything that would look like a
   * duplicate of this card (e.g. the read-only flowchart preview) while it's active. */
  onPickingChange?: (picking: boolean) => void;
  /** Fires whenever the bid/offer side is picked or cleared. */
  onDirectionChange?: (direction: "bid" | "offer" | null) => void;
}) {
  const { org, user, profile, refresh } = useAuth();
  const [picking, setPickingState] = useState(false);
  const setPicking = (v: boolean) => {
    setPickingState(v);
    onPickingChange?.(v);
  };
  const [direction, setDirectionState] = useState<"bid" | "offer" | null>(null);
  const setDirection = (v: "bid" | "offer" | null) => {
    setDirectionState(v);
    onDirectionChange?.(v);
  };
  const [form, setForm] = useState({ title: "", commodity: "", quantity: "", unit: "", price: "", currency: "USD" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!direction) return;
    if (!user) {
      toast.error("Sign in to record a bid or offer");
      return;
    }
    setBusy(true);
    try {
      // Some accounts (Google sign-up, or older ones) never got an organisation — provision a
      // personal one on the fly instead of blocking here, same as new individual sign-ups do.
      const activeOrg = org ?? (await ensureOrg(user.id, profile?.full_name ?? user.email ?? "My account"));
      if (!org) void refresh();

      const { data: newTx, error } = await supabase
        .from("transactions")
        .insert({
          org_id: activeOrg.id,
          stage: "trading",
          step: "bid-offer",
          title: form.title || form.commodity || (direction === "bid" ? "New buy bid" : "New sell offer"),
          commodity: form.commodity || null,
          quantity: form.quantity ? Number(form.quantity) : null,
          unit: form.unit || null,
          price: form.price ? Number(form.price) : null,
          currency: form.currency || "USD",
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("bid_offers").insert({
        transaction_id: newTx.id,
        direction,
        price: form.price ? Number(form.price) : 0,
        quantity: form.quantity ? Number(form.quantity) : 0,
        unit: form.unit || "",
        currency: form.currency || "USD",
        terms: "",
      });
      await recordEvent({
        transactionId: newTx.id,
        stage: "trading",
        step: "bid-offer",
        action: direction === "bid" ? "bid_placed" : "offer_placed",
        summary: `${direction === "bid" ? "Bid" : "Offer"} placed: ${form.title || form.commodity || newTx.title}`,
        payload: { ...form },
      });
      await advance(newTx.id, "trading", "documents");
      setDirection(null);
      onCreated(newTx.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const startNode = (
    <div className="mx-auto max-w-md">
      <button
        type="button"
        onClick={() => {
          if (picking) {
            // Clicking the start node again resets back to the beginning.
            setPicking(false);
            setDirection(null);
          } else {
            setPicking(true);
          }
        }}
        className="group block w-full animate-node-rise px-6 py-5 text-center"
      >
        <span
          className={cn(
            "mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-primary text-primary transition-transform",
            picking ? "bg-primary/20" : "bg-primary/20 group-hover:scale-105",
          )}
        >
          <ArrowLeftRight className="h-4.5 w-4.5" />
        </span>
        <span
          className={cn(
            "mt-3 block text-[15px] font-semibold tracking-tight text-foreground transition-colors",
            !picking && "group-hover:text-primary",
          )}
        >
          Open a bid or an offer
        </span>
        <span className="mt-1 block text-[12.5px] font-medium text-muted-foreground">
          Bids to the left, Offers to the right.
        </span>
      </button>
    </div>
  );

  if (!picking) {
    return (
      <div className="ink-grid relative rounded-3xl border border-border p-4 sm:p-6">
        <p className="label-caps text-center">Live deal engine</p>
        <div className="mt-6">{startNode}</div>
        <Connector />
        <p className="text-center text-[11.5px] text-muted-foreground">
          Matching · Proof of Intent · Without a Doubt · Execution · Finality
        </p>
      </div>
    );
  }

  const form_ = (
    <form onSubmit={submit} className="mt-2 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cs-title">Transaction title</Label>
        <Input
          id="cs-title"
          autoFocus
          placeholder="e.g. Copper cathode, Q3 delivery"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cs-commodity">Commodity or asset</Label>
        <CommoditySearch
          id="cs-commodity"
          value={form.commodity}
          onChange={(v) => setForm({ ...form, commodity: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cs-qty">Quantity</Label>
          <Input
            id="cs-qty"
            type="number"
            step="any"
            className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-unit">Unit</Label>
          <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
            <SelectTrigger id="cs-unit">
              <SelectValue placeholder="Select a unit" />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cs-price">Price</Label>
          <Input
            id="cs-price"
            type="number"
            step="any"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-currency">Currency</Label>
          <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
            <SelectTrigger id="cs-currency">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Recording…" : "Record and continue"}
      </Button>
    </form>
  );

  return (
    <>
      {!direction && (
        <div className="ink-grid relative rounded-3xl border border-border p-4 sm:p-6">
          <p className="label-caps text-center">Live deal engine</p>
          <div className="mt-6">{startNode}</div>
        </div>
      )}
      <div
        className={cn(
          "relative rounded-3xl p-3 sm:p-5",
          !direction && "ink-grid mt-4 border border-border",
        )}
      >
      <p className="label-caps mb-3">
        {direction === "bid" ? "Live deal engine for Bidder" : direction === "offer" ? "Live deal engine for Responder" : "Live deal engine"}
      </p>
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        {direction !== "offer" && <LaneHeader label="Bidder" side="left" />}
        {direction !== "bid" && <LaneHeader label="Responder" side="right" className="col-start-2" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:gap-8">
        {direction !== "offer" && (
          <div className="space-y-3">
            {direction === "bid" ? (
              <div className="glass-node animate-node-rise p-5 sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <p className="text-base font-semibold tracking-tight">Submit a Bid</p>
                  <button
                    type="button"
                    onClick={() => setDirection(null)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {form_}
              </div>
            ) : (
              <div style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
                <PickButton
                  label="Submit a Bid"
                  blurb="Record the opening bid and its terms."
                  side="left"
                  onClick={() => setDirection("bid")}
                  examples={BID_EXAMPLES}
                />
              </div>
            )}
          </div>
        )}
        {direction !== "bid" && (
          <div className="col-start-2 space-y-3">
            {direction === "offer" ? (
              <div className="glass-node animate-node-rise p-5 sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <p className="text-base font-semibold tracking-tight">Submit an Offer</p>
                  <button
                    type="button"
                    onClick={() => setDirection(null)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {form_}
              </div>
            ) : (
              <div className="ml-auto" style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
                <PickButton
                  label="Submit an Offer"
                  blurb="State what you're supplying, at what price, and your delivery terms."
                  side="right"
                  onClick={() => setDirection("offer")}
                  examples={OFFER_EXAMPLES}
                />
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </>
  );
}
