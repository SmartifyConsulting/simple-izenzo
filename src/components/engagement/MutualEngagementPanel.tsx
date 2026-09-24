import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, MessageSquareWarning, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getEngagement, respondToEngagement, type Side } from "@/lib/engagement.functions";
import { cn } from "@/lib/utils";

function sideWord(side: Side) {
  return side === "bidder" ? "the bidder" : "the counterparty";
}

function when(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "";
}

/**
 * The Offer: the counterparty's accept / counter / reject decision on the terms the bidder put
 * to them. Nothing here decides anything on its own — every state change is a person's own
 * recorded action.
 */
export function MutualEngagementPanel({
  transactionId,
  offerOnly = false,
}: {
  transactionId: string;
  /** Kept for callers that render this standalone, before Without a Doubt opens — there is nothing
   * else in this panel to show alongside it any more. */
  offerOnly?: boolean;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getEngagement);
  const respond = useServerFn(respondToEngagement);

  const [busy, setBusy] = useState<string | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState("");
  // Cycles 0/1/2 across Accept/Counter/Reject for whichever side is waiting on the other, so their
  // buttons read as "still in play" (like a game-show light chase) rather than just greyed out.
  const [litIndex, setLitIndex] = useState(0);

  const { data: state, isLoading } = useQuery({
    queryKey: ["engagement", transactionId],
    queryFn: () => load({ data: { transactionId } }),
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["engagement", transactionId] });
  }

  async function sendResponse(response: "accepted" | "challenged" | "opted_out", message?: string) {
    setBusy(response);
    try {
      await respond({ data: { transactionId, response, ...(message ? { message } : {}) } });
      await refresh();
      setChallengeOpen(false);
      setChallengeMessage("");
      toast.success(
        response === "accepted"
          ? "Accepted — Without a Doubt is open for both of you."
          : response === "challenged"
            ? "Your counter has been sent to the other party."
            : "You've rejected the offer.",
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Whose move it is: no responses yet means the bidder's own offer is with the counterparty;
  // otherwise it flips to whichever side didn't just raise the last counter. Accepted/rejected
  // is a resolved state, not a turn, so nothing here applies to it.
  const resolved = state?.decided === "accepted" || state?.decided === "opted_out";
  const responses = state?.responses ?? [];
  const lastResponse = responses[responses.length - 1];
  const turnSide: "bidder" | "counterparty" = !lastResponse
    ? "counterparty"
    : lastResponse.responder_side === "counterparty"
      ? "bidder"
      : "counterparty";
  const isMyTurn = state?.side === turnSide;
  const waitingOnOther = Boolean(state) && !resolved && state!.side !== "observer" && !isMyTurn;

  // The light-chase only runs while someone is actually waiting — no point animating a resolved
  // deal or a turn that's genuinely yours to act on.
  useEffect(() => {
    if (!waitingOnOther) return;
    const id = setInterval(() => setLitIndex((i) => (i + 1) % 3), 500);
    return () => clearInterval(id);
  }, [waitingOnOther]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading the engagement…</p>;
  if (!state) return null;

  const isObserver = state.side === "observer";

  const offerBody = (
    <div className="space-y-3 p-4">
      {state.decided === "accepted" && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" /> The counterparty accepted the offer — Without a Doubt is open
          below.
        </p>
      )}
      {state.decided === "opted_out" && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <XCircle className="h-4 w-4" /> A party rejected the offer — this engagement is closed.
        </p>
      )}

      {state.responses.length > 0 && (
        <ul className="space-y-2">
          {state.responses.map((r) => (
            <li key={r.id} className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">
                {r.responder_name ?? sideWord(r.responder_side)} ({sideWord(r.responder_side)}){" "}
                {r.response === "accepted"
                  ? "accepted the offer"
                  : r.response === "challenged"
                    ? "raised a counter"
                    : "rejected the offer"}
              </p>
              {r.message && <p className="mt-1 text-muted-foreground">{r.message}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">{when(r.created_at)}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Both sides now see the same three buttons — whoever's turn it isn't gets them disabled
          and light-chasing across Accept → Counter → Reject, game-show style, instead of a plain
          greyed-out row or a text-only "please wait". Whoever's turn it is gets them live — except
          Accept, which stays the counterparty's alone even on the bidder's own turn (the server
          enforces this too: only the counterparty ever finalises the deal). */}
      {!resolved && !isObserver && (
        <>
          {waitingOnOther && (
            <p className="text-[11px] text-muted-foreground">
              Waiting for {sideWord(turnSide)} to decide — accept, counter or reject.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy !== null || !isMyTurn || state.side !== "counterparty"}
              title={state.side !== "counterparty" ? "Only the counterparty can accept" : undefined}
              className={cn(waitingOnOther && litIndex === 0 && "ring-2 ring-primary ring-offset-2")}
              onClick={() => isMyTurn && state.side === "counterparty" && void sendResponse("accepted")}
            >
              {busy === "accepted" ? "Accepting…" : "Accept"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null || !isMyTurn}
              className={cn(waitingOnOther && litIndex === 1 && "ring-2 ring-primary ring-offset-2")}
              onClick={() => isMyTurn && setChallengeOpen(true)}
            >
              Counter
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null || !isMyTurn}
              className={cn(
                "border-destructive/40 text-destructive hover:bg-destructive/10",
                waitingOnOther && litIndex === 2 && "ring-2 ring-destructive ring-offset-2",
              )}
              onClick={() => isMyTurn && void sendResponse("opted_out")}
            >
              {busy === "opted_out" ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </>
      )}
      {isObserver && (
        <p className="text-[11px] text-muted-foreground">
          Administrator view is read-only. Only the bidder and counterparty can respond.
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {offerOnly ? (
        // No header here — the caller's own frame already carries the "Offer" heading — but the
        // buttons (flickering or live) still sit inside a proper bordered box of their own,
        // instead of floating bare in the parent panel.
        <div className="rounded-xl border border-border">{offerBody}</div>
      ) : (
        <section className="rounded-xl border border-border">
          <div className="flex items-center gap-2 px-4 py-3">
            <MessageSquareWarning className="h-4 w-4 text-primary" />
            <h2 className="label-caps font-sans">Offer</h2>
          </div>
          {offerBody}
        </section>
      )}

      <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make a counter</DialogTitle>
            <DialogDescription>
              Your counter goes to the other party, who can reply here. Both of you keep replying until you reach
              consensus.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={challengeMessage}
            onChange={(e) => setChallengeMessage(e.target.value)}
            rows={5}
            placeholder="What are you challenging, and what would settle it?"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setChallengeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={challengeMessage.trim().length < 3 || busy !== null}
              onClick={() => void sendResponse("challenged", challengeMessage.trim())}
            >
              {busy === "challenged" ? "Sending…" : "Send counter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
