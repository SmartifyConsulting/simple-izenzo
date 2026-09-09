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
}: {
  tx: Transaction;
  reload: () => void;
  deals?: Transaction[];
  onSelectDeal?: (id: string) => void;
}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string } | null>(null);
  const [direction, setDirection] = useState<"bid" | "offer" | null>(null);
  const stateOf = useNodeState(tx);

  // Which side placed the bid vs offer — read from the record itself (not just local `direction`
  // state, which resets on reload) so the results panel mirrors correctly at every step.
  const { data: recordedDirection } = useQuery({
    queryKey: ["bid-direction", tx.id],
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
          onClick={() => setPanel(isOpen ? null : { stage: n.stage, step: n.step })}
        />
        {isOpen && (
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

  return (
    <div className="ink-grid relative rounded-3xl border border-border p-4 sm:p-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps">Live deal canvas</p>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{tx.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{money(tx.price, tx.currency)}</p>
      </div>

      {deals && deals.length > 1 && onSelectDeal && (
        <DealTicker deals={deals} currentId={tx.id} onSelectDeal={onSelectDeal} />
      )}


      {/* Lane headers */}
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        <LaneHeader label="Bidder" side="left" />
        <LaneHeader label="Responder" side="right" />
      </div>

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
                  label="Bid"
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
                  label="Offer"
                  blurb="Record the opening offer and its terms."
                  side="right"
                  onClick={() => setDirection("offer")}
                  examples={OFFER_EXAMPLES}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-4 sm:gap-8">
          <div className="space-y-3" style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
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
          <div className="ml-auto space-y-3" style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
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
        </div>
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
          <div className="mx-auto max-w-3xl space-y-3">
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
        </>
      )}

      {visible("trading", "poi") && <GateBar label="Proof of Intent" cleared={poi} />}

      {visible("compliance", "wad") && (
        <div className="mx-auto max-w-3xl">
          {node(
            { stage: "compliance", step: "wad", icon: ShieldCheck },
            { side: "center", note: "3 tokens · USD 30" },
          )}
        </div>
      )}

      {visible("compliance", "wad") && <GateBar label="Without a Doubt" cleared={wad} />}

      {executionItems.length > 0 && (
        <SectionRow
          title="Execution"
          items={executionItems.map((s) => node({ stage: "execution", step: s, icon: Hammer }, { compact: true }))}
        />
      )}

      {finalityItems.length > 0 && (
        <SectionRow
          title="Finality"
          items={finalityItems.map((s) => node({ stage: "finality", step: s, icon: Landmark }, { compact: true }))}
        />
      )}

      {visible("memory", "ledger") && (
        <div className="mx-auto mt-5 max-w-3xl">
          {node({ stage: "memory", step: "ledger", icon: BookLock }, { side: "center" })}
        </div>
      )}
    </div>
  );
}

/** The deal ticker at the top of the canvas: stays put when every deal already fits the row's
 * width, and only starts auto-scrolling once there are more deals than fit — never shows a
 * scrollbar either way. */
function DealTicker({
  deals,
  currentId,
  onSelectDeal,
}: {
  deals: Transaction[];
  currentId: string;
  onSelectDeal: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const check = () => setOverflowing(content.scrollWidth > container.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, [deals.length]);

  const renderDeal = (d: Transaction, idx: number, cloneKey?: string) => {
    const def = stepDef(d.stage, d.step);
    const current = d.id === currentId;
    return (
      <button
        key={cloneKey ?? d.id}
        type="button"
        onClick={() => onSelectDeal(d.id)}
        className={cn(
          "glass-node w-[220px] shrink-0 px-3.5 py-2.5 text-left transition-transform hover:-translate-y-0.5",
          current && "node-active",
        )}
        tabIndex={cloneKey ? -1 : 0}
        aria-hidden={cloneKey ? true : undefined}
      >
        <span className="block truncate text-[13px] font-semibold tracking-tight">{d.title}</span>
        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
          {money(d.price, d.currency)} · {def?.label ?? d.step}
        </span>
      </button>
    );
  };

  return (
    <div ref={containerRef} className="mb-6 overflow-hidden">
      <div
        className={cn(
          "flex w-max gap-2 pb-1",
          overflowing && "animate-marquee-left hover:[animation-play-state:paused]",
        )}
      >
        <div ref={contentRef} className="flex gap-2">
          {deals.map((d, i) => renderDeal(d, i))}
        </div>
        {overflowing && (
          <div className="flex gap-2" aria-hidden>
            {deals.map((d, i) => renderDeal(d, i, `clone-${d.id}`))}
          </div>
        )}
      </div>
    </div>
  );
}

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
      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground/80">
        Try: {examples.map((e) => `"${e}"`).join("  ")}
      </span>
    </button>
  );
}

function LaneHeader({ label, side }: { label: string; side: "left" | "right" }) {
  return (
    <p
      className={cn(
        "label-caps flex items-center gap-2 text-primary/80",
        side === "right" && "flex-row-reverse",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-signal-pulse" />
      {label}
    </p>
  );
}

function SectionRow({ title, items }: { title: string; items: React.ReactNode[] }) {
  return (
    <div className="mt-5">
      <p className="label-caps mb-2">{title}</p>
      <div className="grid gap-3 sm:grid-cols-3">{items}</div>
    </div>
  );
}

/** Shown on the canvas when there is nothing to work on yet. Clicking the card reveals the Bid
 * and Offer frames inline — nothing else on the flowchart shows until one of them is opened and
 * completed, at which point the parent (given the new transaction id) switches to the real
 * DealCanvas, which then reveals its own next frame the same way. */
export function CanvasStart({ onCreated }: { onCreated: (id: string) => void }) {
  const { org } = useAuth();
  const [picking, setPicking] = useState(false);
  const [direction, setDirection] = useState<"bid" | "offer" | null>(null);
  const [form, setForm] = useState({ title: "", commodity: "", quantity: "", unit: "", price: "", currency: "USD" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!org || !direction) {
      toast.error("Add your organisation details first");
      return;
    }
    setBusy(true);
    try {
      const { data: newTx, error } = await supabase
        .from("transactions")
        .insert({
          org_id: org.id,
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

  if (!picking) {
    return (
      <div className="ink-grid relative rounded-3xl border border-border p-8 sm:p-14">
        <p className="label-caps text-center">Live deal canvas</p>
        <div className="mx-auto mt-6 max-w-md">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="group block w-full animate-node-rise px-6 py-7 text-center"
          >
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-primary bg-primary/20 text-primary transition-transform group-hover:scale-105">
              <ArrowLeftRight className="h-4.5 w-4.5" />
            </span>
            <span className="mt-3 block text-[15px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
              Open a bid or an offer
            </span>
            <span className="mt-1.5 block text-[12.5px] text-muted-foreground">
              The canvas draws itself from here: your lane on the left, the counterparty on the
              right.
            </span>
          </button>
        </div>
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
    <div className="ink-grid relative rounded-3xl border border-border p-4 sm:p-7">
      <p className="label-caps mb-4">Live deal canvas</p>
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        <LaneHeader label="Bidder" side="left" />
        <LaneHeader label="Responder" side="right" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:gap-8">
        <div className="space-y-3">
          {direction === "offer" ? (
            <SelectionRecord />
          ) : direction === "bid" ? (
            <div className="glass-node animate-node-rise p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <p className="text-base font-semibold tracking-tight">New Bid to Buy</p>
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
                label="Bid"
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
            <SelectionRecord />
          ) : direction === "offer" ? (
            <div className="glass-node animate-node-rise p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <p className="text-base font-semibold tracking-tight">New Bid to Sell</p>
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
                label="Offer"
                blurb="Record the opening offer and its terms."
                side="right"
                onClick={() => setDirection("offer")}
                examples={OFFER_EXAMPLES}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
