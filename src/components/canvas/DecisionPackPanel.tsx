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
import { confidenceOf, EVIDENCE_LABEL, parseEvidenceRefs } from "@/lib/confidence";

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
  poi_sealed: "AI+ notes on the sealed Proof of Intent",
  wad_updated: "AI+ advice on the compliance case",
  finality_recorded: "AI+ closing notes",
};

const PILL_LABEL: Record<StageContext, string> = {
  choice_made: "AI+ RECOMMENDATIONS",
  intent_confirmed: "AI+ RECOMMENDATIONS",
  poi_sealed: "AI+ RECOMMENDATIONS",
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
  // Bumped by the "Try again" button to re-run the effect below — a transient failure (rate
  // limited, a slow gateway) previously had no way back short of leaving the deal and reopening it.
  const [retryTick, setRetryTick] = useState(0);

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
  }, [transactionId, stageContext, run, retryTick]);

  const allDecided =
    Boolean(proposals) && proposals!.length > 0 && proposals!.every((p) => Boolean(p.decided_at));
  const pending = (proposals ?? []).filter((p) => !p.decided_at).length;

  // A failed fetch (proposals stays null) must still tell the caller "not decided" — otherwise a
  // gate that was satisfied by a *previous* transaction (onAllDecided(true) from an earlier deal)
  // stays satisfied here too, since nothing ever calls it again to say otherwise, and Intent opens
  // for a deal whose AI+ recommendations were never actually shown, let alone answered.
  useEffect(() => {
    if (!allDecided) onAllDecided?.(false);
  }, [proposals, error, allDecided, onAllDecided]);

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

  async function decideAll(decision: "accepted" | "rejected") {
    const ids = (proposals ?? []).filter((p) => !p.decided_at).map((p) => p.id);
    if (ids.length === 0) return;
    setSelectingAll(true);
    try {
      for (const id of ids) {
        await act(id, decision);
      }
    } finally {
      setSelectingAll(false);
    }
  }

  // Nothing is left to decide: no control, just the quiet record that it happened. The filed
  // document lives in the Documents panel.
  /** Closing is always allowed. While gating, the set still has to be answered before the next step
   * opens, and the button above brings this window back. */
  function closeModal() {
    setOpen(false);
    if (gating && pending > 0) {
      toast.info("You still need to accept or reject each recommendation before the next step opens.");
    }
  }

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
        {error && (
          <>
            <span className="text-[11px] text-destructive">{error}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRetryTick((n) => n + 1)}
              className="h-6 rounded-full px-2 text-[10px] font-semibold text-destructive hover:bg-destructive/10"
            >
              Try again
            </Button>
          </>
        )}
        {!busy && !error && (proposals ?? []).length === 0 && (
          <span className="text-[11px] text-muted-foreground">AI+ had nothing to add here.</span>
        )}
        {/* The gate itself lives here, next to the button that opens it, rather than as a
            separate message elsewhere in the workspace. */}
        {!busy && !error && gating && pending > 0 && (
          <span className="text-[11px] text-muted-foreground">
            Accept or reject each AI+ proposal above, then Intent opens.
          </span>
        )}
        {/* Testing shortcut, explicitly requested: does exactly what "Accept all" inside the modal
            already does (records a real accepted decision against every pending proposal — same
            decideProposal call, same audit trail), just reachable without opening the modal first
            and even when there's only one proposal (Accept all only shows once there are 2+). Not
            a bypass of anything the product doesn't already let a participant do themselves. */}
        {!busy && !error && gating && pending > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={selectingAll || deciding !== null}
            onClick={() => void decideAll("accepted")}
            className="h-7 gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
          >
            {selectingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Skip (testing) — accept all
          </Button>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : closeModal())}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-orange-500" /> AI+ Recommendations
              <span className="label-caps rounded-full bg-orange-500/10 px-2 py-0.5 text-[9px] font-semibold text-orange-600">
                Powered by AI+
              </span>
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              {HEADING[stageContext]}. AI+ is advisory — it cannot select, change or seal anything.
              You decide, and your decision is recorded against your name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {pending > 1 && (
              <div className="flex justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 rounded-full px-2.5 text-[11px]"
                  disabled={selectingAll || deciding !== null}
                  onClick={() => void decideAll("rejected")}
                >
                  <X className="h-3 w-3" />
                  Reject all
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 rounded-full px-2.5 text-[11px]"
                  disabled={selectingAll || deciding !== null}
                  onClick={() => void decideAll("accepted")}
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
              const refs = parseEvidenceRefs(p.source_references);
              const confidence = confidenceOf(refs, p.probability == null ? null : Number(p.probability));
              const structured = refs.length > 0 && refs.every((r) => !r.unspecified);
              const confirmed = refs.filter((r) => r.verified).length;
              return (
                <div key={p.id} className="rounded-xl border border-border/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="label-caps text-[10px] text-muted-foreground">
                          {p.proposal_type}
                        </span>
                        <span
                          title={
                            structured
                              ? `${confirmed} of ${refs.length} supporting facts are confirmed in the record`
                              : "Confidence as reported for this recommendation"
                          }
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            confidence === "High"
                              ? "bg-emerald-100 text-emerald-800"
                              : confidence === "Medium"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          Confidence: {confidence}
                        </span>
                        {p.related_counterparty && (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {p.related_counterparty}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-semibold">{p.output}</p>
                      {structured && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Confidence reflects how much of this rests on confirmed facts: {confirmed} of {refs.length}{" "}
                          supporting facts are confirmed in the record.
                        </p>
                      )}
                      {/* The reasoning is the point of the recommendation: it is labelled and given
                          room so the person can weigh it before accepting or rejecting. */}
                      {p.rationale && (
                        <div className="mt-2 rounded-lg bg-muted/50 p-2.5">
                          <p className="label-caps text-[10px] text-muted-foreground">
                            Why AI+ recommends this
                          </p>
                          <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-foreground">
                            {p.rationale}
                          </p>
                          {refs.length > 0 && (
                            <>
                              <p className="label-caps mt-2 text-[10px] text-muted-foreground">
                                Based on
                              </p>
                              <ul className="mt-0.5 space-y-1">
                                {refs.map((r, i) => (
                                  <li key={i} className="text-[10px] text-muted-foreground">
                                    {!r.unspecified && (
                                      <span
                                        className={cn(
                                          "mr-1 rounded px-1 py-px text-[9px] font-semibold",
                                          r.kind === "general_knowledge"
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-muted text-foreground/80",
                                        )}
                                      >
                                        {EVIDENCE_LABEL[r.kind]}
                                      </span>
                                    )}
                                    {r.chain}
                                    {r.url && (
                                      <>
                                        {" "}
                                        <a href={r.url} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                                          Source
                                        </a>
                                      </>
                                    )}
                                    {!r.unspecified && !r.verified && <span className="ml-1 italic">— not verified</span>}
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
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

          <div className="flex justify-end pt-1">
            <Button type="button" variant="outline" size="sm" onClick={closeModal}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
