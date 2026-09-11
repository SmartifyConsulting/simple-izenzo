import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  Download,

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
  Globe,
  Loader2,
  ExternalLink,
  RefreshCw,
  Mail,
  MailCheck,
  ShieldAlert,
  ScrollText,
  X,
} from "lucide-react";
import { CanvasNode, Connector, GateBar, type NodeState } from "./CanvasNode";
import { StepScreen } from "@/components/steps/StepScreen";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { raiseChallenge, listChallenges, type MatchChallenge } from "@/lib/challenges.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ensureOrg } from "@/lib/org";
import { FLAT_STEPS, lockReason, stepDef, stepIndex, type StageKey } from "@/lib/spine";
import { advance, money, recordEvent, when, type Transaction, type TxEvent } from "@/lib/tx";
import { setCounterpartyShortlist } from "@/lib/izenzo.functions";
import { findCounterpartyContact, inviteCounterparty, enrichCounterparty } from "@/lib/counterpartyOutreach.functions";
import type { ScreeningCheck, ScreeningResult } from "@/lib/screening.functions";
import type { MediaCheckResult, MediaFinding } from "@/lib/onlineMedia.functions";
import {
  listVerificationsForTx,
  refreshVerification,
  type VerificationRow,
} from "@/lib/didit.functions";

/** How one screening check should read on screen, folding in the live verification row when the
 * provider has since moved it on. */
function describeCheck(
  chk: ScreeningCheck,
  live?: VerificationRow,
): { label: string; detail: string; tone: string; pending: boolean } {
  const WAITING = "bg-amber-100 text-amber-800";
  const OK = "bg-emerald-100 text-emerald-800";
  const BAD = "bg-red-100 text-red-700";
  const MUTED = "bg-slate-200 text-slate-600";

  if (live) {
    switch (live.status) {
      case "passed":
        return { label: "Passed", detail: live.reason ?? "Provider returned a clear result.", tone: OK, pending: false };
      case "failed":
        return { label: "Failed", detail: live.reason ?? "Provider returned a negative result.", tone: BAD, pending: false };
      case "review":
        return {
          label: "Needs review",
          detail: live.reason ?? "A person needs to look at this result.",
          tone: WAITING,
          pending: false,
        };
      case "expired":
        return { label: "Expired", detail: "The check expired before it was completed.", tone: MUTED, pending: false };
      default:
        return {
          label: "Waiting",
          detail: "Opened with the provider — the result lands here on its own.",
          tone: WAITING,
          pending: true,
        };
    }
  }

  switch (chk.status) {
    case "started":
      return { label: "Waiting", detail: chk.detail, tone: WAITING, pending: true };
    case "matched":
      return { label: "Match found", detail: chk.detail, tone: OK, pending: false };
    case "no_match":
      return { label: "No match", detail: chk.detail, tone: MUTED, pending: false };
    case "unavailable":
      return { label: "Not connected", detail: chk.detail, tone: MUTED, pending: false };
    default:
      return { label: "Could not run", detail: chk.detail, tone: BAD, pending: false };
  }
}


import { cn } from "@/lib/utils";

// Raise a challenge / Governance record are built but hidden while they're still being worked
// out — flip this back on when they're ready to ship.
const CHALLENGES_FEATURE_ENABLED = false;

type NodeRef = { stage: StageKey; step: string; label?: string; icon?: typeof Radar };

/** Three dots that flash in sequence — a still-working signal for a progress line that can sit at
 * the same percentage for a while (online media screening in particular). */
function WorkingEllipsis() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          className="h-1 w-1 animate-ellipsis-dot rounded-full bg-current"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

// Reduce the Bid/Offer (and Documents) lanes by two grid squares (the ink-grid repeats every
// 44px) while keeping their outer edges flush with the canvas — the lane shrinks from its inner
// edge only.
const LANE_INSET = 88;

/** A non-real transaction used purely to render the full pipeline (Trading → Compliance →
 * Execution → Finality → Memory) fully ticked, so landing on the canvas with no deal yet still
 * shows the whole flowchart at a glance rather than just the "start here" button. Never inserted,
 * never saved — passed straight into DealCanvas in read-only preview mode. */
