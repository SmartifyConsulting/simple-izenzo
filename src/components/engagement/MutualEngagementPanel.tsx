import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, Loader2, MessageSquareWarning, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getEngagement,
  listSignableDocuments,
  respondToEngagement,
  setDiligenceState,
  setDocumentNeedsSignature,
  signDocument,
  type CheckState,
  type Side,
} from "@/lib/engagement.functions";
import { listVerificationsForTx, refreshVerification, startVerification, type VerificationRow } from "@/lib/didit.functions";
import { Confetti } from "@/components/effects/Confetti";

const STATE_LABEL: Record<CheckState, string> = {
  pending: "Not done yet",
  passed: "Passed",
  failed: "Not passed",
  waived: "Switched off",
};

const STATE_TONE: Record<CheckState, string> = {
  pending: "border-border bg-muted text-muted-foreground",
  passed: "border-success/40 bg-success/10 text-success",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  waived: "border-warning/40 bg-warning/15 text-warning-foreground",
};

function sideWord(side: Side) {
  return side === "bidder" ? "the bidder" : "the counterparty";
}

function when(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "";
}

/**
 * The two-way part of an engagement, on one panel: each side's KYC and KYB checks on the other,
 * the counterparty's accept / challenge / opt-out decision, and the documents both sides sign.
 * Nothing here decides anything on its own — every state change is a person's own recorded action.
 */
