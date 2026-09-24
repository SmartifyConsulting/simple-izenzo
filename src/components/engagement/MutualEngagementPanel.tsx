import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, MessageSquareWarning, Repeat, XCircle } from "lucide-react";
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

  const { data: state, isLoading } = useQuery({
    queryKey: ["engagement", transactionId],
    queryFn: () => load({ data: { transactionId } }),
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["engagement", transactionId] });
    // The Live Workspace's own "whose turn" read and its Without-a-Doubt gate both key off this
    // same transaction — without refreshing it here too, accepting an offer here wouldn't open WaD
    // until the page was reloaded by hand.
    await qc.invalidateQueries({ queryKey: ["negotiation-turn", transactionId] });
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

      {/* Reads as a conversation, not a log — each reply sits on its own side (bidder left and
          green, counterparty right and blue), the same way every chat interface does, since
          that's genuinely what a back-and-forth negotiation is. */}
      {state.responses.length > 0 && (
        <ul className="space-y-2">
          {state.responses.map((r) => {
            const isBidder = r.responder_side === "bidder";
            return (
              <li className={cn("flex flex-col", isBidder ? "items-start" : "items-end")} key={r.id}>
                <div
                  className={cn(
                    "relative max-w-[85%] rounded-2xl px-3 py-2 pr-7 text-xs",
                    // A dark-default color with a theme-light: override, not a `dark:` variant —
                    // this app sets [data-theme] on <html>, not a `.dark` class, so `dark:*`
                    // utilities never actually apply here (see the theme-light custom variant in
                    // styles.css).
                    isBidder
                      ? "rounded-bl-sm bg-emerald-600/20 text-emerald-100 theme-light:text-emerald-950"
                      : "rounded-br-sm bg-[#4169e1]/25 text-blue-100 theme-light:text-[#1c2f6b]",
                  )}
                >
                  {/* What happened is a small corner icon, not a repeated line of text — the bubble
                      itself (side, colour) already carries most of that, and the words "Raised a
                      counter" on every single reply added noise without adding information. */}
                  <span
                    className="absolute right-2 top-2"
                    title={
                      r.response === "accepted"
                        ? "Accepted the offer"
                        : r.response === "challenged"
                          ? "Raised a counter"
                          : "Rejected the offer"
                    }
                  >
                    {r.response === "accepted" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 opacity-80" />
                    ) : r.response === "challenged" ? (
                      <Repeat className="h-3.5 w-3.5 opacity-80" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 opacity-80" />
                    )}
                  </span>
                  <p className="font-semibold">
                    {r.responder_name ?? sideWord(r.responder_side)}{" "}
                    <span className="font-normal opacity-70">({sideWord(r.responder_side)})</span>
                  </p>
                  {r.message && <p className="mt-1">{r.message}</p>}
                </div>
                {/* Under the bubble, left-aligned, rather than beside it. */}
                <span className="mt-0.5 text-left text-[10px] text-muted-foreground">{when(r.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Both sides now see the same three buttons — whoever's turn it isn't gets them plainly
          disabled (greyed out), whoever's turn it is gets them live — including Accept, which
          belongs to whichever side the offer is currently with, not locked to the counterparty
          (the server enforces the same turn-based rule). */}
      {!resolved && !isObserver && (
        <>
          {waitingOnOther && (
            <div className="overflow-hidden rounded-lg border border-border">
              <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground">
                Waiting for {sideWord(turnSide)} to decide — accept, counter or reject.
              </p>
              <div className="h-1 w-full animate-ribbon-sweep" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy !== null || !isMyTurn}
              onClick={() => isMyTurn && void sendResponse("accepted")}
            >
              {busy === "accepted" ? "Accepting…" : "Accept"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null || !isMyTurn}
              onClick={() => isMyTurn && setChallengeOpen(true)}
            >
              Counter
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null || !isMyTurn}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
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
            <h2 className="label-caps inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 font-sans text-[var(--lw-pill-fg)]">
              Offer
            </h2>
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
