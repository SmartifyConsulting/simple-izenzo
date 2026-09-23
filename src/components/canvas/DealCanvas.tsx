import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  ArrowUp,
  FileCheck2,
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
  ShieldAlert,
  ScrollText,
  X,
  FileText,
  StopCircle,
  Pencil,
  Plus,
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
import { getCounterpartyProfile } from "@/lib/counterpartyProfile.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { sourceLabel } from "@/lib/userFacingText";
import { ensureOrg } from "@/lib/org";
import { FLAT_STEPS, lockReason, stepDef, stepIndex, type StageKey } from "@/lib/spine";
import { advance, money, recordEvent, when, type Transaction, type TxEvent } from "@/lib/tx";
import { setCounterpartyShortlist, searchCounterparties } from "@/lib/izenzo.functions";
import { enrichCounterparty } from "@/lib/counterpartyOutreach.functions";
import { dedupeOrgs } from "@/lib/dedupeOrgs";
import { getEngagement } from "@/lib/engagement.functions";
import { keepForBid, loadBidRelevance } from "@/lib/bidRelevance";
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
            <p className="label-caps">Submit your Proposal</p>
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
          <GateBar label="Seal Intent" cleared />
          <div className="space-y-1.5">
            {[
              "Counterparties surfaced",
              "Counterparty chosen",
              "Background screening complete",
              "Intent confirmed",
              "Intent sealed",
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
            title="Seal Intent"
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
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-progress-track">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            matchProgress.searching
                              ? "w-1/2 animate-ribbon-sweep bg-success"
                              : "w-full bg-destructive",
                          )}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {matchProgress.searching
                          ? "Searching for counterparties…"
                          : matchProgress.error?.startsWith("No organisations relevant")
                    ? "No relevant organisations were found. Edit the search in the information panel above and search again."
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
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-progress-track">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            mediaProgress.failed ? "bg-destructive" : "bg-success",
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
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-progress-track">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            screeningProgress.failed ? "bg-destructive" : "bg-success",
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
                <GateBar label="Seal Intent" cleared={poi} />
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
              "KYB — entity, beneficial owners (UBO) and AML verified",
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
  viewOnly,
  bare,
}: {
  tx: Transaction;
  stage: StageKey;
  step: string;
  reload: () => void;
  onClose: () => void;
  /** Drops the outer card, heading pill and close button — used when this frame already sits
   * inside an accordion that carries its own heading, so the two don't nest. */
  bare?: boolean | undefined;
  /** Offered on Intent and Proof of Intent (before the seal is paid for) so a user who changes
   * their mind can reopen the counterparty choice instead of being stuck with their first pick. */
  onChangeParty?: (() => void) | undefined;
  /** True when this is a past, already-completed stage opened from the map — shown as a frozen
   * snapshot rather than the live, editable step, since its data can't be changed anymore. */
  viewOnly?: boolean | undefined;
}) {
  const baseDef = stepDef(stage, step);
  const loadEngagement = useServerFn(getEngagement);
  const isWad = stage === "compliance" && step === "wad" && !tx.wad_completed_at;
  const { data: engagement } = useQuery({
    queryKey: ["engagement", tx.id],
    queryFn: () => loadEngagement({ data: { transactionId: tx.id } }),
    enabled: isWad,
  });
  // Before the counterparty approves the offer, this frame is the Offer alone — Without a Doubt
  // appears only once agreement is reached.
  const def =
    isWad && engagement && engagement.decided !== "accepted"
      ? { key: "offer", label: "Offer", blurb: "Agree the terms with the counterparty. Without a Doubt opens once they approve." }
      : baseDef;
  const locked = lockReason(stage, step, tx);
  const canChangeParty =
    !viewOnly && Boolean(onChangeParty) && !tx.poi_sealed_at && (step === "intent" || step === "poi");
  const changePartyLink = canChangeParty && (
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
  );
  if (bare) {
    return locked ? (
      <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">{locked}.</p>
    ) : (
      <>
        <StepScreen tx={tx} stage={stage} step={step} reload={reload} />
        {changePartyLink}
      </>
    );
  }
  return (
    <div className="glass-node animate-node-rise mt-1 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {/* Same heading treatment as the Bid Registration / Bid Information frames: small
              caps, muted — Intent and WaD previously read a size larger than the rest of the
              workspace. */}
          <p className="label-caps inline-block truncate rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 font-sans text-[var(--lw-pill-fg)]">
            {def?.label ?? step}
          </p>
          {/* Intent shows its own heading + description inside the panel below, so the outer
              blurb here would just repeat it. Proof of Intent's sealing sentence lives here
              instead — its own panel no longer repeats it. */}
          {def?.blurb && step !== "intent" && (
            <p className="mt-1 text-[13px] text-muted-foreground">{def.blurb}</p>
          )}
          {viewOnly && (
            <p className="mt-1 text-[13px] font-medium text-muted-foreground">
              Read-only — this step is already complete.
            </p>
          )}
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
      ) : viewOnly ? (
        <div className="pointer-events-none select-text opacity-80" aria-readonly>
          <StepScreen tx={tx} stage={stage} step={step} reload={reload} />
        </div>
      ) : (
        <StepScreen tx={tx} stage={stage} step={step} reload={reload} />
      )}
      {changePartyLink}
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

