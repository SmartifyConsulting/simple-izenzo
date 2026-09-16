import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  choice_made: "AI+ RECOMMENDATIONS",
  intent_confirmed: "AI+ RECOMMENDATIONS",
  wad_updated: "AI+ RECOMMENDATIONS",
  finality_recorded: "AI+ RECOMMENDATIONS",
};

/**
 * AI+ proposes, a person decides. Nothing here changes the deal: each recommendation is accepted
 * or rejected by the signed-in person in a modal window, that decision is written to the record on
 * its own, and once the whole set is answered it is filed as a document against the deal and the
 * control disappears for good.
 */
export function DecisionPackPanel({
  transactionId,
  stageContext,
  gating = false,
  onAllDecided,
}: {
  transactionId: string;
  stageContext: StageContext;
  /** When true the modal opens itself and asks for a decision on every recommendation. */
  gating?: boolean;
  onAllDecided?: (allDecided: boolean) => void;
}) {
  const run = useServerFn(runDecisionPack);
  const decide = useServerFn(decideProposal);
  const [open, setOpen] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);

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

  const allDecided =
    Boolean(proposals) && proposals!.length > 0 && proposals!.every((p) => Boolean(p.decided_at));
  const pending = (proposals ?? []).filter((p) => !p.decided_at).length;

  useEffect(() => {
    if (!proposals) return;
    if (!allDecided) onAllDecided?.(false);
  }, [proposals, allDecided, onAllDecided]);

  // Once everything is answered the modal closes itself — a brief pause so the last
  // "Accepted"/"Rejected" state is actually seen — and the caller is told it is fully decided.
  useEffect(() => {
    if (!allDecided) return;
    const id = setTimeout(() => {
      setOpen(false);
      onAllDecided?.(true);
    }, 900);
    return () => clearTimeout(id);
  }, [allDecided, onAllDecided]);

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

  // Nothing is left to decide: no control, just the quiet record that it happened. The filed
  // document lives in the Documents panel.
  if (allDecided && !open) {
    return (
      <p className="px-1 text-[11px] text-muted-foreground">
        AI+ recommendations recorded — filed in Documents.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || Boolean(error) || (proposals ?? []).length === 0}
          onClick={() => setOpen(true)}
          className="h-8 gap-2 rounded-full border-orange-500/60 px-3 text-[11px] font-semibold text-orange-600 hover:bg-orange-500/10"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {PILL_LABEL[stageContext]}
          {!busy && pending > 0 && (
            <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] text-white">
              {pending}
            </span>
          )}
        </Button>
        {busy && <span className="text-[11px] text-muted-foreground">AI+ is analysing…</span>}
        {error && <span className="text-[11px] text-destructive">{error}</span>}
        {!busy && !error && (proposals ?? []).length === 0 && (
          <span className="text-[11px] text-muted-foreground">AI+ had nothing to add here.</span>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          // While gating, the set must be answered — it cannot be dismissed unanswered.
          if (!v && gating && pending > 0) return;
          setOpen(v);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-orange-500" /> AI+ Recommendations
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              {HEADING[stageContext]}. AI+ is advisory — it cannot select, change or seal anything.
              You decide, and your decision is recorded against your name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {pending > 1 && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 rounded-full px-2.5 text-[11px]"
                  disabled={selectingAll || deciding !== null}
                  onClick={() => void acceptAll()}
                >
                  {selectingAll ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Accept all
                </Button>
              </div>
            )}

            {(proposals ?? []).map((p) => {
              const pct = p.probability == null ? null : Math.round(Number(p.probability) * 100);
              const refs = Array.isArray(p.source_references)
                ? (p.source_references as string[])
                : [];
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
