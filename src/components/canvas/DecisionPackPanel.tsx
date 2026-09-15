import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Check, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { runDecisionPack, decideProposal, type StageContext } from "@/lib/decisionPack.functions";

type Proposal = {
  id: string;
  proposal_type: string | null;
  probability: number | null;
  output: string;
  rationale: string | null;
  source_references: unknown;
  decision: string | null;
  decided_at: string | null;
  related_counterparty: string | null;
};

const HEADING: Record<StageContext, string> = {
  choice_made: "AI+ advice on your choice",
  intent_confirmed: "AI+ advice before sealing",
  wad_updated: "AI+ advice on the compliance case",
  finality_recorded: "AI+ closing notes",
};

const PILL_LABEL: Record<StageContext, string> = {
  choice_made: "AI+ CHOICE CONSULT",
  intent_confirmed: "AI+ FINAL CHOICE CONSULT",
  wad_updated: "AI+ OVERALL COMPLIANCE CONSULT",
  finality_recorded: "AI+ PROPOSALS",
};

/**
 * AI+ proposes, a person decides. Nothing here changes the deal: each proposal is accepted or
 * rejected by the signed-in person, and that decision is written to the record on its own.
 */
export function DecisionPackPanel({
  transactionId,
  stageContext,
  gating = false,
  onAllDecided,
}: {
  transactionId: string;
  stageContext: StageContext;
  /** When true the panel opens itself and asks for a decision on every proposal. */
  gating?: boolean;
  onAllDecided?: (allDecided: boolean) => void;
}) {
  const run = useServerFn(runDecisionPack);
  const decide = useServerFn(decideProposal);
  const [open, setOpen] = useState(gating);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setBusy(true);
    setError(null);
    (async () => {
      try {
        const res = await run({ data: { transactionId, stageContext } });
        if (!live) return;
        setProposals(res.proposals as unknown as Proposal[]);
      } catch (err) {
        if (live) setError((err as Error).message);
      } finally {
        if (live) setBusy(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [transactionId, stageContext, run]);

  useEffect(() => {
    if (!proposals) return;
    const allDecided = proposals.length > 0 && proposals.every((p) => Boolean(p.decided_at));
    onAllDecided?.(allDecided);
  }, [proposals, onAllDecided]);

  // Folds itself back up once every proposal has been decided — a brief pause so the last
  // "Accepted"/"Rejected" state is actually seen before the panel collapses on its own.
  useEffect(() => {
    if (!proposals || proposals.length === 0) return;
    const allDecided = proposals.every((p) => Boolean(p.decided_at));
    if (!allDecided) return;
    const id = setTimeout(() => setOpen(false), 1200);
    return () => clearTimeout(id);
  }, [proposals]);

  async function act(id: string, decision: "accepted" | "rejected") {
    setDeciding(id);
    try {
      const res = await decide({ data: { proposalId: id, decision } });
      setProposals((prev) =>
        prev
          ? prev.map((p) => (p.id === id ? { ...p, decision, decided_at: res.decidedAt } : p))
          : prev,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeciding(null);
    }
  }

  const [selectingAll, setSelectingAll] = useState(false);
  async function acceptAll() {
    const ids = (proposals ?? []).filter((p) => !p.decided_at).map((p) => p.id);
    if (ids.length === 0) return;
    setSelectingAll(true);
    try {
      for (const id of ids) {
        await act(id, "accepted");
      }
    } finally {
      setSelectingAll(false);
    }
  }

  const pending = (proposals ?? []).filter((p) => !p.decided_at).length;

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="label-caps rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
            {PILL_LABEL[stageContext]}
          </span>
          {busy ? (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> AI+ is analysing…
            </span>
          ) : pending > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              {pending} awaiting your decision
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">All decided</span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-2 px-3.5 pb-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {HEADING[stageContext]}. AI+ is advisory — it cannot select, change or seal anything. You
              decide, and your decision is recorded against your name.
            </p>
            {pending > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 gap-1 rounded-full px-2.5 text-[11px]"
                disabled={selectingAll || deciding !== null}
                onClick={() => void acceptAll()}
              >
                {selectingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Accept all
              </Button>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {busy && !proposals && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Reading the deal record…
            </div>
          )}

          {(proposals ?? []).map((p) => {
            const pct = p.probability == null ? null : Math.round(p.probability * 100);
            const refs = Array.isArray(p.source_references) ? (p.source_references as string[]) : [];
            return (
              <div key={p.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="label-caps text-[10px] text-muted-foreground">
                        {p.proposal_type}
                      </span>
                      {pct !== null && (
                        <span className="rounded-full bg-[var(--lw-pill-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--lw-pill-fg)]">
                          {pct}%
                        </span>
                      )}
                      {p.related_counterparty && (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {p.related_counterparty}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold">{p.output}</p>
                    {p.rationale && (
                      <p className="mt-1 text-[11px] text-muted-foreground">{p.rationale}</p>
                    )}
                    {refs.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {refs.map((r, i) => (
                          <li key={i} className="truncate text-[10px] text-muted-foreground">
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {p.decided_at ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        p.decision === "accepted"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p.decision === "accepted" ? "Accepted" : "Rejected"}
                    </span>
                  ) : (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 rounded-full px-2.5 text-[11px]"
                        disabled={deciding === p.id}
                        onClick={() => void act(p.id, "rejected")}
                      >
                        <X className="h-3 w-3" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 gap-1 rounded-full px-2.5 text-[11px]"
                        disabled={deciding === p.id}
                        onClick={() => void act(p.id, "accepted")}
                      >
                        {deciding === p.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Accept
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!busy && (proposals ?? []).length === 0 && !error && (
            <p className="text-xs text-muted-foreground">AI+ had nothing to add here.</p>
          )}
        </div>
      )}
    </div>
  );
}
