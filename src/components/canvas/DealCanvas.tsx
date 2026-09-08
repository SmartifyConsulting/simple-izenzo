import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { CanvasNode, Connector, GateBar, type NodeState } from "./CanvasNode";
import { StepScreen } from "@/components/steps/StepScreen";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { lockReason, stepDef, stepIndex, type StageKey } from "@/lib/spine";
import { advance, money, recordEvent, type Transaction } from "@/lib/tx";
import { cn } from "@/lib/utils";

type NodeRef = { stage: StageKey; step: string; label?: string; icon?: typeof Radar };

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
  gridTheme = "light",
}: {
  tx: Transaction;
  reload: () => void;
  deals?: Transaction[];
  onSelectDeal?: (id: string) => void;
  /** "none" for a clean flowchart with no grid backdrop (Workflow View); "dark" for the
   * black/green experimental treatment (Workflow Grid); "light" (default) is the original look,
   * unchanged everywhere else. */
  gridTheme?: "none" | "light" | "dark";
}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string } | null>(null);
  const stateOf = useNodeState(tx);

  const open = (stage: StageKey, step: string) => setPanel({ stage, step });

  const node = (
    n: NodeRef,
    opts?: { side?: "left" | "right" | "center"; note?: string; compact?: boolean; delay?: number },
  ) => {
    const def = stepDef(n.stage, n.step);
    return (
      <CanvasNode
        label={n.label ?? def?.label ?? n.step}
        blurb={opts?.compact ? undefined : def?.blurb}
        state={stateOf(n.stage, n.step)}
        icon={n.icon}
        side={opts?.side}
        note={opts?.note}
        compact={opts?.compact}
        delay={opts?.delay}
        onClick={() => open(n.stage, n.step)}
      />
    );
  };

  const poi = Boolean(tx.poi_sealed_at);
  const wad = Boolean(tx.wad_completed_at);
  const matchingPhase =
    tx.stage === "trading" && ["search", "ai", "ai-plus"].includes(tx.step);

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
    <div
      className={cn(
        "relative rounded-3xl border border-border p-4 sm:p-7",
        gridTheme === "light" && "ink-grid",
        gridTheme === "dark" && "ink-grid-dark",
      )}
    >
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

      {/* Paired opening lanes */}
      <div className="mt-3 grid grid-cols-2 gap-4 sm:gap-8">
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
      </div>

      {matchingPhase && (
        <div className="mx-auto mt-4 max-w-3xl overflow-hidden rounded-xl border border-primary/20">
          <div className="flex items-center gap-3 bg-primary/5 px-4 py-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            <p className="text-sm text-primary">Running AI search and match…</p>
          </div>
          <div className="h-1.5 w-full animate-ribbon-sweep" />
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

      <Dialog open={panel !== null} onOpenChange={(v) => !v && setPanel(null)}>
        <DialogContent className="glass max-h-[88vh] w-[min(1000px,94vw)] overflow-y-auto p-0 sm:max-w-[min(1000px,94vw)]">
          {panel && (
            <PanelBody
              tx={tx}
              stage={panel.stage}
              step={panel.step}
              onClose={() => setPanel(null)}
              reload={reload}
            />
          )}
        </DialogContent>
      </Dialog>
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

function PanelBody({
  tx,
  stage,
  step,
  onClose,
  reload,
}: {
  tx: Transaction;
  stage: StageKey;
  step: string;
  onClose: () => void;
  reload: () => void;
}) {
  const def = stepDef(stage, step);
  const locked = lockReason(stage, step, tx);
  return (
    <div className="p-5 sm:p-7">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <DialogTitle className="truncate text-lg tracking-tight">
            {def?.label ?? step}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[13px]">{def?.blurb}</DialogDescription>
        </div>
      </div>
      {locked ? (
        <p className="rounded-xl border border-border bg-white/5 p-4 text-sm text-muted-foreground">
          {locked}.
        </p>
      ) : (
        <StepScreen tx={tx} stage={stage} step={step} reload={reload} />
      )}
    </div>
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
          <button type="button" onClick={() => setPicking(true)} className="block w-full text-left">
            <span className="glass-node node-active animate-node-rise block px-6 py-7 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-primary bg-primary/20 text-primary">
                <ArrowLeftRight className="h-4.5 w-4.5" />
              </span>
              <span className="mt-3 block text-[15px] font-semibold tracking-tight">
                Open a bid or an offer
              </span>
              <span className="mt-1.5 block text-[12.5px] text-muted-foreground">
                The canvas draws itself from here: your lane on the left, the counterparty on the
                right.
              </span>
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

  return (
    <div className="ink-grid relative rounded-3xl border border-border p-4 sm:p-7">
      <p className="label-caps mb-4">Live deal canvas</p>
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        <LaneHeader label="Bidder" side="left" />
        <LaneHeader label="Responder" side="right" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:gap-8">
        <CanvasNode
          label="Bid"
          blurb="Record the opening bid and its terms."
          state="active"
          icon={ArrowLeftRight}
          side="left"
          onClick={() => setDirection("bid")}
        />
        <CanvasNode
          label="Offer"
          blurb="Record the opening offer and its terms."
          state="active"
          icon={ArrowLeftRight}
          side="right"
          onClick={() => setDirection("offer")}
        />
      </div>

      <Dialog open={direction !== null} onOpenChange={(v) => !v && setDirection(null)}>
        <DialogContent className="glass w-[min(560px,94vw)] sm:max-w-[min(560px,94vw)]">
          <DialogTitle className="text-lg tracking-tight">
            {direction === "bid" ? "New Bid to Buy" : "New Bid to Sell"}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Every step from here is recorded on the Trading Gateway.
          </DialogDescription>
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
              <Input
                id="cs-commodity"
                value={form.commodity}
                onChange={(e) => setForm({ ...form, commodity: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cs-qty">Quantity</Label>
                <Input
                  id="cs-qty"
                  type="number"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cs-unit">Unit</Label>
                <Input id="cs-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
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
                <Input
                  id="cs-currency"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Recording…" : "Record and continue"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