export function MutualEngagementPanel({ transactionId }: { transactionId: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getEngagement);
  const setState = useServerFn(setDiligenceState);
  const respond = useServerFn(respondToEngagement);
  const listDocs = useServerFn(listSignableDocuments);
  const sign = useServerFn(signDocument);
  const setNeeds = useServerFn(setDocumentNeedsSignature);
  const listVerifications = useServerFn(listVerificationsForTx);
  const startVerify = useServerFn(startVerification);
  const refreshVerify = useServerFn(refreshVerification);

  const [busy, setBusy] = useState<string | null>(null);
  const [waive, setWaive] = useState<{ check: "kyc" | "kyb" } | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState("");
  const [signing, setSigning] = useState<{ id: string; name: string } | null>(null);
  const [signerName, setSignerName] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const { data: state, isLoading } = useQuery({
    queryKey: ["engagement", transactionId],
    queryFn: () => load({ data: { transactionId } }),
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["engagement-docs", transactionId],
    queryFn: () => listDocs({ data: { transactionId } }),
    enabled: Boolean(state),
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ["identity-verifications", transactionId],
    queryFn: () => listVerifications({ data: { transactionId } }),
    enabled: Boolean(state),
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["engagement", transactionId] });
    await qc.invalidateQueries({ queryKey: ["engagement-docs", transactionId] });
    await qc.invalidateQueries({ queryKey: ["documents", transactionId] });
    await qc.invalidateQueries({ queryKey: ["identity-verifications", transactionId] });
  }

  /** My own most recent Didit check on the other side, for this check type. "My checks on the
   * counterparty" carry a subject_counterparty_id; "my checks on the bidder" (run by the
   * counterparty) don't — that's the whole deal's worth of verifications split cleanly in two,
   * without needing to know who ran each one. */
  function verificationFor(mySide: Side, check: "kyc" | "kyb"): VerificationRow | undefined {
    const checkType = check === "kyc" ? "id_document" : "kyb";
    return verifications.find((v) =>
      v.check_type === checkType && (mySide === "bidder" ? Boolean(v.subject_counterparty_id) : !v.subject_counterparty_id),
    );
  }

  function openProviderWindow(url: string) {
    const existing = popupRef.current;
    if (existing && !existing.closed) {
      existing.location.href = url;
      existing.focus();
      return;
    }
    const win = window.open(url, "izenzo-verify", "popup,width=520,height=800");
    popupRef.current = win;
    if (win) win.focus();
  }

  async function runVerification(check: "kyc" | "kyb") {
    if (isObserver) return;
    setBusy(`verify-${check}`);
    try {
      const res = await startVerify({
        data: { checkType: check === "kyc" ? "id_document" : "kyb", transactionId },
      });
      openProviderWindow(res.url);
      toast.success("Verification opened in its own window. The result lands here on its own.");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function checkVerificationResult(id: string) {
    setBusy(`refresh-${id}`);
    try {
      await refreshVerify({ data: { id } });
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading the engagement…</p>;
  if (!state) return null;

  const isObserver = state.side === "observer";
  const mine = isObserver ? undefined : state.diligence.find((d) => d.reviewer_side === state.side);
  const theirs = isObserver ? undefined : state.diligence.find((d) => d.reviewer_side !== state.side);
  const otherSide: Side = state.side === "counterparty" ? "bidder" : "counterparty";
  const otherName =
    (otherSide === "counterparty" ? state.counterpartyName : state.bidderName) ?? sideWord(otherSide);
  const bidderChecks = state.diligence.find((d) => d.reviewer_side === "bidder");
  const counterpartyChecks = state.diligence.find((d) => d.reviewer_side === "counterparty");

  async function record(check: "kyc" | "kyb", next: CheckState, reason?: string) {
    setBusy(`${check}-${next}`);
    try {
      await setState({ data: { transactionId, check, state: next, ...(reason ? { reason } : {}) } });
      await refresh();
      toast.success("Recorded.");
      setWaive(null);
      setWaiveReason("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
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
          ? "Accepted — the Business Docs frame is open for both of you."
          : response === "challenged"
            ? "Your challenge has been sent to the other party."
            : "You've opted out of this engagement.",
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function doSign() {
    if (!signing) return;
    setBusy("sign");
    try {
      const res = await sign({ data: { transactionId, documentId: signing.id, signerName: signerName.trim() } });
      await refresh();
      setSigning(null);
      setSignerName("");
      toast.success(
        res.bothSigned
          ? "Signed by both parties — the signed record is now in Bid Information."
          : "Signed. The other party still needs to sign.",
      );
      // The celebration is for the deal actually closing — every document that needed both
      // signatures has them — not for any one signature landing.
      if (res.bothSigned) {
        const fresh = await qc.fetchQuery({
          queryKey: ["engagement-docs", transactionId],
          queryFn: () => listDocs({ data: { transactionId } }),
        });
        const required = fresh.filter((d) => d.requires_signature);
        if (required.length > 0 && required.every((d) => d.fully_signed_at)) {
          setCelebrate(true);
        }
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function DiligenceCard({
    heading,
    row,
    editable,
    mySide,
  }: {
    heading: string;
    row: typeof mine;
    editable: boolean;
    /** Only meaningful when editable: which side I'm on, so the right Didit direction is opened. */
    mySide?: Side | undefined;
  }) {
    return (
      <div className="space-y-3 rounded-xl border border-border p-4">
        <p className="text-xs font-semibold">{heading}</p>
        {(["kyc", "kyb"] as const).map((check) => {
          const value = (row?.[`${check}_state`] ?? "pending") as CheckState;
          const reason = row?.[`${check}_waiver_reason`] ?? null;
          const verification = mySide ? verificationFor(mySide, check) : undefined;
          const verifyBusy = busy === `verify-${check}`;
          return (
            <div key={check} className="space-y-1.5 border-t border-border pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium">
                  {check === "kyc" ? "KYC — the people" : "KYB — the company"}
                </span>
                <Badge variant="outline" className={cn(STATE_TONE[value])}>
                  {STATE_LABEL[value]}
                </Badge>
              </div>
              {reason && <p className="text-[11px] text-muted-foreground">Reason given: {reason}</p>}
              {verification?.status === "in_progress" && (
                <p className="text-[11px] text-muted-foreground">
                  Verification in progress — the result lands here on its own once it's done.
                </p>
              )}
              {editable && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={busy !== null || value === "passed"}
                    onClick={() => void runVerification(check)}
                  >
                    {verifyBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : verification ? (
                      "Run again"
                    ) : (
                      "Verify"
                    )}
                  </Button>
                  {verification && verification.status === "in_progress" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={busy !== null}
                      aria-label="Check for a result"
                      onClick={() => void checkVerificationResult(verification.id)}
                    >
                      {busy === `refresh-${verification.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    disabled={busy !== null}
                    onClick={() => {
                      setWaive({ check });
                      setWaiveReason("");
                    }}
                  >
                    Switch off with a reason
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {row?.updated_at && (
          <p className="text-[11px] text-muted-foreground">Last updated {when(row.updated_at)}</p>
        )}
      </div>
    );
  }

  const signable = docs.filter((d) => d.requires_signature || d.signatures.length > 0 || d.fully_signed_at);
  const canManageDocs = state.decided === "accepted";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquareWarning className="h-4 w-4 text-primary" />
          <h2 className="label-caps font-sans">The Offer</h2>
        </div>
        <div className="space-y-3 p-4">
          {state.decided === "accepted" && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" /> The counterparty approved the offer — KYC/KYB checks are open
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
                      ? "approved the offer"
                      : r.response === "challenged"
                        ? "raised a challenge"
                        : "rejected the offer"}
                  </p>
                  {r.message && <p className="mt-1 text-muted-foreground">{r.message}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">{when(r.created_at)}</p>
                </li>
              ))}
            </ul>
          )}

          {state.decided !== "opted_out" && !isObserver && (
            <div className="flex flex-wrap gap-2">
              {state.side === "counterparty" && state.decided !== "accepted" && (
                <Button size="sm" disabled={busy !== null} onClick={() => void sendResponse("accepted")}>
                  {busy === "accepted" ? "Approving…" : "Approve"}
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setChallengeOpen(true)}>
                Challenge
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
              Only the counterparty can approve the offer. You can raise a challenge here and both sides keep
              replying until you reach consensus.
            </p>
          )}
          {isObserver && (
            <p className="text-[11px] text-muted-foreground">
              Administrator view is read-only. Only the bidder and counterparty can respond.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="label-caps font-sans">Checks on each other</h2>
        </div>
        <div className="space-y-3 p-4">
          {state.decided !== "accepted" ? (
            <p className="text-xs text-muted-foreground">
              Opens once the counterparty approves the offer above — KYC and KYB run on a deal that's actually
              agreed, not one still being negotiated.
            </p>
          ) : !state.counterpartyLinked ? (
            <p className="text-xs text-muted-foreground">
              The counterparty has not created an account and linked it to this deal yet. Once they do, both
              sides can run their checks here.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {otherName} has an account on this deal. Both sides run KYC and KYB on each other. A check can be
              switched off, but only with a written reason, which is kept on the record.
            </p>
          )}
          {state.decided === "accepted" && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {isObserver ? (
                  <>
                    <DiligenceCard heading="Bidder's checks on the counterparty" row={bidderChecks} editable={false} />
                    <DiligenceCard heading="Counterparty's checks on the bidder" row={counterpartyChecks} editable={false} />
                  </>
                ) : (
                  <>
                    <DiligenceCard
                      heading={`Your checks on ${otherName}`}
                      row={mine}
                      editable={state.counterpartyLinked}
                      mySide={state.side === "observer" ? undefined : state.side}
                    />
                    <DiligenceCard heading={`${otherName}'s checks on you`} row={theirs} editable={false} />
                  </>
                )}
              </div>
              {state.bothCleared && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Both sides' checks are settled.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <FileSignature className="h-4 w-4 text-primary" />
          <h2 className="label-caps font-sans">Digital Signatures</h2>
        </div>
        <div className="space-y-3 p-4">
          {!canManageDocs ? (
            <p className="text-xs text-muted-foreground">
              This opens for both sides once the counterparty has accepted the engagement.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Documents that need both parties' signature — an NDA, MOU or contract — are identified
                automatically as they're uploaded. Both sides sign the same record; once both signatures are on
                it, a tidy PDF record is filed in Bid Information, ready to open or download.
              </p>
              {docs.length === 0 && <p className="text-xs text-muted-foreground">No documents shared yet.</p>}
              <ul className="divide-y divide-border">
                {docs.map((d) => {
                  const iSigned = !isObserver && d.signatures.some((s) => s.signer_side === state.side);
                  return (
                    <li key={d.id} className="space-y-1.5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium">{d.name}</p>
                        <div className="flex items-center gap-2">
                          {d.fully_signed_at ? (
                            <Badge variant="outline" className={STATE_TONE.passed}>
                              Signed by both
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={STATE_TONE.pending}>
                              {d.signatures.length === 0 ? "Not signed" : "One signature"}
                            </Badge>
                          )}
                          {!isObserver && !d.fully_signed_at && !iSigned && (
                            <Button
                              size="sm"
                              className="h-7 text-[11px]"
                              disabled={busy !== null}
                              onClick={() => {
                                setSigning({ id: d.id, name: d.name });
                                setSignerName("");
                              }}
                            >
                              Sign
                            </Button>
                          )}
                          {!d.requires_signature && !d.fully_signed_at && state.side === "bidder" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[11px]"
                              disabled={busy !== null}
                              onClick={async () => {
                                setBusy("needs");
                                try {
                                  await setNeeds({
                                    data: { documentId: d.id, transactionId, required: true },
                                  });
                                  await refresh();
                                } catch (err) {
                                  toast.error((err as Error).message);
                                } finally {
                                  setBusy(null);
                                }
                              }}
                            >
                              Mark for signing
                            </Button>
                          )}
                        </div>
                      </div>
                      {d.signatures.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          {d.signatures
                            .map((s) => `${s.signer_name} (${sideWord(s.signer_side)}) — ${when(s.signed_at)}`)
                            .join(" · ")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {signable.length === 0 && docs.length > 0 && (
                <p className="text-[11px] text-muted-foreground">Nothing has been marked for signing yet.</p>
              )}
            </>
          )}
        </div>
      </section>

      <Dialog open={waive !== null} onOpenChange={(open) => !open && setWaive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch this check off</DialogTitle>
            <DialogDescription>
              Say why this check is not being run. Your explanation is kept on the deal record permanently.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={waiveReason}
            onChange={(e) => setWaiveReason(e.target.value)}
            rows={4}
            placeholder="Why is this check not being run?"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setWaive(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={waiveReason.trim().length < 5 || busy !== null}
              onClick={() => waive && void record(waive.check, "waived", waiveReason.trim())}
            >
              {busy?.endsWith("waived") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Switch off"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise a challenge</DialogTitle>
            <DialogDescription>
              Your message goes to the other party, who can reply here. Both of you keep replying until you reach
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
              {busy === "challenged" ? "Sending…" : "Send challenge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={signing !== null} onOpenChange={(open) => !open && setSigning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign {signing?.name}</DialogTitle>
            <DialogDescription>
              Type your full name to sign. Your name, your side of the deal and the exact date and time are stored
              on this one shared record.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
          />
          {signerName.trim().length > 1 && (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-2xl" style={{ fontFamily: "cursive" }}>
              {signerName.trim()}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSigning(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={signerName.trim().length < 2 || busy !== null} onClick={() => void doSign()}>
              {busy === "sign" ? "Signing…" : "Sign document"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {celebrate && (
        <Confetti
          message="Your trade match has been successful — every document is signed by both parties."
          onDone={() => setCelebrate(false)}
        />
      )}
    </div>
  );
}