/** The read-only terms being put to one shortlisted counterparty, and their company profile. */
function ProposalDialog({
  open,
  onOpenChange,
  txId,
  counterpartyId,
  counterpartyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  txId: string;
  counterpartyId: string;
  counterpartyName: string;
}) {
  const loadProfile = useServerFn(getCounterpartyProfile);
  const { data: profile, isPending: profilePending } = useQuery({
    queryKey: ["counterparty-profile", counterpartyId],
    enabled: open && !!counterpartyId,
    queryFn: () => loadProfile({ data: { counterpartyId } }),
  });
  const { data: tx } = useQuery({
    queryKey: ["proposal-terms", txId],
    enabled: open && !!txId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("title, commodity, quantity, unit, price, currency, incoterms, jurisdiction")
        .eq("id", txId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const details: { label: string; value: string | null }[] = profile
    ? [
        { label: "Country", value: profile.country ?? profile.jurisdiction },
        { label: "Sector", value: profile.industry ?? profile.sector },
        {
          label: "Years in business",
          value: profile.yearsInBusiness != null ? String(profile.yearsInBusiness) : null,
        },
        { label: "Registration no.", value: profile.registrationNo },
        { label: "What they offer", value: profile.offerings },
        { label: "Terms of trade", value: profile.termsOfTrade },
        { label: "Website", value: profile.website },
        { label: "Contact", value: profile.contactName },
        { label: "Email", value: profile.contactEmail },
        { label: "Phone", value: profile.phone },
        { label: "Found via", value: profile.source },
      ].filter((d) => Boolean(d.value))
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 truncate">{counterpartyName}</span>
          {profile?.score != null && (
            <span className="shrink-0 rounded-full border border-foreground bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
              {profile.score}% match
            </span>
          )}
          {profile?.verified && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              Verified
            </span>
          )}
        </DialogTitle>
        <DialogDescription>
          {[profile?.jurisdiction, profile?.sector].filter(Boolean).join(" · ") ||
            "Their company profile and the terms on the table."}
        </DialogDescription>

        {profilePending && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Reading their profile…</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-progress-track">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-success" />
            </div>
          </div>
        )}

        {profile && (
          <div className="space-y-3">
            <div className="rounded-md border border-border">
              <div className="border-b border-border px-4 py-3">
                <h3 className="label-caps font-sans font-bold text-muted-foreground">About them</h3>
              </div>
              <div className="p-4 text-xs leading-relaxed text-foreground">
                {profile.summary ? (
                  <p className="whitespace-pre-line">{profile.summary}</p>
                ) : (
                  <p className="text-muted-foreground">
                    This company has not published a profile on Izenzo yet. Everything below is what
                    the search found on them.
                  </p>
                )}
              </div>
            </div>

            {details.length > 0 && (
              <div className="rounded-md border border-border">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="label-caps font-sans font-bold text-muted-foreground">Company details</h3>
                </div>
                <dl className="grid gap-x-4 gap-y-2 p-4 text-xs sm:grid-cols-2">
                  {details.map((d) => (
                    <div key={d.label} className="contents">
                      <dt className="text-muted-foreground">{d.label}</dt>
                      <dd className="break-words font-medium text-foreground">
                        {d.label === "Website" || d.label === "Contact" || d.label === "Email" ? (
                          // Shown so a person can see one exists, but never legibly, and never as a
                          // clickable link — direct contact must go through Izenzo, not around it,
                          // until there's an actual introduction.
                          <span
                            title="Not shown — reach this company through Izenzo, not directly."
                            className="select-none blur-[3px]"
                          >
                            {d.value}
                          </span>
                        ) : (
                          d.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {profile.portfolio.length > 0 && (
              <div className="rounded-md border border-border">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="label-caps font-sans font-bold text-muted-foreground">
                    Attachments and portfolio
                  </h3>
                </div>
                <ul className="space-y-1 p-4">
                  {profile.portfolio.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-background/70" />
                      <span className="min-w-0 flex-1 truncate">
                        {item.title}
                        {item.description ? ` — ${item.description}` : ""}
                      </span>
                      {item.imageUrl && (
                        <a
                          href={item.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={`Open ${item.title}`}
                          className="shrink-0 rounded p-1 text-background/80 hover:bg-background/20 hover:text-background"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tx && (
          <div className="rounded-lg border-2 border-double border-foreground/70 bg-gradient-to-b from-muted/40 to-transparent p-4">
            <p className="text-center font-sans text-sm font-bold uppercase tracking-[0.14em] text-foreground">
              {tx.commodity || tx.title}
            </p>
            <dl className="mx-auto mt-4 grid max-w-md gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
              <div className="contents">
                <dt className="text-muted-foreground">Volume</dt>
                <dd className="font-medium text-foreground">
                  {tx.quantity ? `${tx.quantity} ${tx.unit ?? ""}`.trim() : "—"}
                </dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Price</dt>
                <dd className="font-medium text-foreground">{money(tx.price, tx.currency)}</dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Incoterms</dt>
                <dd className="font-medium text-foreground">{tx.incoterms || "—"}</dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Jurisdiction</dt>
                <dd className="font-medium text-foreground">{tx.jurisdiction || "—"}</dd>
              </div>
            </dl>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  mediaProgress = null,
  onMediaContinue,
  onFinalize,
  finalizing = false,
  locked = false,
  searchPrompt = null,
  onSearchAgain,
  onStopSearch,
}: {
  txId?: string | null;
  /** True while the AI/AI+ search is still running, so the panel polls for freshly saved rows. */
  searching?: boolean;
  error?: string | null;
  /** Fires the background screening for the ticked counterparties. */
  onContinue?: (counterpartyIds: string[]) => void;
  /** The search text as it currently stands — pre-fills the edit box "Edit Search" opens. */
  searchPrompt?: string | null;
  /** Runs the search again with (possibly edited) text — surfaced whenever the record has nothing
   * to show but nothing on screen actually offered a way to try again. A search left running when
   * the workspace was closed never auto-resumes on return (the effect that would restart it
   * depends on this-session-only local state), so without this the deal was stuck reading "no
   * matches" with no way forward. */
  onSearchAgain?: (prompt: string) => void;
  /** Gives up waiting on a search that's taking a long time (e.g. AI rate-limited, retrying
   * silently for 10-20s with nothing on screen to show for it) — the search itself keeps running
   * server-side and will still save whatever it finds, this just stops watching for it and opens
   * editing straight away instead of leaving no way out of the spinner. */
  onStopSearch?: () => void;
  /** True once intent is confirmed — the shortlist/pick is settled by then, so the checkboxes and
   * radio buttons here stop taking input rather than silently accepting a click that changes
   * nothing (or that the server would reject anyway). */
  locked?: boolean;
  /** True while those screening checks are being opened with the providers. */
  screening?: boolean;
  screeningResults?: ScreeningResult[] | null;
  /** True while the open-web / social media scan is running. */
  mediaRunning?: boolean;
  mediaResults?: MediaCheckResult[] | null;
  mediaProgress?: { done: number; total: number; failed?: boolean } | null;
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
  const enrichContact = useServerFn(enrichCounterparty);
  // NOTE: this is a different "AI+" from the one below — a deeper, heavier pass of the ordinary
  // search pipeline (more thorough web search + relevance testing), not the AI+ Recommendations
  // panel. It has nothing to be deep about until a person has actually shortlisted candidates from
  // the first (lighter, "AI") search, so it's requested once per transaction the first time that
  // happens here, rather than run for every search regardless of whether anyone has looked yet.
  const runAiPlusSearch = useServerFn(searchCounterparties);
  const aiPlusRequested = useRef<Set<string>>(new Set());
  const raiseChallengeFn = useServerFn(raiseChallenge);
  const listChallengesFn = useServerFn(listChallenges);
  const [pickedId, setPickedId] = useState<string | null>(null);
  // "Edit Search" reveals this inline, pre-filled with the current search text, instead of
  // silently re-running the exact same search that just came back empty.
  const [editingSearch, setEditingSearch] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  // Lets someone stop watching a search that's taking a long time (AI silently retrying a rate
  // limit can run 10-20s with nothing on screen) without waiting it out — the request itself keeps
  // running server-side regardless.
  const [stoppedWatching, setStoppedWatching] = useState(false);
  useEffect(() => {
    if (searching) setStoppedWatching(false);
  }, [searching]);
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
  // The AI/AI+ match list, kept as a folded record above the screening findings.
  const [searchResultsExpanded, setSearchResultsExpanded] = useState(false);
  // The proposal (this deal's own terms) shown to a counterparty. Negotiating and agreeing the
  // offer itself now happens later, via MutualEngagementPanel's Approve/Reject/Challenge once
  // intent is sealed — not here.
  const [proposalFor, setProposalFor] = useState<{ id: string; name: string } | null>(null);

  const movedToScreening = screening || screeningResults !== null;
  useEffect(() => {
    if (movedToScreening) setMediaExpanded(false);
  }, [movedToScreening]);

  // Each company's own findings start collapsed too — expand one at a time by clicking its name,
  // rather than every company's full check list stacking up at once.
  const [expandedMediaCos, setExpandedMediaCos] = useState<Set<string>>(new Set());
  const [expandedScreeningCos, setExpandedScreeningCos] = useState<Set<string>>(new Set());
  // Screening findings open themselves the moment they land, so they are read before Continue.
  const screeningSeenRef = useRef<string>("");
  useEffect(() => {
    const ids = (screeningResults ?? []).map((r) => r.counterpartyId);
    const key = ids.join("|");
    if (!key || screeningSeenRef.current === key) return;
    screeningSeenRef.current = key;
    setExpandedScreeningCos(new Set(ids));
  }, [screeningResults]);
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
      const allRows = (data ?? []) as unknown as (CounterpartyCandidate & { rationale?: string | null })[];

      // Only what relates to this bid is ever shown: anything unrelated to what was searched for
      // (including results saved before that rule existed) and the bidder's own organisation are
      // left out.
      const relevance = await loadBidRelevance(txId as string);
      const rows = allRows.filter((r) =>
        keepForBid(relevance, {
          name: r.name,
          sector: r.sector,
          jurisdiction: r.jurisdiction,
          rationale: r.rationale ?? null,
        }),
      ) as CounterpartyCandidate[];
      // The same organisation can be found on several pages (and by several sources) — it should
      // read as one result, keeping the highest match percentage.
      return dedupeOrgs(rows, (r) => {
        const flags = (r as unknown as { media_flags?: { evidence?: { url?: string }[] } }).media_flags;
        return r.website ?? flags?.evidence?.[0]?.url ?? null;
      }) as CounterpartyCandidate[];
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
    if (locked) return;
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
        // The first time a candidate is actually shortlisted for this transaction, run the
        // deeper AI+ pass over it — never before, and never more than once per transaction here.
        if (txId && !aiPlusRequested.current.has(txId)) {
          aiPlusRequested.current.add(txId);
          void runAiPlusSearch({ data: { transactionId: txId, kind: "ai_plus" } })
            .then(() => qc.invalidateQueries({ queryKey: ["counterparties", txId] }))
            .catch(() => {
              // Best-effort — AI+ failing here must never disrupt the shortlist the person just made.
              aiPlusRequested.current.delete(txId);
            });
        }
      }
    } catch (err) {
      toast.error((err as Error).message);
      qc.invalidateQueries({ queryKey: ["counterparties", txId] });
    }
  }


  // Online Media Screening leads straight into picking a counterparty now — background
  // screening no longer sits in between, since WaD in Compliance already runs KYC/KYB/PEP/AML
  // on whoever is chosen. The moment media results are back (and nothing is still running) is
  // the moment the user can pick which party they actually want to trade with.
  const screeningDone = !mediaRunning && mediaResults !== null && mediaResults.length > 0;
  // The selection circles live on the screening records, so that list has to be open the moment
  // screening finishes — otherwise there is nothing to pick with.
  useEffect(() => {
    if (screeningDone) setMediaExpanded(true);
  }, [screeningDone]);


  return (
    <div
      className="rounded-2xl border-2 border-primary bg-slate-100 p-4"
    >
      {/* Heading sits at the top of the frame, before the results list below it, so it reads as
          the frame's title rather than a divider buried partway down. */}
      <div className="flex items-center justify-between gap-2">
        {/* Nothing to prompt for until the search has actually returned companies. */}
        <p className="label-caps text-black">
          {candidates.length === 0 || searching
            ? ""
            : screeningDone || continued
              ? "Selected counterparties"
              : "Select a counterparty to continue"}
        </p>

        <div className="flex shrink-0 items-center gap-1">
          {/* Stop and Edit Search sit here in the header now, next to the map's own one-line
              progress bar under the Search node — the bigger boxed "Searching…" indicator that
              used to live in the body below is gone, so these are the only way to interrupt or
              redirect a search while it's still running. */}
          {searching && !stoppedWatching && onStopSearch && (
            <button
              type="button"
              onClick={() => {
                setStoppedWatching(true);
                onStopSearch();
              }}
              title="Stop watching this search — it keeps running and will still save whatever it finds"
              className="flex items-center gap-1 rounded p-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            >
              <StopCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          )}
          {/* Available whenever there's still a choice to be made — not just once a search comes
              back empty. A single 45%-match candidate is as much "this needs a better search" as
              zero candidates is. */}
          {onSearchAgain && !screeningDone && !continued && !editingSearch && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditedPrompt(searchPrompt ?? "");
                setEditingSearch(true);
              }}
              title="Edit the search and try again"
              className="h-7 gap-1 border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-100"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Edit Search</span>
            </Button>
          )}
          {CHALLENGES_FEATURE_ENABLED && txId && (
            <>
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
            </>
          )}
        </div>
      </div>

      {editingSearch && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-slate-300 bg-white p-2.5">
          <Textarea
            rows={2}
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            autoFocus
            className="min-h-0 resize-none text-sm text-slate-800 placeholder:text-slate-400"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="flex-1"
              disabled={editedPrompt.trim().length === 0}
              onClick={() => {
                setEditingSearch(false);
                onSearchAgain?.(editedPrompt.trim());
              }}
            >
              Search
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-700 hover:bg-slate-200 hover:text-slate-900"
              onClick={() => setEditingSearch(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* The record of what the search found, kept plain inside the workspace's Search Results
          frame — no second heading, and no repeat of the screening findings, which have their own
          frame below in the workspace. */}
      {candidates.length > 0 && mediaResults && mediaResults.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-slate-300 pt-3">
          {[...candidates]
            .sort((a, b) => Number(Boolean(b.shortlisted)) - Number(Boolean(a.shortlisted)))
            .map((c) => (
              <li key={`sr-${c.id}`} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-800">{c.name}</span>
                {c.shortlisted && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    Selected
                  </span>
                )}
                {c.score != null && (
                  <span className="shrink-0 rounded-full border border-foreground bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                    {c.score}%
                  </span>
                )}
                {c.shortlisted && txId && (
                  <button
                    type="button"
                    title="View proposal"
                    onClick={() => setProposalFor({ id: c.id, name: c.name })}
                    className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}

      {CHALLENGES_FEATURE_ENABLED && openChallenge && (
        <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5">
          <p className="text-xs font-semibold text-destructive">
            Progression paused — challenge open: {openChallenge.subject}
          </p>
          <p className="mt-0.5 text-[11px] text-destructive/80">{openChallenge.summary}</p>
        </div>
      )}

      {candidates.length === 0 ? (
        searching && !stoppedWatching ? (
          // The map's own one-line progress bar under the Search node already says a search is
          // running — this frame doesn't need its own boxed copy of the same thing. Stop and Edit
          // Search live in the header above instead, so this stays quiet until results land.
          null
        ) : !editingSearch ? (
          // Just the status line — Edit Search itself lives once, bold and top-right in the
          // header above, rather than repeated again down here next to it.
          <div className="mt-2">
            <p className="text-xs text-slate-500">
              {error
                ? error.startsWith("No organisations relevant")
                  ? "No relevant organisations were found — edit the search and try again."
                  : `Search could not finish: ${error}`
                : "No matches found yet — edit the search and try again."}
            </p>
          </div>
        ) : null
      ) : mediaResults ? null : (
        // Once media results are in, the Online Media Screening accordion below carries the
        // selection control (circle/checkbox), match % and subtext itself — repeating the same
        // company, match and subtext up here as well just duplicated the same information twice.
        <RadioGroup
          asChild
          value={pickedId ?? ""}
          onValueChange={(v) => setPickedId(v)}
        >
        <ul className="mt-2 space-y-2.5">
          {visibleCandidates.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              {/* One party gets chosen at the end, so that step is a radio list — before then it's
                  a multi-select shortlist. */}
              {screeningDone ? (
                <RadioGroupItem
                  id={`shortlist-${c.id}`}
                  value={c.id}
                  className="mt-0.5"
                />
              ) : (
                <Checkbox
                  id={`shortlist-${c.id}`}
                  checked={Boolean(c.shortlisted)}
                  onCheckedChange={(v) => toggle(c, Boolean(v))}
                  className="mt-0.5"
                />
              )}
              <label
                htmlFor={`shortlist-${c.id}`}
                className="min-w-0 flex-1 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{c.name}</span>
                  {c.score != null && (
                    <span className="shrink-0 rounded-full border border-foreground bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
                      {c.score}% match
                    </span>
                  )}
                  {/* The list combines results from more than one pass — the first (lighter)
                      search, the deeper "Extended Search" pass, and now AI+ Recommendations'
                      own finds — so each is badged with exactly which one delivered it, rather
                      than reading as one undifferentiated list. */}
                  {(c.source === "ai_search" || c.source === "web_search" || c.source === "ai") && (
                    <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      AI
                    </span>
                  )}
                  {c.source === "ai_plus_search" && (
                    <span className="shrink-0 rounded-full border border-orange-500/50 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-600">
                      AI+
                    </span>
                  )}
                  {c.source === "ai_plus_recommendation" && (
                    <span
                      title="Added by AI+ Recommendations — a counterparty the search itself didn't independently verify"
                      className="shrink-0 rounded-full border border-orange-500/50 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-600"
                    >
                      AI+
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {[c.jurisdiction, c.sector].filter(Boolean).join(" · ") || sourceLabel(c.source)}
                </span>
                {(c.website || c.contact_email || c.phone) && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 truncate text-[11px] text-slate-400">
                    {/* Website and email stay hidden until there's an actual introduction — same
                        rule as the named contact in the profile dialog, just applied here too, in
                        the shortlist itself where they were previously shown in the clear. */}
                    {c.website && <span className="select-none truncate blur-[3px]">{c.website}</span>}
                    {c.website && (c.contact_email || c.phone) && <span>·</span>}
                    {c.contact_email && <span className="select-none truncate blur-[3px]">{c.contact_email}</span>}
                    {c.contact_email && c.phone && <span>·</span>}
                    {c.phone && <span className="truncate">{c.phone}</span>}
                  </span>
                )}
              </label>
              {/* Seeing the proposal comes first — a counter offer is only reachable from inside
                  it, not fired off blind. */}
              {txId && (
                <button
                  type="button"
                  title="View proposal"
                  onClick={() => setProposalFor({ id: c.id, name: c.name })}
                  className="flex shrink-0 items-center gap-1 rounded p-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">View Proposal</span>
                </button>
              )}

            </li>
          ))}
        </ul>
        </RadioGroup>
      )}

      {/* The match-search progress bar lives under the Counterparties node on the diagram. */}



      {mediaRunning && (
        <div className="mt-3 flex min-h-[72px] flex-col items-center justify-center gap-1.5 border-t border-slate-300 py-2 pt-[calc(0.5rem+1px)]">
          <p className="text-xs text-slate-600">Scanning LinkedIn, Facebook, TikTok, marketplaces and news…</p>
          {mediaProgress && mediaProgress.total > 0 && (
            <>
              <div className="h-1.5 w-1/2 overflow-hidden rounded-full bg-progress-track">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    mediaProgress.failed ? "bg-destructive" : "bg-success",
                  )}
                  style={{
                    width: `${Math.round((mediaProgress.done / mediaProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>
                  {mediaProgress.failed
                    ? "Online media screening could not finish"
                    : `${Math.round((mediaProgress.done / mediaProgress.total) * 100)}% — ${mediaProgress.done} of ${mediaProgress.total} sources scanned`}
                </span>
                {!mediaProgress.failed && <WorkingEllipsis />}
              </p>
            </>
          )}
        </div>
      )}

      {/* Background screening no longer runs (or shows its results) from this panel — it's
          scoped to run automatically once the flow reaches WaD/KYC,KYB,PEP,AML instead, so it
          doesn't show up alongside the Online Media Screening findings above. */}


      {/* The final pick (and its Continue button) belongs to the Online Media Screening Results
          frame in the workspace — a second one here competed with it. */}
      {screeningDone ? null : (
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
            Select to continue
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

      {txId && proposalFor && (
        <ProposalDialog
          open
          onOpenChange={(o) => !o && setProposalFor(null)}
          txId={txId}
          counterpartyId={proposalFor.id}
          counterpartyName={proposalFor.name}
        />
      )}
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
const WORKSPACE_REFERENCE_BASE = 1000000;
// Wide enough that two bids drawing at random practically never land on the same number — the old
// span of 1000 was small enough that repeats did happen, leaving two bids sharing one BID id.
const REFERENCE_SPAN = 900000;

export function nextReference(direction: "bid" | "offer" | "workspace") {
  if (direction === "workspace") {
    // A new workspace is numbered ID… until its search is categorised as a Bid or an Offer.
    return `ID${WORKSPACE_REFERENCE_BASE + Math.floor(Math.random() * REFERENCE_SPAN)}`;
  }
  const base = direction === "bid" ? BID_REFERENCE_BASE : OFFER_REFERENCE_BASE;
  const unique = base + Math.floor(Math.random() * REFERENCE_SPAN);
  return `${direction === "bid" ? "BID" : "OFFER"}${unique}`;
}

/** Draws a bid/offer number that isn't already in use — checked against the numbers on file before
 * it's handed out, so two deals can never end up sharing one. */
export async function claimReference(direction: "bid" | "offer" | "workspace") {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = nextReference(direction);
    const { data, error } = await supabase
      .from("transactions")
      .select("id")
      .eq("reference", candidate)
      .limit(1);
    // Can't check (offline, or the column isn't there yet) — use it rather than block the bid.
    if (error) return candidate;
    if (!data || data.length === 0) return candidate;
  }
  return nextReference(direction);
}

export function CanvasStart({
  onCreated,
  onPickingChange,
  onDirectionChange,
  onDraftReference,
  initialDirection,
  initialPrompt,
  initialFiles,
  initialReference,
}: {
  /** `seed` carries whatever the visitor already typed/dropped on the starting card, so the
   * caller can hand it straight to the real upload step instead of making them repeat it. */
  onCreated: (
    tx: Transaction,
    activity: RecordedActivity,
    seed: { prompt: string; files: File[] },
  ) => void;
  /** Fires whenever picking starts/stops, so the caller can hide anything that would look like a
   * duplicate of this card (e.g. the read-only flowchart preview) while it's active. */
  onPickingChange?: (picking: boolean) => void;
  /** Fires whenever the bid/offer side is picked or cleared. */
  onDirectionChange?: (direction: "bid" | "offer" | null) => void;
  /** Fires once, the moment a not-yet-recorded bid/offer gets its placeholder BID/OFF reference —
   * lets the caller show a real ID on the workspace tab/title bar even before anything is saved. */
  onDraftReference?: (reference: string) => void;
  /** Opens straight into the Bid or Offer form on mount instead of the picker — used when a
   * caller elsewhere on the page already decided which side the user wants. */
  initialDirection?: "bid" | "offer" | null;
  /** Carries over whatever a visitor already typed on the marketing homepage before signing in
   * (or signing up) — pre-fills the description and, if non-empty, opens the workspace on mount
   * exactly as if they'd pressed Enter here, so signing in doesn't drop them on an empty card. */
  initialPrompt?: string | undefined;
  /** Files already dropped/selected on the marketing homepage before signing in — carried the
   * same way `initialPrompt` is, so they aren't silently dropped on the floor. */
  initialFiles?: File[] | undefined;
  /** A BID number the caller has already drawn and shown (on the map's Bid tile, say) — used as
   * this card's own reference instead of drawing a second, different-looking one. */
  initialReference?: string | null | undefined;
}) {
  const { org, orgs, user, profile, refresh } = useAuth();
  // Which company this bid/offer is traded as — only shown as a choice when the user belongs to
  // more than one; otherwise the account's default org is used without asking.
  const [companyId, setCompanyId] = useState<string | null>(null);
  // Generated the moment picking starts (not at final submit) so the workspace can show a real
  // BID/OFF id immediately — reused as-is at submit time rather than generating a second,
  // different-looking one.
  const [draftReference, setDraftReference] = useState<string | null>(initialReference ?? null);
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
  // Title/commodity/quantity/price/identity used to be asked here — they're now read off the
  // uploaded documents by AI, or already on file from sign-up, so this screen asks for nothing.
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialDirection) {
      onPickingChange?.(true);
      onDirectionChange?.(initialDirection);
    }
    // Only meant to sync the caller once, from the initial mount value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createDeal(direction: "bid" | "offer", reference: string, filesOverride?: File[]) {
    if (!user) {
      toast.error("Sign in to record a bid or offer");
      setPicking(false);
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

      const baseRow = {
        org_id: activeOrg.id,
        stage: "trading",
        step: "bid-offer",
        // A placeholder until the deal is named from its own details — there's nothing else to
        // name it from at this point.
        title: direction === "bid" ? "New Bid" : "New Offer",
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
      // Someone else claimed the same number in the meantime — draw a fresh one and try once more
      // rather than losing the bid or filing a duplicate.
      if (error?.code === "23505") {
        ({ data: newTx, error } = await supabase
          .from("transactions")
          .insert({ ...baseRow, reference: await claimReference(direction) } as never)
          .select()
          .single());
      }
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
      };
      const { error: boError } = await supabase.from("bid_offers").insert(bidOfferRow as never);
      if (boError) throw boError;
      await recordEvent({
        transactionId: newTx.id,
        stage: "trading",
        step: "bid-offer",
        action: direction === "bid" ? "bid_placed" : "offer_placed",
        summary: `${direction === "bid" ? "Bid" : "Offer"} placed`,
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
      onCreated(
        { ...newTx, stage: "trading", step: "documents" } as Transaction,
        activity,
        { prompt, files: filesOverride ?? pendingFiles },
      );
    } catch (err) {
      toast.error((err as Error).message);
      setPicking(false);
    } finally {
      setBusy(false);
    }
  }

  // Dropping/selecting a file (or typing a description and pressing Enter) goes straight to
  // creating the deal — there's nothing left to ask first (identity is on file from sign-up, and
  // direction is inferred from the document itself once it's uploaded), so a confirmation screen
  // in between would just be a click for its own sake. Whatever was already typed/dropped rides
  // along via onCreated's `seed` so the real upload step can pick up exactly where this left off.
  async function beginPicking(filesOverride?: File[]) {
    // The reference shown before this point (initialReference, drawn the moment an empty
    // workspace opens) is only ever a placeholder — "WS…"/"ID…" — because direction wasn't known
    // yet. Now that the Buy/Sell pill makes it explicit, a proper BID/OFF-prefixed reference is
    // drawn fresh here rather than keeping that generic placeholder regardless of which was picked.
    const ref = await claimReference(startDirection);
    setDraftReference(ref);
    onDraftReference?.(ref);
    setPicking(true);
    setDirection(startDirection);
    // Passed straight through rather than relying on the pendingFiles state set moments ago by
    // the same event handler — that setPendingFiles call hasn't re-rendered yet, so createDeal
    // would otherwise still read the empty array from this closure and silently drop whatever was
    // just dropped/selected.
    void createDeal(startDirection, ref, filesOverride);
  }

  const [dragOver, setDragOver] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [pendingFiles, setPendingFiles] = useState<File[]>(initialFiles ?? []);
  // Explicit Buy/Sell pill on the starting card — defaults to Buy (a bid) since that's the more
  // common ask, rather than leaving the side to be guessed from wording once documents land.
  const [startDirection, setStartDirection] = useState<"bid" | "offer">("bid");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedInitialPrompt = useRef(false);

  // A prompt or files carried over from the marketing homepage open the workspace immediately,
  // the same as pressing Enter or dropping a file here — otherwise signing in from a search the
  // visitor already ran would just drop them on the same empty starting card, losing what they
  // typed or attached.
  useEffect(() => {
    if (appliedInitialPrompt.current) return;
    appliedInitialPrompt.current = true;
    const hasSeed = (initialPrompt && initialPrompt.trim()) || (initialFiles && initialFiles.length > 0);
    if (hasSeed && !initialDirection) {
      void beginPicking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same look as the marketing hero's search bar — one unified pill with the description on the
  // left, the drop zone on the right, and a circular submit button — so capturing what someone's
  // after starts here instead of asking them to repeat it once the deal already exists.
  const canBeginPicking = prompt.trim().length > 0 || pendingFiles.length > 0;

  function removePendingFile(name: string) {
    setPendingFiles((prev) => prev.filter((f) => f.name !== name));
  }

  const startNode = (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      {/* Small, explicit — no need to guess the side from wording once documents land. */}
      <div className="flex items-center gap-1 rounded-full border border-border bg-background p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setStartDirection("bid")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            startDirection === "bid" ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setStartDirection("offer")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            startDirection === "offer" ? "bg-[#4169e1] text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Sell
        </button>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length === 0) return;
          setPendingFiles(files);
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-full border bg-background py-1.5 pl-1.5 pr-2 shadow-sm transition-colors focus-within:border-primary",
          dragOver ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={pendingFiles.length > 0 ? `${pendingFiles.length} file(s) attached — add more` : "Attach files"}
          title="Attach files"
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          {pendingFiles.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
              {pendingFiles.length}
            </span>
          )}
        </button>

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canBeginPicking) {
              e.preventDefault();
              void beginPicking();
            }
          }}
          placeholder="Enter bid/offer description"
          className="min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            if (files.length === 0) return;
            setPendingFiles(files);
          }}
        />

        <button
          type="button"
          onClick={() => void beginPicking()}
          disabled={!canBeginPicking}
          aria-label="Submit"
          title="Submit"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>

      {pendingFiles.length > 0 && (
        <ul className="space-y-1.5">
          {pendingFiles.map((f) => (
            <li
              key={f.name}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs"
            >
              <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="min-w-0 flex-1 break-words text-foreground">{f.name}</span>
              <button
                type="button"
                onClick={() => removePendingFile(f.name)}
                aria-label={`Remove ${f.name}`}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (!picking) {
    return (
      <div className="relative">
        {startNode}
      </div>
    );
  }

  // Creating the deal is near-instant, so this is just a brief in-between state on the way to the
  // real document-upload step — not a screen anyone needs to act on.
  return (
    <div className="relative">
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Setting up your workspace…</p>
      </div>
    </div>
  );
}
