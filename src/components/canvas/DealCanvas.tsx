import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  FileUp,
  Radar,
  Sparkles,
  Users,
  MousePointerClick,
  Handshake,
  ShieldCheck,
  Hammer,
  Landmark,
  BookLock,
  ArrowLeftRight,
  Newspaper,
  X,
} from "lucide-react";
import { CanvasNode, Connector, GateBar, SearchBeam, type NodeState } from "./CanvasNode";
import { StepScreen } from "@/components/steps/StepScreen";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { lockReason, stepDef, stepIndex, type StageKey } from "@/lib/spine";
import { money, type Transaction } from "@/lib/tx";
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
}: {
  tx: Transaction;
  reload: () => void;
  deals?: Transaction[];
  onSelectDeal?: (id: string) => void;
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
  const matching =
    tx.stage === "trading" && ["search", "ai", "ai-plus", "counterparties"].includes(tx.step);

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
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {deals.map((d) => {
            const def = stepDef(d.stage, d.step);
            const current = d.id === tx.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDeal(d.id)}
                className={cn(
                  "glass-node w-[220px] shrink-0 px-3.5 py-2.5 text-left transition-transform hover:-translate-y-0.5",
                  current && "node-active",
                )}
              >
                <span className="block truncate text-[13px] font-semibold tracking-tight">
                  {d.title}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                  {money(d.price, d.currency)} · {def?.label ?? d.step}
                </span>
              </button>
            );
          })}
        </div>
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
          {node(
            { stage: "trading", step: "documents", label: "Deal documents", icon: FileUp },
            { side: "left", delay: 90 },
          )}
        </div>
        <div className="space-y-3">
          {node(
            { stage: "trading", step: "bid-offer", label: "Offer", icon: ArrowLeftRight },
            { side: "right", delay: 45 },
          )}
          {node(
            { stage: "trading", step: "documents", label: "Deal documents", icon: FileUp },
            { side: "right", delay: 135 },
          )}
        </div>
      </div>

      <SearchBeam active={matching} />

      <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
        {node({ stage: "trading", step: "search", icon: Radar }, { compact: true, delay: 60 })}
        {node({ stage: "trading", step: "ai", icon: Sparkles }, { compact: true, delay: 120 })}
        {node({ stage: "trading", step: "ai-plus", icon: Sparkles }, { compact: true, delay: 180 })}
      </div>

      <Connector pulse={matching} />

      <div className="mx-auto max-w-3xl space-y-3">
        {node({ stage: "trading", step: "counterparties", icon: Users }, { side: "center" })}
        {node({ stage: "trading", step: "choice", icon: MousePointerClick }, { side: "center" })}
        {node(
          { stage: "trading", step: "media", label: "Background screening", icon: Newspaper },
          { side: "center", compact: true, note: "runs quietly" },
        )}
        {node({ stage: "trading", step: "intent", icon: Handshake }, { side: "center" })}
        {node(
          { stage: "trading", step: "poi", icon: ShieldCheck },
          { side: "center", note: "1 token · USD 10" },
        )}
      </div>

      <GateBar label="Proof of Intent" cleared={poi} />

      <div className="mx-auto max-w-3xl">
        {node(
          { stage: "compliance", step: "wad", icon: ShieldCheck },
          { side: "center", note: "3 tokens · USD 30" },
        )}
      </div>

      <GateBar label="Without a Doubt" cleared={wad} />

      <SectionRow
        title="Execution"
        items={["entry", "preparation", "bankability", "implementation", "stakeholders"].map((s) =>
          node({ stage: "execution", step: s, icon: Hammer }, { compact: true }),
        )}
      />

      <SectionRow
        title="Finality"
        items={["entry", "type", "evidence", "change", "validation", "record"].map((s) =>
          node({ stage: "finality", step: s, icon: Landmark }, { compact: true }),
        )}
      />

      <div className="mx-auto mt-5 max-w-3xl">
        {node({ stage: "memory", step: "ledger", icon: BookLock }, { side: "center" })}
      </div>

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

/** Shown on the canvas when there is nothing to work on yet. */
export function CanvasStart() {
  return (
    <div className="ink-grid relative rounded-3xl border border-border p-8 sm:p-14">
      <p className="label-caps text-center">Live deal canvas</p>
      <div className="mx-auto mt-6 max-w-md">
        <Link to="/transactions/new" className="block">
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
        </Link>
      </div>
      <Connector />
      <p className="text-center text-[11.5px] text-muted-foreground">
        Matching · Proof of Intent · Without a Doubt · Execution · Finality
      </p>
    </div>
  );
}