export const FLOWCHART_PREVIEW_TX: Transaction = {
  id: "preview",
  org_id: "preview",
  counterparty_org_id: null,
  title: "Izenzo Deal Engine",
  commodity: "Copper cathode",
  quantity: 100,
  unit: "Metric tonnes",
  price: 9500,
  currency: "USD",
  incoterms: "CIF Rotterdam",
  jurisdiction: "South Africa",
  // Sits at the very first step — nothing is done yet, since this preview isn't tied to any real
  // deal. It used to fake a fully-completed run instead, which read as real status for whichever
  // bid/offer the user was about to record.
  stage: "trading",
  step: "bid-offer",
  status: "open",
  intent_confirmed_at: null,
  poi_sealed_at: null,
  poi_hash: null,
  wad_completed_at: null,
  finality_sealed_at: null,
  created_at: new Date(0).toISOString(),
};

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
  readOnly,
  hideBidOfferGroups,
  focusSide,
  onBackToWorkflow,
  forceRevealAll,
  hideMatchingRibbon,
  throbStep,
  openProofOfIntent,
  screeningProgress,
  mediaProgress,
  matchProgress,

}: {
  tx: Transaction;
  reload: () => void;
  deals?: Transaction[];
  onSelectDeal?: (id: string) => void;
  /** Shows a control that returns to the empty-state "Open a bid or an offer" workflow preview
   * screen, leaving this deal selected but out of view. Omitted on the read-only preview itself. */
  onBackToWorkflow?: () => void;
  /** Renders the pipeline for display only — no node opens, nothing mutates. Used for the
   * flowchart preview shown before any real deal exists. */
  readOnly?: boolean;
  /** Hides the "{ Bid" / "{ Offer" groups — used on the read-only preview once the real
   * CanvasStart picker is active elsewhere on the page, so they don't look duplicated. */
  hideBidOfferGroups?: boolean;
  /** Once a side is picked elsewhere on the page, the preview drops all mention of the other
   * side — no Responder lane, no "Next steps" for Responder — since this deal is now Bidder-only
   * (or Responder-only). */
  focusSide?: "bid" | "offer" | null;
  /** Shows every step in the pipeline regardless of how far the transaction has actually
   * progressed — only what's visible is forced open; each node's tick/lock state still reflects
   * the real transaction, so steps ahead of the current one show as open (not done) until reached
   * in sequence. */
  forceRevealAll?: boolean;
  /** Hides the built-in "Running AI search and match…" ribbon and its counterparty results —
   * used when the caller renders its own search progress and results elsewhere on the page. */
  hideMatchingRibbon?: boolean;
  /** Trading step whose node should pulse to draw the eye to the next action, e.g. "choice"
   * once matches are in, or "media" while background screening runs. */
  throbStep?: string | null;
  /** Opens the Proof of Intent gate group without the user clicking it — used while the match
   * search runs, so the next steps are already in view when results land. */
  openProofOfIntent?: boolean;
  /** Live progress of the background screening run, drawn as a bar under that node. */
  screeningProgress?: { done: number; total: number; failed?: boolean } | null;
  /** Live progress of the online media scan, drawn as a bar under the Online Media Screening node. */
  mediaProgress?: { done: number; total: number; failed?: boolean } | null;
  /** Live progress of the counterparty match search, drawn as a bar under the Counterparties
   * node — the match count is read from the already-cached candidate list. */
  matchProgress?: { searching: boolean; error?: string | null } | null;

}) {
  const [panel, setPanel] = useState<{ stage: StageKey; step: string } | null>(null);
  const [direction, setDirection] = useState<"bid" | "offer" | null>(null);
  const stateOf = useNodeState(tx);

  // Which side placed the bid vs offer — read from the record itself (not just local `direction`
  // state, which resets on reload) so the results panel mirrors correctly at every step.
  const { data: recordedDirection } = useQuery({
    queryKey: ["bid-direction", tx.id],
    enabled: !readOnly,
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
    const nodeState = stateOf(n.stage, n.step);
    // A step that's already ticked done never pulses, no matter what the caller passes as
    // throbStep — the pulse means "look here next", which is never true of a completed step.
    const throbbing =
      Boolean(throbStep) && n.stage === "trading" && n.step === throbStep && nodeState !== "done";
    return (
      <div className={cn(throbbing && "animate-throb rounded-2xl")} key={`${n.stage}-${n.step}`}>

        <CanvasNode
          label={n.label ?? def?.label ?? n.step}
          blurb={opts?.compact ? undefined : def?.blurb}
          state={nodeState}
          icon={n.icon}
          side={opts?.side}
          note={opts?.note}
          compact={opts?.compact}
          delay={opts?.delay}
          onClick={readOnly ? undefined : () => setPanel(isOpen ? null : { stage: n.stage, step: n.step })}
        />
        {isOpen && !readOnly && (
          <InlineFrame tx={tx} stage={n.stage} step={n.step} reload={reload} onClose={() => setPanel(null)} />
        )}
      </div>
    );
  };

  // Same one-line green tick used once Proof of Intent/WaD are sealed and by Bid Creation/
  // Submission of documents on the Live Workspace panel — used here per-step (Counterparties,
  // Choice) so each collapses to a single line as soon as it's done, instead of staying a full
  // card, so everything after it moves up.
  const tickedLine = (label: string) => (
    <div key={label} className="flex items-center gap-2 text-sm text-emerald-500">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      {label}
    </div>
  );

  const poi = Boolean(tx.poi_sealed_at);
  const poiSealed = poi;
  const wad = Boolean(tx.wad_completed_at);

  const matchingPhase =
    tx.stage === "trading" && ["search", "ai", "ai-plus"].includes(tx.step);
  const pickingDirection = tx.stage === "trading" && tx.step === "bid-offer";

  // Progressive reveal: only the current step and everything already completed are shown — the
  // canvas builds itself up one frame at a time instead of exposing the whole flowchart at once.
  // While AI/AI+ matching runs, cap reveal at "documents" so those three steps collapse into a
  // single ribbon rather than three individual frames.
  const currentIdx = stepIndex(tx.stage, tx.step);
  const revealUpTo = forceRevealAll
    ? FLAT_STEPS.length - 1
    : matchingPhase
      ? stepIndex("trading", "documents")
      : currentIdx;
  const visible = (stage: StageKey, step: string) => stepIndex(stage, step) <= revealUpTo;

  const executionItems = ["entry", "preparation", "bankability", "implementation", "stakeholders"].filter(
    (s) => visible("execution", s),
  );
  const finalityItems = ["entry", "type", "evidence", "change", "validation", "record"].filter((s) =>
    visible("finality", s),
  );

  // Once the canvas is focused on one side, the remaining pipeline steps sit under that side's
  // lane at half the usual width instead of spanning the full centered column.
  const stepsBoxClass = cn(
    focusSide ? "max-w-[24rem]" : "mx-auto max-w-3xl",
    focusSide === "bid" && "mr-auto",
    focusSide === "offer" && "ml-auto",
  );

  return (
    <div className={cn("relative rounded-3xl p-3 sm:p-5", focusSide ? "" : "ink-grid border border-border")}>
      {!readOnly && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {onBackToWorkflow && (
              <button
                type="button"
                onClick={onBackToWorkflow}
                className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                ← Back to workflow
              </button>
            )}
            <p className="label-caps">Live deal engine</p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{tx.title}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{money(tx.price, tx.currency)}</p>
        </div>
      )}


      {/* Lane headers — once a side is focused elsewhere (top panel), the "Bidder"/"Responder"
          label doesn't need repeating here too; "Next steps" below is enough context. */}
      {!focusSide && (
        <div className="grid grid-cols-2 gap-4 sm:gap-8">
          <LaneHeader label="The Bid" side="left" />
          <LaneHeader label="Responder" side="right" />
        </div>
      )}
      {hideBidOfferGroups && !poiSealed && (
        <div className={cn("mt-1", !focusSide && "grid grid-cols-2 gap-4 sm:gap-8")}>
          {focusSide !== "offer" && (
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white">Next steps</p>
          )}
          {focusSide !== "bid" && (
            <p
              className={cn(
                "text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white",
                (focusSide === "offer" || !focusSide) && "text-right",
              )}
            >
              Next steps
            </p>
          )}
        </div>
      )}

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
                  label="Submit a Bid"
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
                  label="Submit an Offer"
                  blurb="State what you're supplying, at what price, and your delivery terms."
                  side="right"
                  onClick={() => setDirection("offer")}
                  examples={OFFER_EXAMPLES}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        !hideBidOfferGroups && (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:gap-8">
            <div style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
              <GateGroup title="Bid">
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
              </GateGroup>
            </div>
            <div className="ml-auto" style={{ width: `calc(100% - ${LANE_INSET}px)` }}>
              <GateGroup title="Offer">
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
              </GateGroup>
            </div>
          </div>
        )
      )}

      {!hideMatchingRibbon && matchingPhase && (tx.step === "ai" || tx.step === "ai-plus") && (
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

      {/* Once the Proof of Intent is sealed the whole gate is history: it folds down into a green
          ticked list, the way Deal Creation does, and attention moves on to Without a Doubt. */}
      {poiSealed && (
        <div className={cn("mt-3", stepsBoxClass)}>
          <GateBar label="Proof of Intent" cleared />
          <div className="space-y-1.5">
            {[
              "Counterparties surfaced",
              "Counterparty chosen",
              "Background screening complete",
              "Intent confirmed",
              "Proof of Intent sealed",
            ].map((label) => (
              <div key={label} className="flex items-center gap-2 text-xs text-emerald-500">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {!poiSealed && visible("trading", "counterparties") && (
        <>

          <Connector />
          <GateGroup
            title="Proof of Intent"
            align={focusSide === "offer" ? "right" : "left"}
            forceOpen={Boolean(openProofOfIntent)}
          >
            <div className={cn(stepsBoxClass, "space-y-3")}>
              {stateOf("trading", "counterparties") === "done" ? (
                tickedLine("Counterparties")
              ) : (
                <div>
                  {node({ stage: "trading", step: "counterparties", icon: Users }, { side: "center" })}
                  {/* Once the search finishes cleanly, the node's own "done" tick already says
                      everything the progress bar was saying — same treatment as the Bid/Offer node
                      once it's registered — so the bar clears rather than lingering under it. */}
                  {matchProgress && (matchProgress.searching || matchProgress.error) && (
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            matchProgress.searching
                              ? "w-1/2 animate-ribbon-sweep bg-primary"
                              : "w-full bg-destructive",
                          )}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {matchProgress.searching
                          ? "Searching for counterparties…"
                          : `Search could not finish: ${matchProgress.error}`}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {visible("trading", "choice") &&
                (stateOf("trading", "choice") === "done"
                  ? tickedLine("Choice")
                  : node({ stage: "trading", step: "choice", icon: MousePointerClick }, { side: "center" }))}
              {visible("trading", "online-media") &&
                (stateOf("trading", "online-media") === "done" ? (
                  tickedLine("Online Media Screening")
                ) : (
                <div>
                  {node(
                    { stage: "trading", step: "online-media", icon: Globe },
                    { side: "center", compact: true, note: "Surface Routes/Paths" },
                  )}
                  {mediaProgress && mediaProgress.total > 0 && (
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            mediaProgress.failed ? "bg-destructive" : "bg-info",
                          )}
                          style={{
                            width: `${Math.round((mediaProgress.done / mediaProgress.total) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>
                          {mediaProgress.failed
                            ? "Online media screening could not finish"
                            : mediaProgress.done < mediaProgress.total
                              ? `${Math.round((mediaProgress.done / mediaProgress.total) * 100)}% — ${mediaProgress.done} of ${mediaProgress.total} sources scanned`
                              : `Online media screening complete — ${mediaProgress.total} sources scanned`}
                        </span>
                        {!mediaProgress.failed && mediaProgress.done < mediaProgress.total && <WorkingEllipsis />}
                      </p>
                    </div>
                  )}
                </div>
                ))}
              {visible("trading", "media") &&
                (stateOf("trading", "media") === "done" ? (
                  tickedLine("Background Screening")
                ) : (
                <div>
                  {node(
                    { stage: "trading", step: "media", label: "Background screening", icon: Newspaper },
                    { side: "center", compact: true, note: "runs quietly" },
                  )}
                  {screeningProgress && screeningProgress.total > 0 && (
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            screeningProgress.failed ? "bg-destructive" : "bg-info",
                          )}
                          style={{
                            width: `${Math.round((screeningProgress.done / screeningProgress.total) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>
                          {screeningProgress.failed
                            ? "Screening could not finish"
                            : screeningProgress.done < screeningProgress.total
                              ? `${Math.round((screeningProgress.done / screeningProgress.total) * 100)}% — ${screeningProgress.done} of ${screeningProgress.total} checks opened`
                              : `Screening complete — all ${screeningProgress.total} checks opened`}
                        </span>
                        {!screeningProgress.failed && screeningProgress.done < screeningProgress.total && (
                          <WorkingEllipsis />
                        )}
                      </p>


                    </div>
                  )}
                </div>
                ))}
              {visible("trading", "intent") &&
                node({ stage: "trading", step: "intent", icon: Handshake }, { side: "center" })}
              {visible("trading", "poi") &&
                node(
                  { stage: "trading", step: "poi", icon: ShieldCheck },
                  { side: "center", note: "1 token · USD 10" },
                )}
            </div>
            {visible("trading", "poi") && (
              <div className={stepsBoxClass}>
                <GateBar label="Proof of Intent" cleared={poi} />
              </div>
            )}
          </GateGroup>
        </>
      )}

      {/* Once Without a Doubt has cleared it folds away too — a green ticked list of what was
          screened, with attention moving on to Execution. */}
      {wad && (
        <div className={cn("mt-3", stepsBoxClass)}>
          <GateBar label="Without a Doubt" cleared />
          <div className="space-y-1.5">
            {[
              "KYC — individuals identified",
              "KYB — entity verified",
              "UBO — beneficial owners established",
              "Sanctions screening clear",
              "PEP screening reviewed",
              "Authority to act confirmed",
              "Without a Doubt cleared",
              "Clearance certificate filed",
            ].map((label) => (
              <div key={label} className="flex items-center gap-2 text-xs text-emerald-500">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {!wad && visible("compliance", "wad") && (
        <>
          {poiSealed && (
            <p
              className={cn(
                "mt-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white",
                focusSide === "offer" && "text-right",
              )}
            >
              Next steps
            </p>
          )}
          <GateGroup
            title="Without a Doubt"
            align={focusSide === "offer" ? "right" : "left"}
            forceOpen={poiSealed}
            pulse={poiSealed}
          >
            <div className={stepsBoxClass}>
              {node(
                { stage: "compliance", step: "wad", icon: ShieldCheck },
                { side: "center", note: "3 tokens · USD 30" },
              )}
            </div>
            <div className={stepsBoxClass}>
              <GateBar label="Without a Doubt" cleared={wad} />
            </div>
          </GateGroup>
        </>
      )}


      {executionItems.length > 0 && (
        <>
          {wad && (
            <p
              className={cn(
                "mt-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white",
                focusSide === "offer" && "text-right",
              )}
            >
              Next steps
            </p>
          )}
          <GateGroup
            title="Execution"
            align={focusSide === "offer" ? "right" : "left"}
            forceOpen={wad}
            pulse={wad && stateOf("execution", "entry") !== "done"}
          >
            <div className={cn("grid gap-3", focusSide ? cn("grid-cols-1", stepsBoxClass) : "sm:grid-cols-3")}>
              {executionItems.map((s) => (
                <div
                  key={`exec-${s}`}
                  className={cn(
                    wad && s === "entry" && stateOf("execution", "entry") !== "done" && "animate-throb rounded-2xl",
                  )}
                >
                  {node({ stage: "execution", step: s, icon: Hammer }, { compact: true })}
                </div>
              ))}
            </div>
          </GateGroup>
        </>
      )}


      {finalityItems.length > 0 && (
        <GateGroup title="Finality" align={focusSide === "offer" ? "right" : "left"}>
          <div className={cn("grid gap-3", focusSide ? cn("grid-cols-1", stepsBoxClass) : "sm:grid-cols-3")}>
            {finalityItems.map((s) => node({ stage: "finality", step: s, icon: Landmark }, { compact: true }))}
          </div>
        </GateGroup>
      )}

      {visible("memory", "ledger") && (
        <GateGroup title="Memory" align={focusSide === "offer" ? "right" : "left"}>
          <div className={stepsBoxClass}>
            {node({ stage: "memory", step: "ledger", icon: BookLock }, { side: "center" })}
          </div>
        </GateGroup>
      )}
    </div>
  );
}

/** The deal ticker at the top of the canvas: stays put when every deal already fits the row's
 * width, and only starts auto-scrolling once there are more deals than fit — never shows a
 * scrollbar either way. */
/** A step's completion form, rendered inline right where its node sits — continuing the canvas
 * as a frame rather than popping up as a modal window. */
export function InlineFrame({
  tx,
  stage,
  step,
  reload,
  onClose,
  onChangeParty,
}: {
  tx: Transaction;
  stage: StageKey;
  step: string;
  reload: () => void;
  onClose: () => void;
  /** Offered on Intent and Proof of Intent (before the seal is paid for) so a user who changes
   * their mind can reopen the counterparty choice instead of being stuck with their first pick. */
  onChangeParty?: (() => void) | undefined;
}) {
  const def = stepDef(stage, step);
  const locked = lockReason(stage, step, tx);
  const canChangeParty =
    Boolean(onChangeParty) && !tx.poi_sealed_at && (step === "intent" || step === "poi");
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
      {canChangeParty && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="mt-4 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Choose a different party
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Choose a different party?</AlertDialogTitle>
              <AlertDialogDescription>
                The party you picked is released and the counterparty list opens again. Nothing that
                has already been screened is lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep this party</AlertDialogCancel>
              <AlertDialogAction onClick={() => onChangeParty?.()}>
                Reopen the list
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
  contact_email?: string | null;
  website?: string | null;
  phone?: string | null;
  invited_at?: string | null;
};

/** Same "Record" panel as `SelectionRecord`, but for the AI/AI+ search results phase: each
 * candidate gets a checkbox so a bidder (or responder) can mark who they're interested in, without
 * yet making the single final pick (that stays ChoiceStep's job). */
function mediaTone(status: MediaFinding["status"]) {
  switch (status) {
    case "adverse":
      return "bg-red-100 text-red-700";
    case "found":
      return "bg-emerald-100 text-emerald-800";
    case "failed":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-200 text-slate-600";
  }
}

function mediaLabel(status: MediaFinding["status"]) {
  switch (status) {
    case "adverse":
      return "Review";
    case "found":
      return "Clear";
    case "not_found":
      return "Nothing found";
    case "unavailable":
      return "Not connected";
    default:
      return "Could not scan";
  }
}

export function CounterpartyRecord({
  txId,
  searching = false,
  error = null,
  onContinue,
  screening = false,
  screeningResults = null,
  mediaRunning = false,
  mediaResults = null,
  onMediaContinue,
  onFinalize,
  finalizing = false,
}: {
  txId?: string | null;
  /** True while the AI/AI+ search is still running, so the panel polls for freshly saved rows. */
  searching?: boolean;
  error?: string | null;
  /** Fires the background screening for the ticked counterparties. */
  onContinue?: (counterpartyIds: string[]) => void;
  /** True while those screening checks are being opened with the providers. */
  screening?: boolean;
  screeningResults?: ScreeningResult[] | null;
  /** True while the open-web / social media scan is running. */
  mediaRunning?: boolean;
  mediaResults?: MediaCheckResult[] | null;
  /** Fires the background screening once the media findings have been read. */
  onMediaContinue?: (counterpartyIds: string[]) => void;
  /** Fires once the user has picked the single counterparty to actually trade with,
   * once screening has come back. */
  onFinalize?: (counterpartyId: string) => void;
  /** True while that final pick is being recorded and the step is advancing to Intent. */
  finalizing?: boolean;
}) {
  const qc = useQueryClient();
  const setShortlist = useServerFn(setCounterpartyShortlist);
  const findContact = useServerFn(findCounterpartyContact);
  const sendInvite = useServerFn(inviteCounterparty);
  const enrichContact = useServerFn(enrichCounterparty);
  const raiseChallengeFn = useServerFn(raiseChallenge);
  const listChallengesFn = useServerFn(listChallenges);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const [challengeSubject, setChallengeSubject] = useState("");
  const [challengeSummary, setChallengeSummary] = useState("");
  const [challengeBusy, setChallengeBusy] = useState(false);

  const { data: challenges = [] } = useQuery({
    queryKey: ["challenges", txId],
    enabled: !!txId,
    queryFn: () => listChallengesFn({ data: { transactionId: txId as string } }),
  });
  const openChallenge = challenges.find((c) => c.status === "open");

  async function submitChallenge() {
    if (!txId || challengeSubject.trim().length === 0 || challengeSummary.trim().length < 60) return;
    setChallengeBusy(true);
    try {
      await raiseChallengeFn({
        data: { transactionId: txId, subject: challengeSubject.trim(), summary: challengeSummary.trim() },
      });
      toast.success("Challenge raised — progression on this match is paused.");
      setChallengeOpen(false);
      setChallengeSubject("");
      setChallengeSummary("");
      qc.invalidateQueries({ queryKey: ["challenges", txId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setChallengeBusy(false);
    }
  }
  // Collapsed automatically the moment background screening takes over, so the panel doesn't keep
  // showing both sets of findings at once — still reachable by hand via the header toggle.
  const [mediaExpanded, setMediaExpanded] = useState(true);
  const movedToScreening = screening || screeningResults !== null;
  useEffect(() => {
    if (movedToScreening) setMediaExpanded(false);
  }, [movedToScreening]);

  // Each company's own findings start collapsed too — expand one at a time by clicking its name,
  // rather than every company's full check list stacking up at once.
  const [expandedMediaCos, setExpandedMediaCos] = useState<Set<string>>(new Set());
  const [expandedScreeningCos, setExpandedScreeningCos] = useState<Set<string>>(new Set());
  function toggleCo(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  const { data: candidates = [] } = useQuery({
    queryKey: ["counterparties", txId],
    enabled: !!txId,
    refetchInterval: searching ? 1500 : false,
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from("counterparties")
        .select("*")
        .eq("transaction_id", txId as string)
        .order("score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      return (data ?? []) as unknown as CounterpartyCandidate[];
    },
  });

  // Follow the stored verification rows for this deal so a check that finishes (or a webhook that
  // lands minutes later) updates the line in place, without re-running the screening.
  const listVerifications = useServerFn(listVerificationsForTx);
  const refreshOne = useServerFn(refreshVerification);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const trackedIds = (screeningResults ?? []).flatMap((r) =>
    r.checks.map((c) => c.verificationId).filter(Boolean),
  ) as string[];
  const { data: verifications = [] } = useQuery({
    queryKey: ["tx-verifications", txId],
    enabled: !!txId && trackedIds.length > 0,
    refetchInterval: 8000,
    queryFn: () => listVerifications({ data: { transactionId: txId as string } }),
  });
  const verificationById = new Map(verifications.map((v) => [v.id, v]));

  async function refreshCheck(id: string) {
    setRefreshingId(id);
    try {
      await refreshOne({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["tx-verifications", txId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRefreshingId(null);
    }
  }



  const ticked = candidates.filter((c) => c.shortlisted).map((c) => c.id);
  // Once Continue has been clicked (screening running or already back), only the counterparties
  // that were actually ticked stay on screen — that's the only list still relevant, and it frees
  // up room for the screening findings below it.
  const continued = mediaRunning || mediaResults !== null || screening || screeningResults !== null;
  const visibleCandidates = continued ? candidates.filter((c) => c.shortlisted) : candidates;

  function downloadFindingsPdf() {
    if (!screeningResults || screeningResults.length === 0) return;
    void (async () => {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      let page = doc.addPage([595, 842]);
      let y = 800;
      const drawLine = (text: string, opts: { size?: number; bold?: boolean } = {}) => {
        if (y < 60) {
          page = doc.addPage([595, 842]);
          y = 800;
        }
        page.drawText(text, {
          x: 50,
          y,
          size: opts.size ?? 10,
          font: opts.bold ? bold : font,
          color: rgb(0, 0, 0),
        });
        y -= (opts.size ?? 10) + 6;
      };

      drawLine("Background screening findings", { size: 16, bold: true });
      y -= 8;
      drawLine(`Generated ${new Date().toLocaleString()}`, { size: 9 });
      y -= 10;

      for (const r of screeningResults) {
        drawLine(r.name, { size: 12, bold: true });
        for (const chk of r.checks) {
          const status =
            chk.status === "started"
              ? "in progress"
              : chk.status === "matched"
                ? "match found"
                : chk.status === "no_match"
                  ? "no match"
                  : chk.status === "unavailable"
                    ? "not connected"
                    : "could not run";
          drawLine(`  ${chk.label}: ${status} — ${chk.detail}`, { size: 10 });
        }
        y -= 6;
      }

      const bytes = await doc.save();
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const blob = new Blob([buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "background-screening-findings.pdf";
      a.click();
      URL.revokeObjectURL(url);
    })();
  }

  async function toggle(c: CounterpartyCandidate, next: boolean) {
    qc.setQueryData<CounterpartyCandidate[]>(["counterparties", txId], (prev) =>
      (prev ?? []).map((row) => (row.id === c.id ? { ...row, shortlisted: next } : row)),
    );
    try {
      await setShortlist({ data: { counterpartyId: c.id, shortlisted: next } });
      // Every filtering choice — not just the final pick — is recorded, so Memory carries the
      // whole trail of who this bidder/responder considered and ruled in or out, not just the end
      // result. That's what lets the ledger teach behaviour and decision instinct later.
      if (txId) {
        void recordEvent({
          transactionId: txId,
          stage: "trading",
          step: "counterparties",
          action: next ? "counterparty_shortlisted" : "counterparty_unshortlisted",
          summary: `${next ? "Shortlisted" : "Removed"} ${c.name}`,
          payload: { counterpartyId: c.id, name: c.name, score: c.score },
        });
      }
      // Fire-and-forget: pull website/contact details for this candidate the moment they're
      // shortlisted, either straight off their platform org profile or via a best-effort web
      // lookup. Never blocks the tick itself, and never surfaces as an error if it can't find
      // anything.
      if (next) {
        void enrichContact({ data: { counterpartyId: c.id } })
          .then(() => qc.invalidateQueries({ queryKey: ["counterparties", txId] }))
          .catch(() => {});
      }
    } catch (err) {
      toast.error((err as Error).message);
      qc.invalidateQueries({ queryKey: ["counterparties", txId] });
    }
  }

  /** Invites a counterparty who isn't signed up yet — finds a real contact email on their own
   * public website (only one actually printed there, never guessed) if we don't have one on file,
   * then sends the invite through Resend. */
  async function inviteCandidate(c: CounterpartyCandidate) {
    setInvitingId(c.id);
    try {
      let email = c.contact_email ?? null;
      if (!email) {
        const website = window.prompt(`${c.name}'s website (used only to read a public contact email):`);
        if (!website) return;
        const result = await findContact({ data: { counterpartyId: c.id, website } });
        email = result.email;
        qc.setQueryData<CounterpartyCandidate[]>(["counterparties", txId], (prev) =>
          (prev ?? []).map((row) => (row.id === c.id ? { ...row, contact_email: email } : row)),
        );
        if (!email) {
          toast.error(`No contact email found on ${c.name}'s website.`);
          return;
        }
      }
      await sendInvite({ data: { counterpartyId: c.id } });
      qc.setQueryData<CounterpartyCandidate[]>(["counterparties", txId], (prev) =>
        (prev ?? []).map((row) => (row.id === c.id ? { ...row, invited_at: new Date().toISOString() } : row)),
      );
      toast.success(`Invite sent to ${c.name}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setInvitingId(null);
    }
  }

  // Screening is done once every ticked counterparty has a result and nothing is still running —
  // that's the moment the user can pick which one they actually want to trade with.
  const screeningDone = !screening && screeningResults !== null && screeningResults.length > 0;

  return (
    <div
      className="rounded-2xl border-2 border-primary bg-slate-100 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="label-caps text-black">
          {screeningDone
            ? "Tick who you want to trade with"
            : continued
              ? "Selected counterparties"
              : "Tick counterparties of interest to continue"}
        </p>
        {CHALLENGES_FEATURE_ENABLED && txId && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setGovernanceOpen(true)}
              title="View governance record"
              className="flex items-center gap-1 rounded p-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            >
              <ScrollText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Governance record</span>
            </button>
            <button
              type="button"
              onClick={() => setChallengeOpen(true)}
              title="Raise a challenge"
              className="flex items-center gap-1 rounded p-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 hover:text-destructive"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Raise a challenge</span>
            </button>
          </div>
        )}
      </div>

      {CHALLENGES_FEATURE_ENABLED && openChallenge && (
        <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5">
          <p className="text-xs font-semibold text-destructive">
            Progression paused — challenge open: {openChallenge.subject}
          </p>
          <p className="mt-0.5 text-[11px] text-destructive/80">{openChallenge.summary}</p>
        </div>
      )}

      {candidates.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          {searching
            ? "Searching for counterparties…"
            : error
              ? `Search could not finish: ${error}`
              : "No matches found yet — run the search again."}
        </p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {visibleCandidates.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <Checkbox
                id={`shortlist-${c.id}`}
                checked={screeningDone ? pickedId === c.id : Boolean(c.shortlisted)}
                onCheckedChange={(v) =>
                  screeningDone ? setPickedId(v ? c.id : null) : toggle(c, Boolean(v))
                }
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
                {(c.website || c.contact_email || c.phone) && (
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                    {[c.website, c.contact_email, c.phone].filter(Boolean).join(" · ")}
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={() => inviteCandidate(c)}
                disabled={invitingId === c.id}
                title={
                  c.invited_at
                    ? `Invited ${new Date(c.invited_at).toLocaleDateString()} — send again`
                    : "Not on the platform yet — email them an invite"
                }
                className="mt-0.5 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
              >
                {invitingId === c.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : c.invited_at ? (
                  <MailCheck className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* The match-search progress bar lives under the Counterparties node on the diagram. */}



      {mediaRunning && !mediaResults && (
        <p className="mt-3 border-t border-slate-300 pt-3 text-xs text-slate-600">
          Scanning LinkedIn, Facebook, TikTok, marketplaces and news…
        </p>
      )}

      {mediaResults && mediaResults.length > 0 && (
        <div className="mt-3 space-y-2.5 border-t border-slate-300 pt-3">
          <button
            type="button"
            onClick={() => setMediaExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2"
          >
            <span className="label-caps text-slate-600">Online media screening</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                mediaExpanded && "rotate-180",
              )}
            />
          </button>
          {mediaExpanded && mediaResults.map((m) => {
            const coOpen = expandedMediaCos.has(m.counterpartyId);
            return (
            <div key={m.counterpartyId} className="rounded-xl border border-slate-300 bg-white p-3">
              <button
                type="button"
                onClick={() => toggleCo(expandedMediaCos, setExpandedMediaCos, m.counterpartyId)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="text-sm font-semibold text-slate-900">{m.name}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                    coOpen && "rotate-180",
                  )}
                />
              </button>
              {coOpen && (
              <ul className="mt-2 divide-y divide-slate-200">
                {m.findings.map((f) => (
                  <li key={f.source} className="py-1.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-800">{f.label}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          mediaTone(f.status),
                        )}
                      >
                        {mediaLabel(f.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 break-words text-[11px] leading-snug text-slate-500">
                      {f.detail}
                    </p>
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Open source
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              )}
            </div>
            );
          })}
        </div>
      )}

      {screeningResults && screeningResults.length > 0 && (
        <div className="mt-3 space-y-2.5 border-t border-slate-300 pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="label-caps text-slate-600">Background screening</p>
            <button
              type="button"
              onClick={downloadFindingsPdf}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              Download PDF
            </button>
          </div>
          {screeningResults.map((r) => {
            const cand = candidates.find((c) => c.id === r.counterpartyId);
            const coOpen = expandedScreeningCos.has(r.counterpartyId);
            return (
              <div key={r.counterpartyId} className="rounded-xl border border-slate-300 bg-white p-3">
                <button
                  type="button"
                  onClick={() => toggleCo(expandedScreeningCos, setExpandedScreeningCos, r.counterpartyId)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                    {cand?.score != null && (
                      <Badge variant="secondary" className="font-normal">
                        {cand.score}/100
                      </Badge>
                    )}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                      coOpen && "rotate-180",
                    )}
                  />
                </button>
                {coOpen && (
                <ul className="mt-2 divide-y divide-slate-200">
                  {r.checks.map((chk) => {
                    const live = chk.verificationId ? verificationById.get(chk.verificationId) : undefined;
                    const view = describeCheck(chk, live);
                    return (
                      <li key={chk.kind} className="py-1.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-800">{chk.label}</span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              view.tone,
                            )}
                          >
                            {view.label}
                          </span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-line break-words text-[11px] leading-snug text-slate-500">
                          {view.detail}
                        </p>
                        {(chk.url || (chk.verificationId && view.pending)) && (
                          <div className="mt-1 flex items-center gap-3">
                            {chk.url && (
                              <a
                                href={chk.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" /> Open check
                              </a>
                            )}
                            {chk.verificationId && view.pending && (
                              <button
                                type="button"
                                onClick={() => refreshCheck(chk.verificationId as string)}
                                disabled={refreshingId === chk.verificationId}
                                className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:underline disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={cn(
                                    "h-3 w-3",
                                    refreshingId === chk.verificationId && "animate-spin",
                                  )}
                                />
                                Refresh
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                )}
              </div>
            );
          })}
        </div>
      )}


      {screeningDone && onFinalize ? (
        <Button
          type="button"
          className={cn(
            "mt-3 w-full bg-info text-white hover:bg-info/90",
            !pickedId && !finalizing && "bg-slate-300 text-slate-700 hover:bg-slate-300 disabled:opacity-100",
          )}
          disabled={finalizing || !pickedId}
          onClick={() => pickedId && onFinalize(pickedId)}
        >
          {finalizing
            ? "Recording your choice…"
            : pickedId
              ? "Continue"
              : "Tick who you want to trade with"}
        </Button>
      ) : mediaResults && !screening && !screeningResults && onMediaContinue ? (
        <Button
          type="button"
          className={cn(
            "mt-3 w-full bg-info text-white hover:bg-info/90",
            ticked.length === 0 && "bg-slate-300 text-slate-700 hover:bg-slate-300 disabled:opacity-100",
          )}
          disabled={ticked.length === 0}
          onClick={() => onMediaContinue(ticked)}
        >
          {ticked.length === 0
            ? "Tick who to take through screening"
            : `Continue to background screening with ${ticked.length} counterpart${ticked.length === 1 ? "y" : "ies"}`}
        </Button>
      ) : (
        onContinue &&
        candidates.length > 0 &&
        !searching &&
        !continued && (
          <Button
            type="button"
            className={cn(
              "mt-3 w-full bg-info text-white hover:bg-info/90",
              ticked.length === 0 && "bg-slate-300 text-slate-700 hover:bg-slate-300 disabled:opacity-100",
            )}
            disabled={ticked.length === 0}
            onClick={() => onContinue(ticked)}
          >
            {ticked.length === 0
              ? "Tick a counterparty to continue"
              : `Run online media screening on ${ticked.length} counterpart${ticked.length === 1 ? "y" : "ies"}`}
          </Button>
        )
      )}

      <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
        <DialogContent className="glass max-w-md">
          <DialogTitle>Raise a challenge on this match</DialogTitle>
          <DialogDescription>
            Pause progression on this match while the parties resolve a concern. The other side and
            platform administrators will be able to see this challenge.
          </DialogDescription>
          <div className="space-y-1.5">
            <Label htmlFor="challenge-subject">Subject</Label>
            <Select value={challengeSubject} onValueChange={setChallengeSubject}>
              <SelectTrigger id="challenge-subject">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Counterparty details incorrect">Counterparty details incorrect</SelectItem>
                <SelectItem value="Score or rationale disputed">Score or rationale disputed</SelectItem>
                <SelectItem value="Screening result disputed">Screening result disputed</SelectItem>
                <SelectItem value="Suspected duplicate match">Suspected duplicate match</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="challenge-summary">Summary (60–2000 characters)</Label>
            <Textarea
              id="challenge-summary"
              rows={5}
              placeholder="Describe the concern in clear, factual terms. Include what is incorrect, what you expected, and what you would like to happen next."
              value={challengeSummary}
              onChange={(e) => setChallengeSummary(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">{challengeSummary.length} / 2000</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChallengeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={challengeBusy || !challengeSubject || challengeSummary.trim().length < 60}
              onClick={submitChallenge}
            >
              {challengeBusy ? "Raising…" : "Raise challenge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={governanceOpen} onOpenChange={setGovernanceOpen}>
        <DialogContent className="glass max-w-md">
          <DialogTitle>Governance record</DialogTitle>
          <DialogDescription>Every challenge raised on this match, in order.</DialogDescription>
          {challenges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No challenges have been raised on this match.</p>
          ) : (
            <ul className="max-h-80 space-y-3 overflow-y-auto">
              {challenges.map((c: MatchChallenge) => (
                <li key={c.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{c.subject}</p>
                    <Badge variant={c.status === "open" ? "outline" : "secondary"} className="text-[10px]">
                      {c.status === "open" ? "Open" : "Resolved"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.summary}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{new Date(c.raised_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
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
      <span className="mt-1 block truncate text-[11px] text-muted-foreground/80">
        Try: {examples.map((e) => `"${e}"`).join("  ")}
      </span>
    </button>
  );
}

function LaneHeader({
  label,
  side,
  className,
}: {
  label: string;
  side: "left" | "right";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "label-caps flex items-center gap-2 text-primary/80",
        side === "right" && "flex-row-reverse",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-signal-pulse" />
      {label}
    </p>
  );
}

/** A gate's steps, collapsible behind a large brace — click the +/- label to fold the whole
 * gate down to just its heading, or open it back up to see every step inside. */
function GateGroup({
  title,
  children,
  defaultOpen = false,
  align = "left",
  forceOpen = false,
  pulse = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** "right" mirrors the whole group — brace, title, and steps — onto the right edge, for use
   * once the canvas is focused on the Responder side. */
  align?: "left" | "right";
  /** Opens the group from outside, e.g. while the match search is running. */
  forceOpen?: boolean;
  /** Draws attention to the group as the one thing left to do. */
  pulse?: boolean;
}) {

  const [open, setOpen] = useState(defaultOpen);
  // A caller can force the group open (the search flow does this for Proof of Intent); the user
  // can still collapse it again afterwards.
  const [forcedFor, setForcedFor] = useState(false);
  useEffect(() => {
    if (forceOpen && !forcedFor) {
      setForcedFor(true);
      setOpen(true);
    }
    if (!forceOpen && forcedFor) setForcedFor(false);
  }, [forceOpen, forcedFor]);

  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-3",
        align === "right" && "flex-row-reverse",
        pulse && "animate-throb rounded-md border border-primary/60 p-2",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex shrink-0 items-start gap-2 text-left"
      >
        <span
          aria-hidden
          className="select-none font-serif text-4xl leading-[0.6] text-muted-foreground/50"
        >
          {"{"}
        </span>
        <span className="label-caps mt-1.5 text-muted-foreground transition-colors hover:text-foreground">
          {open ? "−" : "+"}
          {title}
        </span>
      </button>
      {open && <div className="min-w-0 flex-1 space-y-3">{children}</div>}
    </div>
  );
}


/** Shown on the canvas when there is nothing to work on yet. Clicking the card reveals the Bid
 * and Offer frames inline — nothing else on the flowchart shows until one of them is opened and
 * completed, at which point the parent (given the new transaction id) switches to the real
 * DealCanvas, which then reveals its own next frame the same way. */
export type RecordedActivity = {
  direction: "bid" | "offer";
  title: string;
  commodity: string | null;
  quantity: string | null;
  unit: string | null;
  price: string | null;
  currency: string;
  time: string;
  /** A unique reference for this bid/offer — BID9088778.../OFF8979667... — generated once when
   * recorded and shown for the rest of the deal's life on screen. */
  reference: string;
};

const BID_REFERENCE_BASE = 9088778;
const OFFER_REFERENCE_BASE = 8979667;

function nextReference(direction: "bid" | "offer") {
  const base = direction === "bid" ? BID_REFERENCE_BASE : OFFER_REFERENCE_BASE;
  const unique = base + Math.floor(Math.random() * 1000);
  return `${direction === "bid" ? "BID" : "OFF"}${unique}`;
}

export function CanvasStart({
  onCreated,
  onPickingChange,
  onDirectionChange,
  initialDirection,
}: {
  onCreated: (tx: Transaction, activity: RecordedActivity) => void;
  /** Fires whenever picking starts/stops, so the caller can hide anything that would look like a
   * duplicate of this card (e.g. the read-only flowchart preview) while it's active. */
  onPickingChange?: (picking: boolean) => void;
  /** Fires whenever the bid/offer side is picked or cleared. */
  onDirectionChange?: (direction: "bid" | "offer" | null) => void;
  /** Opens straight into the Bid or Offer form on mount instead of the picker — used when a
   * caller elsewhere on the page (e.g. the Mahjong diagram's "Register Bid/Offer" nodes) already
   * decided which side the user wants. */
  initialDirection?: "bid" | "offer" | null;
}) {
  const { org, orgs, user, profile, refresh } = useAuth();
  // Which company this bid/offer is traded as — only shown as a choice when the user belongs to
  // more than one; otherwise the account's default org is used without asking.
  const [companyId, setCompanyId] = useState<string | null>(null);
  const activeCompanyId = companyId ?? org?.id ?? null;
  const [picking, setPickingState] = useState(Boolean(initialDirection));
  const setPicking = (v: boolean) => {
    setPickingState(v);
    onPickingChange?.(v);
  };
  const [direction, setDirectionState] = useState<"bid" | "offer" | null>(initialDirection ?? null);
  const setDirection = (v: "bid" | "offer" | null) => {
    setDirectionState(v);
    onDirectionChange?.(v);
  };
  // Title/commodity/quantity/price used to be captured here — they're now read off the uploaded
  // documents by AI instead, so the only thing this first screen still asks for is the ID Number.
  const [form, setForm] = useState({ idNumber: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialDirection) {
      onPickingChange?.(true);
      onDirectionChange?.(initialDirection);
    }
    // Only meant to sync the caller once, from the initial mount value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!direction) return;
    if (!user) {
      toast.error("Sign in to record a bid or offer");
      return;
    }
    setBusy(true);
    try {
      // Some accounts (Google sign-up, or older ones) never got an organisation — provision a
      // personal one on the fly instead of blocking here, same as new individual sign-ups do.
      // Otherwise trade as whichever company was picked (or the account's default, when there's
      // only one).
      const activeOrg =
        orgs.find((o) => o.id === activeCompanyId) ??
        org ??
        (await ensureOrg(user.id, profile?.full_name ?? user.email ?? "My account"));
      if (!org) void refresh();

      // Generated once, up front, so the same value goes onto the row (visible in Trades/reports)
      // and into local `activity` (shown on this screen for the rest of the session).
      const reference = nextReference(direction);

      const baseRow = {
        org_id: activeOrg.id,
        stage: "trading",
        step: "bid-offer",
        // A placeholder until the AI summary of the uploaded documents fills in the real title —
        // there's nothing else to name it from at this point.
        title: direction === "bid" ? "New buy bid" : "New sell offer",
        commodity: null,
        quantity: null,
        unit: null,
        price: null,
        currency: "USD",
      };

      let { data: newTx, error } = await supabase
        .from("transactions")
        .insert({ ...baseRow, reference } as never)
        .select()
        .single();
      // The `reference` column's migration hasn't reached every environment yet — fall back to
      // inserting without it rather than losing the whole bid/offer (the display already falls
      // back to a deterministic computed reference for this case).
      const referenceColumnMissing =
        error?.code === "42703" || error?.code === "PGRST204" || Boolean(error?.message?.includes("schema cache"));
      if (referenceColumnMissing) {
        ({ data: newTx, error } = await supabase.from("transactions").insert(baseRow as never).select().single());
      }
      if (error) throw error;
      if (!newTx) throw new Error("Could not record the bid/offer.");

      const bidOfferRow = {
        transaction_id: newTx.id,
        direction,
        price: 0,
        quantity: 0,
        unit: "",
        currency: "USD",
        terms: "",
        id_number: form.idNumber || null,
      };
      const { error: boError } = await supabase.from("bid_offers").insert(bidOfferRow as never);
      // `id_number` is a brand new column — fall back to inserting without it rather than losing
      // the whole bid/offer on an environment where the migration hasn't landed yet. PostgREST
      // reports a missing column two different ways depending on where it's caught: "42703" from
      // Postgres itself, or "PGRST204"/a "schema cache" message from PostgREST's own pre-check.
      const missingColumn =
        boError?.code === "42703" ||
        boError?.code === "PGRST204" ||
        Boolean(boError?.message?.includes("schema cache"));
      if (missingColumn) {
        const { id_number: _drop, ...withoutIdNumber } = bidOfferRow;
        await supabase.from("bid_offers").insert(withoutIdNumber);
      } else if (boError) {
        throw boError;
      }
      await recordEvent({
        transactionId: newTx.id,
        stage: "trading",
        step: "bid-offer",
        action: direction === "bid" ? "bid_placed" : "offer_placed",
        summary: `${direction === "bid" ? "Bid" : "Offer"} placed`,
        payload: { idNumber: form.idNumber },
      });
      await advance(newTx.id, "trading", "documents");
      const activity: RecordedActivity = {
        direction,
        title: newTx.title,
        commodity: null,
        quantity: null,
        unit: null,
        price: null,
        currency: "USD",
        time: new Date().toISOString(),
        reference,
      };
      setDirection(null);
      onCreated({ ...newTx, stage: "trading", step: "documents" } as Transaction, activity);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const startNode = (
    <div className="mx-auto max-w-md">
      <button
        type="button"
        onClick={() => {
          if (picking) {
            // Clicking the start node again resets back to the beginning.
            setPicking(false);
            setDirection(null);
          } else {
            setPicking(true);
          }
        }}
        className="group block w-full animate-node-rise px-6 py-5 text-center"
      >
        <span
          className={cn(
            "mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-primary text-primary transition-transform",
            picking ? "bg-primary/20" : "bg-primary/20 group-hover:scale-105",
          )}
        >
          <ArrowLeftRight className="h-4.5 w-4.5" />
        </span>
        <span
          className={cn(
            "mt-3 block text-[15px] font-semibold tracking-tight text-foreground transition-colors",
            !picking && "group-hover:text-primary",
          )}
        >
          Open a bid or an offer
        </span>
        <span className="mt-1 block text-[12.5px] font-medium text-muted-foreground">
          Bids to the left, Offers to the right.
        </span>
      </button>
    </div>
  );

  if (!picking) {
    return (
      <div className="ink-grid relative rounded-3xl border border-border p-4 sm:p-6">
        <p className="label-caps text-center">Live deal engine</p>
        <div className="mt-6">{startNode}</div>
        <Connector />
        <p className="text-center text-[11.5px] text-muted-foreground">
          Matching · Proof of Intent · Without a Doubt · Execution · Finality
        </p>
      </div>
    );
  }

  const form_ = (
    <form onSubmit={submit} className="mt-2 space-y-3">
      {orgs.length > 1 && activeCompanyId && (
        <div className="space-y-1.5">
          <Label htmlFor="cs-company">Trading as</Label>
          <Select value={activeCompanyId} onValueChange={setCompanyId}>
            <SelectTrigger id="cs-company">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="cs-id-number">ID Number</Label>
        <Input
          id="cs-id-number"
          autoFocus
          placeholder="National ID, passport, or company registration number"
          value={form.idNumber}
          onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Next, you'll upload supporting documents — AI reads them and fills in the deal details.
        </p>
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Recording…" : "Continue to documents"}
      </Button>
    </form>
  );

  return (
    <>
      {!direction && (
        <div className="ink-grid relative rounded-3xl border border-border p-4 sm:p-6">
          <p className="label-caps text-center">Live deal engine</p>
          <div className="mt-6">{startNode}</div>
        </div>
      )}
      <div
        className={cn(
          "relative rounded-3xl p-3 sm:p-5",
          !direction && "ink-grid mt-4 border border-border",
        )}
      >
      <p className="label-caps mb-3">
        {direction === "bid" ? "Live deal engine for The Bid" : direction === "offer" ? "Live deal engine for Responder" : "Live deal engine"}
      </p>
      {!direction && (
        <div className="grid grid-cols-2 gap-4 sm:gap-8">
          <LaneHeader label="The Bid" side="left" />
          <LaneHeader label="Responder" side="right" />
        </div>
      )}
      <div className={cn("mt-3", !direction && "grid grid-cols-2 gap-4 sm:gap-8")}>
        {direction !== "offer" && (
          <div className="space-y-3">
            {direction === "bid" ? (
              <div className="glass-node animate-node-rise p-5 sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <p className="text-base font-semibold tracking-tight">Submit a Bid</p>
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
                  label="Submit a Bid"
                  blurb="Record the opening bid and its terms."
                  side="left"
                  onClick={() => setDirection("bid")}
                  examples={BID_EXAMPLES}
                />
              </div>
            )}
          </div>
        )}
        {direction !== "bid" && (
          <div className={cn("space-y-3", !direction && "col-start-2")}>
            {direction === "offer" ? (
              <div className="glass-node animate-node-rise p-5 sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <p className="text-base font-semibold tracking-tight">Submit an Offer</p>
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
                  label="Submit an Offer"
                  blurb="State what you're supplying, at what price, and your delivery terms."
                  side="right"
                  onClick={() => setDirection("offer")}
                  examples={OFFER_EXAMPLES}
                />
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </>
  );
}
