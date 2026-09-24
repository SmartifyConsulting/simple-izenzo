import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, MessageSquareWarning, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getEngagement, respondToEngagement, type Side } from "@/lib/engagement.functions";

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

      {/* Once the bidder has put the offer to the counterparty, it's the counterparty's move —
          the bidder can only wait and read the thread below, not counter or reject their own
          offer. */}
      {state.decided !== "opted_out" && !isObserver && state.side === "counterparty" && (
        <div className="flex flex-wrap gap-2">
          {state.decided !== "accepted" && (
            <Button size="sm" disabled={busy !== null} onClick={() => void sendResponse("accepted")}>
              {busy === "accepted" ? "Accepting…" : "Accept"}
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setChallengeOpen(true)}>
            Counter
          </Button>
          {state.decided !== "accepted" && (
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={busy !== null}
              onClick={() => void sendResponse("opted_out")}
            >
              {busy === "opted_out" ? "Rejecting…" : "Reject"}
            </Button>
          )}
        </div>
      )}
      {state.side === "bidder" && (
        <p className="text-[11px] text-muted-foreground">
          {state.decided === "accepted"
            ? "The counterparty accepted the offer."
            : "The counterparty is evaluating your offer. They have an option to approve, counter or reject. Without a Doubt opens once they approve."}
        </p>
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
        offerBody
      ) : (
        <section className="rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <MessageSquareWarning className="h-4 w-4 text-primary" />
            <h2 className="label-caps font-sans">The Offer</h2>
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
