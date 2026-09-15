import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Download,

  Eye,
  Maximize2,
  Minimize2,
  Minus,
  MoreVertical,
  Move,
  Paperclip,
  Ban,
  X as XIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  CanvasStart,
  claimReference,
  CounterpartyRecord,
  InlineFrame,
  FLOWCHART_PREVIEW_TX,
  type RecordedActivity,
} from "@/components/canvas/DealCanvas";
import { TradeSummary } from "@/components/canvas/TradeSummary";
import { SubmitterIdentity } from "@/components/canvas/SubmitterIdentity";
import { MatchResultsPanel } from "@/components/canvas/MatchResultsPanel";

import { ClassicView } from "@/components/canvas/ClassicView";
import { MapView } from "@/components/canvas/MapView";
import { DocumentUploadStep } from "@/components/guided/DocumentUploadStep";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { advance, fallbackReference, recordEvent, swapReferencePrefix, type Transaction } from "@/lib/tx";
import type { StageKey } from "@/lib/spine";
import { useAuth } from "@/lib/auth";
import { searchCounterparties } from "@/lib/izenzo.functions";
import { listCounterOffers } from "@/lib/counterOffer.functions";

import { runBackgroundScreening, type ScreeningResult } from "@/lib/screening.functions";
import { runOnlineMediaChecks, type MediaCheckResult } from "@/lib/onlineMedia.functions";
import { listVerificationsForTx } from "@/lib/didit.functions";
import { summarizeBidDocuments } from "@/lib/docSummary.functions";
import { cancelBid } from "@/lib/cancelBid.functions";
import { readDocument } from "@/lib/documents.functions";

import { pushRecentDeal } from "@/lib/recentDeals";
import { useDealWindows } from "@/lib/dealWindows";
import { peekStashedHeroFiles, clearStashedHeroFiles } from "@/lib/heroSearchContext";
import { playStepAdvanceChime } from "@/lib/sound";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/live-deal-engine")({
  head: () => ({
    meta: [
      { title: "Live Deal Engine — Izenzo" },
      { name: "description", content: "Your live deal canvas on the Izenzo Trading Gateway." },
      { property: "og:title", content: "Live Deal Engine — Izenzo" },
      { property: "og:description", content: "Your live deal canvas on the Izenzo Trading Gateway." },
    ],
  }),
  // Lets a Bid/Offer ID elsewhere (e.g. the Report list) link straight into this workflow for
  // that specific deal, instead of only ever resuming whatever was last worked on here.
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    tx?: string;
    popout?: boolean;
    panel?: "matches";
    q?: string;
    seed?: string;
    fresh?: boolean;
    n?: number;
  } => ({
    ...(typeof search["tx"] === "string" ? { tx: search["tx"] as string } : {}),
    // The router serialises this back out as a boolean, so a reload/round-trip has to be read
    // as truthy too — otherwise `popout=1` turns into `popout=false` on the next navigation.
    popout: search["popout"] === "1" || search["popout"] === true || search["popout"] === "true",
    // Opened from the homepage's "…" — shows the full match list in the Live Workspace.
    ...(search["panel"] === "matches" ? { panel: "matches" as const } : {}),
    ...(typeof search["q"] === "string" ? { q: search["q"] as string } : {}),
    // Carried over from the marketing homepage when signing in/up right after a search, so the
    // workspace opens with that description already applied instead of landing empty.
    ...(typeof search["seed"] === "string" ? { seed: search["seed"] as string } : {}),
    // Set only by the "New workspace" taskbar tab — forces the empty upload/search template even
    // when the bare URL (no `tx`) would otherwise resume whatever deal was last worked on.
    ...(search["fresh"] === "1" || search["fresh"] === true || search["fresh"] === "true"
      ? { fresh: true }
      : {}),
    // Bumped every time the New tab is pressed, so pressing it again while already on an empty
    // workspace still starts a genuinely new one (with its own BID number) instead of being a
    // no-op navigation to the address already showing.
    ...(Number.isFinite(Number(search["n"])) && search["n"] !== undefined && search["n"] !== ""
      ? { n: Number(search["n"]) }
      : {}),
  }),
  component: LiveDealEngine,
});

// Picks out the facts a reader actually scans an AI summary for — material terms, amounts,
// quantities, dates and percentages — and renders them in bold so the summary remains scannable.
const KEY_TERM_PATTERN =
  /(?:\b(?:quantity|price|currency|delivery|payment terms?|specifications?|location|jurisdiction|deadline|duration|contract term|incoterms?|units?|scope)\b)|(?:[$€£R]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|k|m|bn))?)|(?:\b(?:USD|EUR|GBP|ZAR|R)\s?\d[\d,]*(?:\.\d+)?\b)|(?:\b\d[\d,]*(?:\.\d+)?\s?(?:MT|kg|tonnes?|tons?|barrels?|units?|bbl|%)\b)|(?:\b\d{1,3}(?:\.\d+)?%\b)|(?:\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)|(?:\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b)/gi;

function highlightKeyTerms(text: string): React.ReactNode[] {
  const parts = text.split(KEY_TERM_PATTERN);
  const matches = text.match(KEY_TERM_PATTERN) ?? [];
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`t${i}`}>{part}</span>);
    if (matches[i]) {
      nodes.push(
        <span key={`m${i}`} className="font-semibold text-emerald-600">
          {matches[i]}
        </span>,
      );
    }
  });
  return nodes;
}

type Attachment = {
  name: string;
  kind: "ID" | "ID front" | "ID back" | "Document" | "NDA" | "MOU" | "Contract" | "Certificate";
  /** Location of the stored file in the private `documents` bucket, so it can be opened later. */
  path?: string | null;
};

type FlowStep = "documents" | "searching" | "results";

// Keyed to the created transaction so a user who navigates away (or refreshes) lands back on the
// same bid/offer instead of starting over — the reference number lives here too, since it's
// generated client-side and has nowhere else to persist.
const ACTIVE_DEAL_KEY = "izenzo:active-deal";

/** A dropdown of every deal still in progress, each entry showing its reference together with the
 * trade name. It opens on the most recent deal; with nothing in progress it shows no selection. A
 * deal drops off the list the moment it reaches Memory (fully sealed) — from then on it's only
 * findable through the All Trades report. */
// A deal that never got a commodity/title of its own still needs a fallback for internal record-
// keeping, but that placeholder shouldn't surface as if it were a real deal name in this picker.
const GENERIC_TITLES = new Set(["New Bid", "New Offer"]);



function OpenDealsPicker({ currentId, hasAttachment }: { currentId: string | null; hasAttachment?: boolean }) {
  const { org } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: deals = [] } = useQuery({
    queryKey: ["open-deals", org?.id],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, reference, title, commodity, stage, status, created_at, bid_offers(direction, created_at)")
        .eq("org_id", org!.id)
        .neq("stage", "memory")
        .not("status", "in", "(cancelled,archived)")
        // Newest first, so the most recent trade is what the picker lands on.
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (
        (data ?? []) as unknown as {
          id: string;
          reference: string | null;
          title: string;
          commodity: string | null;
          created_at: string;
          bid_offers: { direction: string; created_at: string }[];
        }[]
      ).map((t) => {
        const earliest = [...t.bid_offers].sort(
          (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
        )[0];
        const direction: "bid" | "offer" = earliest?.direction === "offer" ? "offer" : "bid";
        const name = t.commodity ?? (GENERIC_TITLES.has(t.title) ? "" : t.title);
        return {
          id: t.id,
          reference: t.reference ?? fallbackReference(t.id, direction),
          name,
        };
      });
    },
  });

  if (deals.length === 0) return <span />;

  const selected = deals.find((d) => d.id === currentId) ?? deals[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-[280px] justify-start gap-2 text-[13px] font-normal"
        >
          {hasAttachment && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          {selected ? (
            <span className="min-w-0 truncate">
              <span className="font-mono text-base font-bold">{selected.reference}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Search</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search a bid or offer…" />
          <CommandList>
            <CommandEmpty>No matching bids or offers.</CommandEmpty>
            <CommandGroup>
              {deals.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`${d.reference} ${d.name}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: "/live-deal-engine", search: { tx: d.id } });
                  }}
                >
                  <span className="font-mono font-semibold">{d.reference}</span>
                  {d.name && <span className="text-muted-foreground"> — {d.name}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** The Live Deal Engine is the one screen users work from — the workflow canvas itself, never a
 * separate per-deal detail page. */
function LiveDealEngine() {
  const { tx: txParam, popout, panel, q: matchQuery, seed, fresh, n: freshNonce } = Route.useSearch();
  const navigate = useNavigate();
  const { org } = useAuth();
  // Whatever the visitor dropped on the homepage before signing in, if anything. Read via a
  // non-destructive peek (StrictMode double-invokes this initializer in dev, and a combined
  // read-and-clear would lose the files on the second call), then clear it once via the effect
  // below so it isn't picked up again by a later visit to this page.
  const [seedFilesFromHome] = useState(() => peekStashedHeroFiles());
  useEffect(() => {
    clearStashedHeroFiles();
  }, []);
  const [picking, setPicking] = useState(false);
  const [direction, setDirection] = useState<"bid" | "offer" | null>(null);
  // Reserved for pre-selecting a bid/offer direction before the Workspace form opens; the
  // Engine Map's single "Create a bid or an offer" entry point always leaves this null and lets
  // the form's own picker ask.
  const [pendingDirection, setPendingDirection] = useState<"bid" | "offer" | null>(null);
  const [activity, setActivity] = useState<RecordedActivity | null>(null);
  const [dealTx, setDealTx] = useState<Transaction | null>(null);
  // The BID/OFF id shown on the tab/title bar before anything is actually saved — set the moment
  // someone starts a new bid/offer, so the workspace never sits unlabeled.
  const [draftReference, setDraftReference] = useState<string | null>(null);
  // Whatever was already typed/dropped on the starting card, carried over so the real upload
  // step (which owns the actual saving/uploading) can pick up from there instead of the user
  // having to repeat themselves the moment the deal exists.
  const [seedPrompt, setSeedPrompt] = useState("");
  const [seedFiles, setSeedFiles] = useState<File[]>([]);
  const [flowStep, setFlowStep] = useState<FlowStep>("documents");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [screening, setScreening] = useState(false);
  const [screeningResults, setScreeningResults] = useState<ScreeningResult[] | null>(null);
  const [mediaRunning, setMediaRunning] = useState(false);
  const [mediaResults, setMediaResults] = useState<MediaCheckResult[] | null>(null);
  const [mediaProgress, setMediaProgress] = useState<
    { done: number; total: number; failed?: boolean } | null
  >(null);
  const [finalizing, setFinalizing] = useState(false);
  /** Which gate step the right-hand panel is currently asking the user to complete. */
  const [stagePanel, setStagePanel] = useState<"intent" | "poi" | "wad" | "business-docs" | null>(null);
  // Closing the Intent frame without confirming isn't the same as confirming it — the workflow
  // pulse goes back to Online Media Screening (the last real completed step) rather than sitting
  // on Intent, which is now hidden. Cleared again the moment Intent is reopened.
  const [intentDismissed, setIntentDismissed] = useState(false);
  useEffect(() => {
    if (stagePanel === "intent") setIntentDismissed(false);
  }, [stagePanel]);
  /** Set when a Map node outside the Workspace's own step-specific UI is clicked — shows a
   * generic inline detail panel for that (stage, step) in the Workspace instead. */
  const [mapPanel, setMapPanel] = useState<{ stage: StageKey; step: string; viewOnly?: boolean } | null>(null);
  // Coming back to a deal that is already mid-gate reopens the step it stopped on. A deal that
  // already has a chosen counterparty but no signed intent always reopens Intent, whatever step
  // happens to be stored on the row — that is what left users stranded on "Choice recorded".
  const [hasChosen, setHasChosen] = useState(false);
  // Separate from `hasChosen`: that flag means "the flow has moved past Choice" and is set the
  // moment media screening starts, well before any party is actually finalized — using it to
  // decide whether to force-open the Intent panel meant clicking "Run online media screening"
  // immediately hijacked the workspace into a locked Intent panel, so the screening UI (and its
  // results) never had a chance to show. This one only ever reflects a real chosen row in the DB.
  const [dbHasChosenParty, setDbHasChosenParty] = useState(false);
  /** Whether the deal map is shown above the stepper — folded away by hand if it isn't wanted. */
  const [mapOpen, setMapOpen] = useState(true);
  // Screening state is session-local and was never cleared on switching bids, so a fresh bid that
  // is still only searching could show a previous bid's leftover "online media screening results".
  // stagePanel/mapPanel are the same class of bug: opening Intent on one bid and then switching to
  // a brand-new bid left Intent forced open (with "complete the earlier steps first") on a deal
  // that hasn't remotely reached that point yet, since resumedStep's auto-open effect only sets
  // stagePanel — nothing ever cleared it on its own when the underlying deal changed.
  useEffect(() => {
    setScreening(false);
    setScreeningResults(null);
    setMediaRunning(false);
    setMediaResults(null);
    setMediaProgress(null);
    setStagePanel(null);
    setMapPanel(null);
    setIntentDismissed(false);
    // documentSummary/readError left over from the previous bid made the polling query above
    // disable itself (`enabled: !documentSummary`) before the new bid's own documents had been
    // read, which let the auto-search effect see a truthy (but stale) summary and kick off the
    // AI/AI+ search immediately — the search progress bar appearing before this bid's documents
    // had actually been summarised.
    setDocumentSummary(null);
    setReadError(null);
  }, [dealTx?.id]);
  // Only re-derived when switching to a different deal — not on every step change within the
  // same one. Re-running this on every step change re-queried "chosen" the moment the step moved
  // to online-media (before finalizeChoice has run), always finding none yet, and stomped the
  // `true` that startMediaChecks had just set — which sent the workflow pulse back to Choice
  // instead of on to Express Intent once media results landed.
  useEffect(() => {
    if (!dealTx?.id) return;
    let live = true;
    (async () => {
      const { count } = await supabase
        .from("counterparties")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", dealTx.id)
        .eq("status", "chosen");
      if (live) {
        setHasChosen((count ?? 0) > 0);
        setDbHasChosenParty((count ?? 0) > 0);
      }
    })();
    return () => {
      live = false;
    };
  }, [dealTx?.id]);

  const resumedStep: "intent" | "poi" | "wad" | "business-docs" | null = dealTx?.wad_completed_at
    ? dealTx.step === "business-docs"
      ? "business-docs"
      : null
    : dealTx?.poi_sealed_at
      ? "wad"
      : dealTx?.intent_confirmed_at
        ? "poi"
        : dealTx?.step === "intent" || dealTx?.step === "poi"
          ? dealTx.step
          : dbHasChosenParty
            ? "intent"
            : null;
  useEffect(() => {
    if (resumedStep) setStagePanel(resumedStep);
  }, [resumedStep]);



  const [screeningProgress, setScreeningProgress] = useState<
    { done: number; total: number; failed?: boolean } | null
  >(null);



  /* Which workflow item is genuinely current is derived further down, once the attached documents
     are known (see stepOverrides). */


  const [documentSummary, setDocumentSummary] = useState<string | null>(null);
  // The summary reads as though it's being written live rather than popping in whole — replayed
  // from scratch each time the text changes (a new file folded in can rewrite earlier lines, not
  // just add to the end, so resuming mid-way through wouldn't read correctly).
  const [summaryRevealLen, setSummaryRevealLen] = useState(0);
  useEffect(() => {
    if (!documentSummary) {
      setSummaryRevealLen(0);
      return;
    }
    setSummaryRevealLen(0);
    const total = documentSummary.length;
    const step = Math.max(1, Math.ceil(total / 90));
    let shown = 0;
    const id = setInterval(() => {
      shown = Math.min(shown + step, total);
      setSummaryRevealLen(shown);
      if (shown >= total) clearInterval(id);
    }, 15);
    return () => clearInterval(id);
  }, [documentSummary]);
  // The AI summary is written to the transaction row in the background, after the document
  // upload effects above have already captured their one-time snapshot — without this poll,
  // "What was submitted" would stay blank until the next full reload even once the summary was
  // actually ready.
  const [readError, setReadError] = useState<string | null>(null);
  const { data: polledDocumentData } = useQuery({
    queryKey: ["tx-document-summary", dealTx?.id],
    enabled: Boolean(dealTx?.id) && !documentSummary,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("document_summary, document_summary_error, title")
        .eq("id", dealTx!.id)
        .maybeSingle();
      const row = data as {
        document_summary: string | null;
        document_summary_error: string | null;
        title: string;
      } | null;
      setReadError(row?.document_summary_error ?? null);
      return row;
    },
  });
  useEffect(() => {
    if (!polledDocumentData) return;
    if (polledDocumentData.document_summary) setDocumentSummary(polledDocumentData.document_summary);
    if (polledDocumentData.title && !GENERIC_TITLES.has(polledDocumentData.title)) {
      setDealTx((prev) => (prev ? { ...prev, title: polledDocumentData.title } : prev));
      setActivity((prev) => (prev ? { ...prev, title: polledDocumentData.title } : prev));
    }
  }, [polledDocumentData]);

  const search = useServerFn(searchCounterparties);
  const runScreening = useServerFn(runBackgroundScreening);
  const runMediaChecks = useServerFn(runOnlineMediaChecks);
  const listIdChecks = useServerFn(listVerificationsForTx);
  const summarizeDocs = useServerFn(summarizeBidDocuments);
  const cancelBidFn = useServerFn(cancelBid);
  const fetchDocument = useServerFn(readDocument);
  const [rereading, setRereading] = useState(false);
  // Once interest is being fetched the submitted detail collapses out of the way, so the results
  // have the room. Remembered per bid, so it stays collapsed on a refresh or a tab switch; the
  // header stays clickable to open it again.
  // Kept per bid rather than as one shared boolean: a single flag meant an explicit collapse could
  // be undone the moment the transaction object was replaced (which happens on every step
  // advance), which is exactly why this frame kept springing back open.
  const [bidInfoCollapsedByTx, setBidInfoCollapsedByTx] = useState<Record<string, boolean>>({});
  const bidInfoKnown = useRef<Set<string>>(new Set());
  function setBidInfoCollapsed(txId: string | undefined, collapsed: boolean) {
    if (!txId) return;
    bidInfoKnown.current.add(txId);
    setBidInfoCollapsedByTx((prev) => ({ ...prev, [txId]: collapsed }));
    try {
      if (collapsed) sessionStorage.setItem(`bid-info-collapsed:${txId}`, "1");
      else sessionStorage.removeItem(`bid-info-collapsed:${txId}`);
    } catch {
      // Private browsing without storage — the state above still holds for this view.
    }
  }
  // A bid that has already moved past submitting its documents opens with this frame closed, so it
  // never flashes open while the saved state is being read. Anything the user (or a search) sets
  // explicitly wins over that default.
  const bidInfoDefaultCollapsed = dealTx ? !["bid-offer", "documents"].includes(dealTx.step) : false;
  const bidInfoOpen = dealTx
    ? !(bidInfoCollapsedByTx[dealTx.id] ?? bidInfoDefaultCollapsed)
    : true;
  // Online Media Screening results get their own collapsed frame under Bid Information once
  // screening finishes — collapsed by default (unlike Bid Information, which opens for a fresh
  // bid) since this is a record to check back on, not something that needs attention right away.
  const [mediaResultsOpenByTx, setMediaResultsOpenByTx] = useState<Record<string, boolean>>({});
  function setMediaResultsOpen(txId: string | undefined, open: boolean) {
    if (!txId) return;
    setMediaResultsOpenByTx((prev) => ({ ...prev, [txId]: open }));
  }
  const mediaResultsOpen = dealTx ? Boolean(mediaResultsOpenByTx[dealTx.id]) : false;
  // Search Results gets its own collapsed frame under Bid Information too — open by default while
  // a counterparty is actively being picked, folded away once the flow moves on to media
  // screening (unless explicitly reopened by hand).
  const [searchResultsOpenByTx, setSearchResultsOpenByTx] = useState<Record<string, boolean>>({});
  function setSearchResultsOpen(txId: string | undefined, open: boolean) {
    if (!txId) return;
    setSearchResultsOpenByTx((prev) => ({ ...prev, [txId]: open }));
  }
  // Online media screening is back, nothing is still running, and no party has actually been
  // chosen yet: the choice is what the workspace is waiting for, so the frame carrying the
  // selection circles and the Continue button must be on screen and open — regardless of any
  // gate panel (Express Intent) that may have been opened, and regardless of `hasChosen`, which
  // only means "the flow moved past Choice", not "a party was picked".
  const choicePending = Boolean(
    mediaResults && mediaResults.length > 0 && !mediaRunning && !dbHasChosenParty,
  );
  const searchResultsOpen = dealTx
    ? (searchResultsOpenByTx[dealTx.id] ?? (choicePending || !hasChosen))
    : true;
  // Once a party is actually chosen the choice is settled: this folds back into the plain
  // "Search Results" record instead of staying open.
  useEffect(() => {
    if (!dealTx || !dbHasChosenParty) return;
    setSearchResultsOpenByTx((prev) => ({ ...prev, [dealTx.id]: false }));
  }, [dealTx?.id, dbHasChosenParty]);
  // The selection circles for the choice live on the screening records, so that list has to be
  // open the moment a choice is what the bid is waiting on — otherwise there is nothing to pick
  // with and the deal reads as stuck.
  useEffect(() => {
    if (!dealTx || !choicePending) return;
    setMediaResultsOpenByTx((prev) =>
      prev[dealTx.id] ? prev : { ...prev, [dealTx.id]: true },
    );
  }, [dealTx?.id, choicePending]);
  // The trade record, once everything has cleared — folded away by default.
  const [tradeSummaryOpen, setTradeSummaryOpen] = useState(false);
  // Once Intent is confirmed, its frame folds into a small accordion nested under Online Media
  // Screening Results rather than staying open as its own full-size panel.
  const [confirmedIntentOpen, setConfirmedIntentOpen] = useState(false);
  // Which counterparty (from the media-screening findings) the user is about to proceed with —
  // this is where the actual pick happens now, right next to the screening evidence for it.
  const [mediaPick, setMediaPick] = useState<string | null>(null);

  // Once the ask has been made for a bid, the description/drop frame never comes back — not while
  // the files are still saving, not on a refresh, not on a tab switch. Remembered per bid.
  const [submittedBids, setSubmittedBids] = useState<Set<string>>(() => new Set());
  // Set only by the explicit "Find Matching Interest" click (DocumentUploadStep's onNext) — not by
  // the upload itself, which fires its own onSubmitted the instant a file is dropped. Reading and
  // writing the summary should be visible on drop; folding Bid Information away and moving on to
  // the search only happens once the user actually says go.
  const [searchGoByTx, setSearchGoByTx] = useState<Set<string>>(() => new Set());
  function goToSearch(txId: string) {
    setSearchGoByTx((s) => (s.has(txId) ? s : new Set(s).add(txId)));
    setBidInfoCollapsed(txId, true);
  }
  function markSubmitted(txId: string) {
    try {
      sessionStorage.setItem(`bid-submitted:${txId}`, "1");
    } catch {
      // Private browsing without storage — the in-memory set below still holds for this session.
    }
    setSubmittedBids((s) => (s.has(txId) ? s : new Set(s).add(txId)));
  }
  const queryClient = useQueryClient();

  /** Reads the attached documents again — offered wherever files exist but no summary does, so a
   * read that failed earlier isn't a dead end. */
  async function rereadDocuments(transactionId: string) {
    setRereading(true);
    try {
      const { summary, title } = await summarizeDocs({ data: { transactionId } });
      setDocumentSummary(summary);
      if (title) {
        setDealTx((prev) => (prev ? { ...prev, title } : prev));
        setActivity((prev) => (prev ? { ...prev, title } : prev));
      }
      setReadError(null);
      toast.success("Documents read — summary ready");
    } catch (err) {
      setReadError((err as Error).message);
      toast.error((err as Error).message);

    } finally {
      setRereading(false);
    }
  }


  // The bidder/responder's own ID front/back, run through Didit the moment they're uploaded —
  // shown as a small "ID Verified" badge once it comes back passed, without making them visit
  // Settings separately to check.
  const { data: idVerifications = [] } = useQuery({
    queryKey: ["id-verification", dealTx?.id],
    enabled: Boolean(dealTx?.id),
    refetchInterval: 8000,
    queryFn: () => listIdChecks({ data: { transactionId: dealTx!.id } }),
  });
  const idCheck = idVerifications.find((v) => v.check_type === "id_document") ?? null;

  // Same query key DocumentUploadStep uses, so once a file is attached there (or here) both
  // stay in sync off one cache entry rather than each polling storage independently.
  const { data: workspaceDocs = [], isPending: workspaceDocsPending } = useQuery({
    queryKey: ["documents", dealTx?.id],
    enabled: Boolean(dealTx?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("transaction_id", dealTx!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const savedAttachments: Attachment[] = useMemo(
    () => workspaceDocs.map((d) => ({
      name: d.name,
      kind:
        d.doc_type === "identity"
          ? "ID"
          : d.doc_type === "nda"
            ? "NDA"
            : d.doc_type === "mou"
              ? "MOU"
              : d.doc_type === "contract"
                ? "Contract"
                : d.doc_type === "certificate"
                  ? "Certificate"
                  : "Document",
      path: d.storage_path,
    })),
    [workspaceDocs],
  );
  // A bid that already has documents counts as submitted, as does one whose flag survived a
  // refresh — either way the upload frame stays away.
  useEffect(() => {
    if (!dealTx) return;
    let stored = false;
    try {
      stored = sessionStorage.getItem(`bid-submitted:${dealTx.id}`) === "1";
    } catch {
      stored = false;
    }
    if (stored || workspaceDocs.length > 0) {
      setSubmittedBids((s) => (s.has(dealTx.id) ? s : new Set(s).add(dealTx.id)));
    }
  }, [dealTx?.id, workspaceDocs.length]);
  const submittedForThisBid = dealTx ? submittedBids.has(dealTx.id) : false;
  // A bid whose detail was collapsed when interest was fetched stays collapsed when it's opened
  // again, rather than springing back open on every load. Read once per bid only, so it can never
  // overwrite a collapse the user (or a search) just made.
  useEffect(() => {
    const txId = dealTx?.id;
    if (!txId || bidInfoKnown.current.has(txId)) return;
    bidInfoKnown.current.add(txId);
    let collapsed = false;
    try {
      collapsed = sessionStorage.getItem(`bid-info-collapsed:${txId}`) === "1";
    } catch {
      collapsed = false;
    }
    // Only a stored collapse is applied here — with nothing stored the default above decides, so a
    // progressed bid is never forced open.
    if (collapsed) setBidInfoCollapsedByTx((prev) => ({ ...prev, [txId]: true }));
  }, [dealTx?.id]);
  // Older bids may already have a good summary but still carry the old "New Bid" placeholder.
  // Read once more to generate and persist their proper display title; the ref prevents repeated
  // AI calls while the transaction query catches up with the saved title.
  const titleGenerationStarted = useRef<string | null>(null);
  useEffect(() => {
    if (
      !dealTx ||
      workspaceDocs.length === 0 ||
      !documentSummary ||
      !GENERIC_TITLES.has(dealTx.title) ||
      titleGenerationStarted.current === dealTx.id
    ) return;
    titleGenerationStarted.current = dealTx.id;
    void rereadDocuments(dealTx.id);
  }, [dealTx?.id, dealTx?.title, documentSummary, workspaceDocs.length]);

  // Documents attached: (re-)read them into a summary. Keyed by how many files this deal has been
  // summarised for, not just "has a summary at all" — so dropping another file after the first
  // summary already exists still triggers a fresh read that folds it in, rather than only ever
  // reading once per deal. Debounced so several files dropped together produce one read, not one
  // per file.
  const summarizedDocCount = useRef<Record<string, number>>({});
  const rereadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dealTx || workspaceDocs.length === 0 || rereading) return;
    const txId = dealTx.id;
    if (summarizedDocCount.current[txId] === workspaceDocs.length) return;
    if (rereadDebounceRef.current) clearTimeout(rereadDebounceRef.current);
    rereadDebounceRef.current = setTimeout(() => {
      summarizedDocCount.current[txId] = workspaceDocs.length;
      void rereadDocuments(txId);
    }, 1200);
    return () => {
      if (rereadDebounceRef.current) clearTimeout(rereadDebounceRef.current);
    };
  }, [dealTx?.id, workspaceDocs.length, rereading]);


  // Has interest already been fetched for this bid? Drives the "Fetch Interest" button, so it
  // stays offered for any bid that has documents but no matches yet — not only in the moment
  // straight after an upload.
  const { data: interestCount = 0, isPending: interestCountPending } = useQuery({
    queryKey: ["counterparties-count", dealTx?.id],
    enabled: Boolean(dealTx?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("counterparties")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", dealTx!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Counterparty search starts itself once documents are in — but only after the read has
  // finished, so it searches on what the documents actually say rather than on their file names.
  // A read that failed doesn't dead-end the deal: the search still runs (on the description and
  // file names) once `readError` is set.
  const autoSearchStarted = useRef<string | null>(null);
  useEffect(() => {
    if (
      !dealTx ||
      dealTx.stage !== "trading" ||
      !searchGoByTx.has(dealTx.id) ||
      workspaceDocsPending ||
      interestCountPending ||
      workspaceDocs.length === 0 ||
      rereading ||
      !(documentSummary || readError) ||
      interestCount > 0 ||
      screening ||
      mediaRunning ||
      flowStep === "searching" ||
      autoSearchStarted.current === dealTx.id
    ) return;
    autoSearchStarted.current = dealTx.id;
    void fetchInterest(dealTx.id);
  }, [
    dealTx?.id,
    searchGoByTx,
    workspaceDocsPending,
    interestCountPending,
    workspaceDocs.length,
    rereading,
    documentSummary,
    readError,
    interestCount,
    screening,
    mediaRunning,
    flowStep,
  ]);

  // A short chime whenever the workflow moves itself on to the next step — search finishing,
  // media screening completing, an auto-advance firing — so a step change is audible even when
  // this tab isn't the one being watched. Keyed per-deal so switching bids doesn't fire a stale
  // chime for the step the newly-opened bid happens to already be on.
  const lastChimedStep = useRef<string | null>(null);
  useEffect(() => {
    if (!dealTx) return;
    const key = `${dealTx.id}:${dealTx.stage}:${dealTx.step}`;
    const dealChanged = lastChimedStep.current !== null && !lastChimedStep.current.startsWith(`${dealTx.id}:`);
    if (lastChimedStep.current !== null && lastChimedStep.current !== key && !dealChanged) {
      playStepAdvanceChime();
    }
    lastChimedStep.current = key;
  }, [dealTx?.id, dealTx?.stage, dealTx?.step]);

  /** Which workflow item is genuinely current right now — the stored stage/step can't tell
   * "searching" apart from "results are in", so the page says it outright. Search AI + AI+ and
   * Online Media Screening are two separate, independently-timed operations — each pulses only
   * while it is itself actually running, not just because the other one is. */
  // Is a counter offer sitting out there unanswered? While one is, that's the live step.
  const listCounterOffersFn = useServerFn(listCounterOffers);
  const { data: counterOfferData } = useQuery({
    queryKey: ["counter-offers-open", dealTx?.id],
    enabled: !!dealTx?.id,
    refetchInterval: 30000,
    queryFn: () => listCounterOffersFn({ data: { transactionId: dealTx!.id } }),
  });
  const openCounterOffer = (counterOfferData?.offers ?? []).some(
    (o: { direction: string; status: string }) => o.direction === "from_bidder" && o.status === "sent",
  );

  const stepOverrides = useMemo(() => {

    const o: Record<string, "locked" | "open" | "active" | "done"> = {};
    if (!dealTx) return o;
    o["bidRegistration"] = "done";
    if (workspaceDocs.length === 0) {
      o["docSubmission"] = "active";
      return o;
    }
    o["docSubmission"] = "done";
    if (flowStep === "documents") return o;

    // Every row from here on is stated outright, so nothing falls back to the stored step and
    // starts pulsing alongside the operation that is genuinely running.
    if (flowStep === "searching") {
      // Search and Search Results pulse together while the search is actually running.
      o["search"] = "active";
      o["searchResults"] = "active";
      o["onlineMedia"] = "open";
      o["choice"] = "open";
      return o;
    }
    // The moment the search is done, the pulse moves straight on to Choice — Search and Search
    // Results themselves stop pulsing rather than handing off to each other.
    o["search"] = "done";
    o["searchResults"] = "done";

    // Trust a persisted, unambiguous fact over this session's own local flow flags — hasChosen,
    // mediaResults and intentDismissed are plain React state that start back at their initial
    // values on every fresh page load, so a deal that has genuinely confirmed Intent (or gone
    // further) in an *earlier* session read as if none of that had happened yet, sending the
    // pulse backward to Choice/Online Media Screening/Express Intent the moment WaD (or POI) was
    // then cleared in the new session.
    if (dealTx.intent_confirmed_at) {
      o["choice"] = "done";
      o["searchResults"] = "done";
      o["onlineMedia"] = "done";
      o["intent"] = "done";
      o["poi"] = dealTx.poi_sealed_at ? "done" : "active";
      if (dealTx.poi_sealed_at) {
        // The KYC/KYB/PEP/AML checks now run before Without a Doubt: the pulse sits on the
        // checks row while they are outstanding, and the gate row only turns green with them.
        o["kycKyb"] = dealTx.wad_completed_at ? "done" : "active";
        o["wad"] = dealTx.wad_completed_at ? "done" : "open";
        if (dealTx.wad_completed_at) {
          o["businessDocs"] = dealTx.step === "business-docs" ? "active" : "done";
          // Business documents in: Execution is what's next, so that's where the pulse goes.
          if (o["businessDocs"] === "done") {
            o["execution"] = "active";
            o["preparation"] = "active";
          }

        }

      }
      return o;
    }

    // Choice comes first now: nothing below it can start until a person has picked.
    if (!hasChosen) {
      o["choice"] = flowStep === "results" ? "active" : "open";
      o["onlineMedia"] = "open";
      o["intent"] = "open";
      return o;
    }
    o["choice"] = "done";
    o["searchResults"] = "done";

    // Online media screening runs only once the choice has been made and continued, and leads
    // straight into Express Intent once it's back — there's no separate background-screening gate
    // in between any more (WaD in Compliance already runs KYC/KYB/PEP/AML on whoever is chosen).
    if (mediaRunning) {
      o["onlineMedia"] = "active";
      o["intent"] = "open";
      return o;
    }
    if (mediaResults === null) {
      o["onlineMedia"] = "open";
      o["intent"] = "open";
      return o;
    }
    // Intent was opened and then closed by hand without confirming it — the pulse goes back to
    // Online Media Screening rather than sitting on the now-hidden Intent panel.
    if (intentDismissed && !dealTx.intent_confirmed_at) {
      o["onlineMedia"] = "active";
      o["intent"] = "open";
      return o;
    }
    o["onlineMedia"] = "done";

    o["intent"] = dealTx.intent_confirmed_at ? "done" : "active";
    if (dealTx.intent_confirmed_at) {
      o["poi"] = dealTx.poi_sealed_at ? "done" : "active";
      if (dealTx.poi_sealed_at) {
        o["kycKyb"] = dealTx.wad_completed_at ? "done" : "active";
        o["wad"] = dealTx.wad_completed_at ? "done" : "open";
        if (dealTx.wad_completed_at) {
          o["businessDocs"] = dealTx.step === "business-docs" ? "active" : "done";
          if (o["businessDocs"] === "done") {
            o["execution"] = "active";
            o["preparation"] = "active";
          }

        }

      }
    }
    // A counter offer that has gone out and not been answered is what everything now waits on, so
    // the pulse sits on Counter Offer until a reply is recorded.
    if (openCounterOffer) o["counterOffer"] = "active";
    return o;
  }, [
    openCounterOffer,

    dealTx,
    flowStep,
    mediaRunning,
    mediaResults,
    screening,
    screeningResults,
    hasChosen,
    intentDismissed,
    workspaceDocs.length,
  ]);



  // Which canvas step should pulse, on top of whichever step the canvas already highlights as
  // "active": Choice, until results have come back at least once; Background screening, while the
  // provider checks are actually running. Once screening has returned, the step it's attached to
  // is already the active one (or, after the final pick, already ticked done) — so there's nothing
  // left for this supplementary pulse to add, and leaving it pointed at "choice" here is exactly
  // what made an already-ticked frame keep pulsing after Continue was clicked.
  const throbStep = screening
    ? "media"
    : mediaRunning
      ? "online-media"
      : flowStep === "results" && !hasChosen
        ? "choice"
        : null;

  /** Scans the open web (LinkedIn, Facebook, TikTok, marketplaces, news) for the counterparties
   * that were ticked, before any paid provider screening is opened. */
  async function startMediaChecks(counterpartyIds: string[]) {
    if (!dealTx || counterpartyIds.length === 0) return;
    const SOURCES_PER_COUNTERPARTY = 6;
    // Picking who to take through screening *is* the Choice — stating it here means the pulse moves
    // on to Online Media Screening on a repeat pass too, not just the first time round.
    setHasChosen(true);
    // A new party has been picked, so an intent confirmed — and any Proof of Intent sealed —
    // against the previous one no longer applies: clear both so they can be granted again for
    // this party. The certificate already issued stays filed on the bid as history.
    if (dealTx.intent_confirmed_at || dealTx.poi_sealed_at) {
      await supabase
        .from("transactions")
        .update({ intent_confirmed_at: null, poi_sealed_at: null, poi_hash: null })
        .eq("id", dealTx.id);
      await recordEvent({
        transactionId: dealTx.id,
        stage: "trading",
        step: "intent",
        action: "intent_reopened",
        summary: "Intent and Proof of Intent reopened — a different counterparty was chosen",
      });
      setDealTx((prev) =>
        prev ? { ...prev, intent_confirmed_at: null, poi_sealed_at: null, poi_hash: null } : prev,
      );
    }
    // A previous round's finalized pick (if any) no longer applies once screening is re-run for a
    // (possibly different) set of candidates — leaving its "chosen" row in place made the Intent
    // panel force itself open on next load/reload even though the workflow had genuinely moved
    // back to Online Media Screening, since that panel only checked the database for any chosen
    // row rather than whether the reopened one was the current one.
    await supabase
      .from("counterparties")
      .update({ status: "screened", chosen_at: null } as never)
      .eq("transaction_id", dealTx.id)
      .eq("status", "chosen");
    setDbHasChosenParty(false);
    setMediaRunning(true);
    setMediaResults(null);
    setMediaProgress({ done: 0, total: counterpartyIds.length * SOURCES_PER_COUNTERPARTY });
    await advance(dealTx.id, "trading", "online-media");
    setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "online-media" } : prev));
    const collected: MediaCheckResult[] = [];
    let scanned = 0;
    try {
      for (const counterpartyId of counterpartyIds) {
        const results = await runMediaChecks({
          data: { transactionId: dealTx.id, counterpartyIds: [counterpartyId] },
        });
        collected.push(...results);
        scanned += results.reduce((n, r) => n + r.findings.length, 0);
        setMediaResults([...collected]);
        setMediaProgress({
          done: scanned,
          total: Math.max(scanned, counterpartyIds.length * SOURCES_PER_COUNTERPARTY),
        });
      }
      await recordEvent({
        transactionId: dealTx.id,
        stage: "trading",
        step: "online-media",
        action: "online_media_checked",
        summary: `Online media checked for ${collected.length} counterpart${collected.length === 1 ? "y" : "ies"}`,
      });
      toast.success("Online media screening complete");
    } catch (err) {
      toast.error((err as Error).message);
      setMediaProgress((p) => (p ? { ...p, failed: true } : p));
    } finally {
      setMediaRunning(false);
    }
  }

  /** Runs the background screening (registry lookup + Didit ID/KYB/AML) for whichever
   * counterparties were ticked in the Record panel. */
  async function startScreening(counterpartyIds: string[]) {
    if (!dealTx || counterpartyIds.length === 0) return;
    setScreening(true);
    setScreeningResults(null);
    // Four checks run per counterparty (registry + ID + company + sanctions), so the bar tracks
    // real checks rather than counterparties.
    const CHECKS_PER_COUNTERPARTY = 4;
    setScreeningProgress({ done: 0, total: counterpartyIds.length * CHECKS_PER_COUNTERPARTY });
    // Move the active-step pulse off Choice and onto Background screening the moment Continue
    // is clicked, not once the checks finish — the whole point is to show the flow is moving.
    await advance(dealTx.id, "trading", "media");
    setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "media" } : prev));
    // One call per counterparty so the progress bar advances on real completions rather than a
    // timer — the checks themselves are unchanged.
    const collected: ScreeningResult[] = [];
    let opened = 0;
    try {
      for (const counterpartyId of counterpartyIds) {
        const results = await runScreening({
          data: {
            transactionId: dealTx.id,
            counterpartyIds: [counterpartyId],
            ...(typeof window !== "undefined" ? { origin: window.location.origin } : {}),
          },
        });
        collected.push(...results);
        opened += results.reduce((n, r) => n + r.checks.length, 0);
        setScreeningResults([...collected]);
        setScreeningProgress({
          done: opened,
          total: Math.max(opened, counterpartyIds.length * CHECKS_PER_COUNTERPARTY),
        });
      }
      toast.success("Background screening started");
    } catch (err) {
      toast.error((err as Error).message);
      setScreeningProgress((p) => (p ? { ...p, failed: true } : p));
    } finally {
      setScreening(false);
    }
  }



  /** Re-reads the deal (and its attachments) after a step completes, so the Intent → Proof of
   * Intent hand-off and the newly filed certificate both show up without a page refresh. */
  async function reloadDeal() {
    if (!dealTx) return;
    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", dealTx.id)
      .maybeSingle();
    if (tx) {
      const fresh = tx as Transaction;
      setDealTx(fresh);
      // Intent signed → Proof of Intent; sealed → Without a Doubt; cleared → fold it away.
      setStagePanel(
        fresh.wad_completed_at
          ? null
          : fresh.poi_sealed_at
            ? "wad"
            : fresh.intent_confirmed_at
              ? "poi"
              : "intent",
      );
    }

    const { data: docs } = await supabase
      .from("documents")
      .select("name, notes, storage_path")
      .eq("transaction_id", dealTx.id)
      .order("created_at", { ascending: true });
    if (docs) {
      setAttachments(
        docs.map((d) => ({
          name: d.name,
          kind: (d.notes as Attachment["kind"] | null) ?? "Document",
          path: d.storage_path,
        })),
      );
    }
  }

  /** Records which screened counterparty the user actually wants to trade with, then opens the
   * Intent sign-off on the right so the terms can be signed and accepted. */
  async function finalizeChoice(counterpartyId: string) {
    if (!dealTx) return;
    setFinalizing(true);
    try {
      const { error } = await supabase
        .from("counterparties")
        .update({ status: "chosen", chosen_at: new Date().toISOString() })
        .eq("id", counterpartyId);
      if (error) throw error;
      await recordEvent({
        transactionId: dealTx.id,
        stage: "trading",
        step: "media",
        action: "counterparty_chosen",
        summary: "Chose the counterparty to trade with",
        payload: { counterpartyId },
      });
      await advance(dealTx.id, "trading", "intent");
      setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "intent" } : prev));
      setStagePanel("intent");
      toast.success("Choice recorded — confirm the intent to continue");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setFinalizing(false);
    }
  }

  /** Lets a user who changes their mind step back to the counterparty list: the chosen party is
   * released, the unsigned intent is cleared, and the deal returns to the choice step. Only
   * offered before the Proof of Intent is sealed — the sealed certificate names the party. */
  async function reopenChoice() {
    if (!dealTx || dealTx.poi_sealed_at) return;
    try {
      // Release the chosen party and clear every candidate's shortlist tick, so the full
      // counterparty list comes back exactly as it was before anyone was picked — not just the
      // one that got chosen.
      const { error: cpError } = await supabase
        .from("counterparties")
        .update({ status: "screened", chosen_at: null, shortlisted: false } as never)
        .eq("transaction_id", dealTx.id);
      if (cpError) throw cpError;
      const { error: txError } = await supabase
        .from("transactions")
        .update({ intent_confirmed_at: null })
        .eq("id", dealTx.id);
      if (txError) throw txError;
      await recordEvent({
        transactionId: dealTx.id,
        stage: "trading",
        step: "choice",
        action: "counterparty_choice_reopened",
        summary: "Reopened the counterparty choice — Online Media and Background Screening reset",
      });
      // Back to Choice, not Online Media/Background Screening — those only make sense once a
      // party has been picked again, so everything from Choice onward goes back to frame form.
      await advance(dealTx.id, "trading", "choice");
      setDealTx((prev) =>
        prev ? { ...prev, stage: "trading", step: "choice", intent_confirmed_at: null } : prev,
      );
      setHasChosen(false);
      setDbHasChosenParty(false);
      setIntentDismissed(false);
      setStagePanel(null);
      setMediaRunning(false);
      setMediaResults(null);
      setMediaProgress(null);
      setScreening(false);
      setScreeningResults(null);
      setScreeningProgress(null);

      setFlowStep("results");
      await queryClient.invalidateQueries({ queryKey: ["counterparties", dealTx.id] });
      toast.success("Choice reopened — pick the party you want to trade with");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }



  /** Cancels or archives the deal currently open in this workspace: marks it on the transaction
   * row (so it drops out of the open-deals picker and the Trades report can still filter for it),
   * closes its taskbar tab, and returns to the blank "New" workspace. Cancel is for a bid/offer
   * that's being withdrawn; Archive is for one that's simply done with but not through Finality —
   * both are soft, reversible only by editing the row directly, never a hard delete. */
  async function cancelOrArchiveDeal(kind: "cancelled" | "archived") {
    if (!dealTx) return;
    try {
      if (kind === "cancelled") {
        // Sets status, records the event and notifies any counterparty with a matching account —
        // all in one place, so every path that can cancel a deal (this menu, and the taskbar tab's
        // close button) behaves identically.
        await cancelBidFn({ data: { transactionId: dealTx.id } });
      } else {
        const { error } = await supabase.from("transactions").update({ status: kind }).eq("id", dealTx.id);
        if (error) throw error;
        await recordEvent({
          transactionId: dealTx.id,
          stage: dealTx.stage,
          step: dealTx.step,
          action: "deal_archived",
          summary: "Bid/offer archived",
        });
      }
      // A cancelled/archived deal disappears from the screen outright — switch to another open
      // tab if one exists, or a blank new workspace if that was the last one.
      const remaining = windows.filter((w) => w.id !== dealTx.id && w.id !== "new");
      closeWindow(dealTx.id);
      try {
        localStorage.removeItem(ACTIVE_DEAL_KEY);
      } catch {
        // Best-effort — worst case a later refresh resumes the same deal again.
      }
      toast.success(kind === "cancelled" ? "Bid/offer cancelled" : "Bid/offer archived");
      if (remaining.length > 0) {
        void navigate({ to: "/live-deal-engine", search: { tx: remaining[0]!.id } });
      } else {
        void navigate({ to: "/live-deal-engine", search: { fresh: true, n: Date.now() } });
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  /** "Create a bid or an offer" from the Engine Map — always starts a fresh registration, even
   * when a deal is already loaded here, instead of just switching view onto whatever that deal
   * already is. The Workspace's own form is where bid vs offer actually gets picked. */
  function startNewDeal() {
    setActivity(null);
    setDealTx(null);
    setDirection(null);
    setFlowStep("documents");
    setAttachments([]);
    setSearchError(null);
    setScreening(false);
    setScreeningResults(null);
    setMediaRunning(false);
    setMediaResults(null);
    setMediaProgress(null);
    setStagePanel(null);
    setHasChosen(false);
    setDbHasChosenParty(false);
      setIntentDismissed(false);
    setMapPanel(null);
    setPendingDirection(null);
    setDraftReference(null);
  }

  /** Clicking a node on the Engine Map that isn't already covered by the Workspace's own
   * step-specific UI (documents, search, choice, POI, WaD) — opens a generic inline detail panel
   * in the Workspace instead, so the Map never navigates away from this screen. */
  function openMapStep(stage: StageKey, step: string, viewOnly = false) {
    // A past, already-completed stage is shown as a frozen read-only snapshot instead of jumping
    // back into whichever live, editable UI normally owns that step — its data can't change
    // anymore, so it should never feel like the current step you're re-doing.
    if (viewOnly) {
      setStagePanel(null);
      setMapPanel({ stage, step, viewOnly: true });
      return;
    }
    if (stage === "trading" && step === "documents") {
      setStagePanel(null);
      setMapPanel(null);
      setFlowStep("documents");
      return;
    }
    if (stage === "trading" && (step === "search" || step === "counterparties" || step === "online-media" || step === "choice")) {
      setStagePanel(null);
      setMapPanel(null);
      return;
    }
    if (stage === "trading" && step === "poi") {
      setMapPanel(null);
      setStagePanel("poi");
      return;
    }
    if (stage === "compliance" && step === "wad") {
      setMapPanel(null);
      setStagePanel("wad");
      return;
    }
    setStagePanel(null);
    setMapPanel({ stage, step });
  }

  // Opened via a Bid/Offer ID elsewhere (e.g. the Report list) — load that specific deal instead
  // of whatever was last worked on in this browser.
  useEffect(() => {
    if (!txParam) return;
    (async () => {
      try {
        const { data: txRow } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", txParam)
          .maybeSingle();
        if (!txRow) return;
        const tx = txRow as Transaction;
        const { data: bidOffer } = await supabase
          .from("bid_offers")
          .select("direction, price, quantity, unit, currency")
          .eq("transaction_id", txParam)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const loadedActivity: RecordedActivity = {
          direction: (bidOffer?.direction as "bid" | "offer" | undefined) ?? "bid",
          title: tx.title,
          commodity: tx.commodity ?? null,
          quantity: bidOffer?.quantity != null ? String(bidOffer.quantity) : null,
          unit: bidOffer?.unit ?? null,
          price: bidOffer?.price != null ? String(bidOffer.price) : null,
          currency: bidOffer?.currency ?? tx.currency ?? "USD",
          time: tx.created_at,
          reference: tx.reference ?? "",
        };
        setActivity(loadedActivity);
        setDealTx(tx);
        // Screening/media state belongs to whichever bid was open before — carrying it over to a
        // newly-opened bid made a stale screeningResults look "done" here, so the Choice panel
        // skipped straight to the Finalize button instead of Online Media Screening.
        setScreening(false);
        setScreeningResults(null);
        setScreeningProgress(null);
        setMediaRunning(false);
        setMediaResults(null);
        setMediaProgress(null);
        setHasChosen(false);
        setDbHasChosenParty(false);
      setIntentDismissed(false);
        setDocumentSummary((tx as unknown as { document_summary: string | null }).document_summary ?? null);
        setFlowStep(tx.step === "documents" ? "documents" : "results");
        const { data: docs } = await supabase
          .from("documents")
          .select("name, notes, storage_path")
          .eq("transaction_id", txParam)
          .order("created_at", { ascending: true });
        if (docs) {
          setAttachments(
            docs.map((d) => ({
              name: d.name,
              kind: (d.notes as Attachment["kind"] | null) ?? "Document",
              path: d.storage_path,
            })),
          );
        }
        try {
          localStorage.setItem(
            ACTIVE_DEAL_KEY,
            JSON.stringify({ txId: txParam, activity: loadedActivity }),
          );
        } catch {
          // Best-effort — resuming later just won't work if storage is unavailable.
        }
      } catch {
        // Deal not found or not visible to this user — leave the picker showing.
      }
    })();
  }, [txParam]);

  // Resume whatever bid/offer this user last recorded, so a refresh or a later visit doesn't
  // lose their place.
  useEffect(() => {
    if (txParam || fresh) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(ACTIVE_DEAL_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    (async () => {
      try {
        const saved = JSON.parse(raw as string) as { txId: string; activity: RecordedActivity };
        const { data: tx } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", saved.txId)
          .maybeSingle();
        if (!tx) return;
        setActivity(saved.activity);
        setDealTx(tx as Transaction);
        // Same reset as the tx-param load above — otherwise resuming a bid from localStorage can
        // inherit another bid's stale screening/media state.
        setScreening(false);
        setScreeningResults(null);
        setScreeningProgress(null);
        setMediaRunning(false);
        setMediaResults(null);
        setMediaProgress(null);
        setHasChosen(false);
        setDbHasChosenParty(false);
      setIntentDismissed(false);
        setDocumentSummary((tx as unknown as { document_summary: string | null }).document_summary ?? null);
        setFlowStep(tx.step === "documents" ? "documents" : "results");
        const { data: docs } = await supabase
          .from("documents")
          .select("name, notes, storage_path")
          .eq("transaction_id", saved.txId)
          .order("created_at", { ascending: true });
        if (docs) {
          setAttachments(
            docs.map((d) => ({
              name: d.name,
              kind: (d.notes as Attachment["kind"] | null) ?? "Document",
              path: d.storage_path,
            })),
          );
        }
      } catch {
        // Stale/corrupt entry — ignore and let the user start fresh.
      }
    })();
  }, []);

  // The "New workspace" taskbar tab navigates here with `?fresh=1` — an explicit, unambiguous
  // signal to show the empty upload/search template, even though the bare URL (no `tx`) would
  // otherwise be indistinguishable from "just resume whatever was last worked on".
  useEffect(() => {
    if (!fresh) return;
    setActivity(null);
    setDealTx(null);
    setDraftReference(null);
    setSeedPrompt("");
    setSeedFiles([]);
    setFlowStep("documents");
    setAttachments([]);
    setDocumentSummary(null);
    // Nothing of the previous bid may survive into an empty workspace — no bidder details, no
    // search or screening findings, no open gate panel.
    setScreening(false);
    setScreeningResults(null);
    setScreeningProgress(null);
    setMediaRunning(false);
    setMediaResults(null);
    setMediaProgress(null);
    setHasChosen(false);
    setDbHasChosenParty(false);
    setIntentDismissed(false);
    setStagePanel(null);
    setMapPanel(null);
    setSearchError(null);
    setReadError(null);
    setTradeSummaryOpen(false);
    setConfirmedIntentOpen(false);
    setDirection(null);
    setPendingDirection(null);
    try {
      localStorage.removeItem(ACTIVE_DEAL_KEY);
    } catch {
      // Best-effort — worst case a later refresh resumes the old deal again.
    }
  }, [fresh, freshNonce]);

  // An empty workspace still gets its BID number up front, so the map's Bid tile can show the
  // number the bid will be recorded under rather than waiting for the first upload.
  useEffect(() => {
    if (dealTx || draftReference) return;
    let cancelled = false;
    void claimReference("bid").then((ref) => {
      if (!cancelled) setDraftReference(ref);
    });
    return () => {
      cancelled = true;
    };
  }, [dealTx, draftReference]);

  // Keeps the Search dialog's "Recent" shortcuts up to date with whatever deal is actually on
  // screen, however it got there (resumed, opened from the trades list, or just recorded).
  useEffect(() => {
    if (!dealTx || !activity) return;
    pushRecentDeal({
      id: dealTx.id,
      reference: activity.reference || dealTx.reference || "",
      title: activity.title || dealTx.title,
      direction: activity.direction,
      time: new Date().toISOString(),
    });
  }, [dealTx?.id, activity]);

  /** The direction picked before any document existed was just a starting guess ("bid") — once
   * the first uploaded document is classified, correct the deal's actual direction and BID/OFF
   * reference to match what was really uploaded, rather than leaving it on the default. */
  async function applyDirectionGuess(directionGuess: "bid" | "offer" | null) {
    if (!dealTx || !directionGuess) return;
    const currentDirection = activity?.direction ?? "bid";
    if (directionGuess === currentDirection) return;
    const currentReference =
      dealTx.reference || activity?.reference || fallbackReference(dealTx.id, currentDirection);
    const newReference = swapReferencePrefix(currentReference, directionGuess);
    const newTitle = directionGuess === "bid" ? "New Bid" : "New Offer";
    const [{ error: boError }, { error: txError }] = await Promise.all([
      supabase.from("bid_offers").update({ direction: directionGuess }).eq("transaction_id", dealTx.id),
      supabase.from("transactions").update({ reference: newReference, title: newTitle }).eq("id", dealTx.id),
    ]);
    if (boError || txError) {
      toast.error("Could not update the deal's direction from the upload.");
      return;
    }
    setDealTx((prev) => (prev ? { ...prev, reference: newReference, title: newTitle } : prev));
    setActivity((prev) =>
      prev ? { ...prev, direction: directionGuess, reference: newReference, title: newTitle } : prev,
    );
    toast.success(
      `This reads like ${directionGuess === "bid" ? "a bid proposal" : "a response to a bid"} — updated to ${newReference}.`,
    );
  }

  /** "Find Counterparties" — runs the AI/AI+ search. Online media screening comes later, only once
   * a person has made their choice and continued. */
  async function fetchInterest(txId: string) {
    await runSearch(txId);
  }

  async function runSearch(txId: string) {
    // Bid Information folds away the moment the stage moves to Search — not just once results
    // land — so the search/results view always has the room, not the bid's own details.
    setBidInfoCollapsed(txId, true);
    setFlowStep("searching");

    setSearchError(null);
    // Marks Upload Documents done and moves the active step onto Search the moment the search
    // actually starts — previously this only advanced once AI/AI+ succeeded, so a failed search
    // (e.g. the counterparty provider being unreachable) left Documents stuck showing as still in
    // progress even though it had genuinely finished.
    await advance(txId, "trading", "search");
    setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "search" } : prev));
    // Runs long enough to actually read as "AI and AI+ are searching" — otherwise, when both
    // calls happen to resolve fast, the step flashes past before anyone can see it.
    const minDuration = new Promise((resolve) => setTimeout(resolve, 3200));
    try {
      const [ai, aiPlus] = await Promise.allSettled([
        search({ data: { transactionId: txId, kind: "ai" } }),
        search({ data: { transactionId: txId, kind: "ai_plus" } }),
      ]);
      await minDuration;
      if (ai.status === "rejected" && aiPlus.status === "rejected") {
        throw ai.reason instanceof Error ? ai.reason : new Error("AI and AI+ search both failed");
      }
      // Straight to "choice" — once every candidate has surfaced and no more are forthcoming,
      // the counterparties step is already done, so the active-step pulse should land on Choice
      // rather than sitting on Counterparties.
      await advance(txId, "trading", "choice");
      setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "choice" } : prev));
    } catch (err) {
      await minDuration;
      setSearchError((err as Error).message);
    } finally {
      setFlowStep("results");
      // The candidates are written server-side, so the Record panel's cached (empty) list has to
      // be refreshed or it stays stuck on "Searching for counterparties…".
      await queryClient.invalidateQueries({ queryKey: ["counterparties", txId] });
      const { count } = await supabase
        .from("counterparties")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", txId);
      await queryClient.invalidateQueries({ queryKey: ["counterparties-count", txId] });
      // Counterparties found: fold Bid Information away so the results list gets the room.
      if ((count ?? 0) > 0) setBidInfoCollapsed(txId, true);
      // Online media screening deliberately does NOT start here — Choice comes first. It runs from
      // the Record panel's tick-and-continue, once a person has picked their counterparties.
    }

  }

  /** Files are read through this app's own address (a server function), never the storage host —
   * some browser extensions and ad blockers refuse the storage domain outright, which is what
   * produced the "blocked by Chrome" page for both preview and download. */
  async function loadAttachmentBlob(a: Attachment): Promise<Blob | null> {
    if (!a.path) return null;
    try {
      const { base64, contentType } = await fetchDocument({ data: { path: a.path } });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: contentType });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not read ${a.name}`);
      return null;
    }
  }

  async function openAttachment(a: Attachment) {
    const blob = await loadAttachmentBlob(a);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, "_blank", "noopener,noreferrer");
    if (!tab) {
      URL.revokeObjectURL(url);
      toast.error("Allow pop-ups to preview this document, or download it instead");
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  /** Same in-app read, saved to disk instead of opened. */
  async function downloadAttachment(a: Attachment) {
    const blob = await loadAttachmentBlob(a);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = a.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  // A deal that hasn't been created yet still needs a stable id so it can register as its own
  // taskbar entry rather than being lost the moment the user starts filling in a bid/offer.
  // Prefers the URL's own `tx` param over `dealTx?.id`: clicking a different taskbar tab changes
  // `txParam` synchronously, but `dealTx` only catches up once its async fetch resolves — using
  // `dealTx?.id` here meant windowId briefly still pointed at the *previous* tab's id (which
  // setMode had just minimized as a side effect of activating the new one), flashing its "is
  // minimized" placeholder for a moment on every tab switch.
  const windowId = txParam ?? dealTx?.id ?? "new";
  const windowLabel = dealTx
    ? dealTx.reference || activity?.reference || fallbackReference(dealTx.id, activity?.direction ?? "bid")
    : (draftReference ?? "+ New");
  const { windows, register: registerWindow, setMode, move, close: closeWindow, isPoppedElsewhere } = useDealWindows();
  const win = windows.find((w) => w.id === windowId);
  const windowMode = popout ? "docked" : (win?.mode ?? "docked");
  const poppedElsewhere = !popout && isPoppedElsewhere(windowId);
  // With nothing else open (or with everything else minimized to the taskbar — only one window
  // is ever non-minimized now), this isn't really a "window" among several competing for the same
  // space — it's just the canvas. Counting minimized windows here used to make this false as soon
  // as a second deal existed anywhere, even minimized, which routed the page into the fixed/
  // floating "maximized" layout — positioned to clear a taskbar of several visible windows, not
  // the sticky header, so its title bar rendered partly behind the header.
  const soloWorkspace = windows.filter((w) => w.mode !== "minimized").length <= 1;
  // Only the full-bleed layouts (nothing else open, or explicitly maximized) stretch the Map and
  // Workspace panels all the way down to the taskbar of open bid tabs — a docked/floating
  // workspace is a small window, not the whole screen, so it keeps its own fixed height instead.
  const fillToTaskbar = !popout && (soloWorkspace || windowMode === "maximized");

  useEffect(() => {
    if (popout) return;
    registerWindow(windowId, windowLabel, dealTx?.commodity ?? dealTx?.title ?? undefined);
    // The not-yet-created placeholder isn't a real saved workspace worth remembering a stray
    // docked position or minimized state for — always present it maximized, even if a stale
    // "new" entry from before this page had that default was left sitting in localStorage.
    if (windowId === "new") setMode(windowId, "maximized");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId, windowLabel, popout, dealTx?.commodity, dealTx?.title]);

  const [dragging, setDragging] = useState<{ dx: number; dy: number } | null>(null);
  const posX = win?.x ?? 80;
  const posY = win?.y ?? 80;

  function startDrag(e: React.PointerEvent) {
    if (popout) return;
    e.preventDefault();
    setDragging({ dx: e.clientX - posX, dy: e.clientY - posY });
  }
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => move(windowId, e.clientX - dragging.dx, e.clientY - dragging.dy);
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, move, windowId]);

  // The tab you are actually looking at is never presented as "minimized" — landing here means a
  // stale mode was restored, so it is simply reopened instead of showing an empty canvas.
  useEffect(() => {
    if (!popout && windowMode === "minimized") setMode(windowId, "maximized");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popout, windowMode, windowId]);


  if (poppedElsewhere) {
    return (
      <AppShell wide compactFooter hideFooter>
        <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
          {windowLabel} is open in its own window — switch to it, or close it there to bring it back here.
        </div>
      </AppShell>
    );
  }

  const workspaceContent = (
    <>
      {!popout && !soloWorkspace && (
        <div
          onPointerDown={windowMode === "maximized" ? undefined : startDrag}
          className={cn(
            "mb-2 flex items-center justify-between rounded-t-2xl border border-b-0 border-border bg-card px-4 py-2",
            windowMode !== "maximized" && "cursor-grab active:cursor-grabbing",
          )}
        >
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
            {windowMode !== "maximized" && <Move className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            <span className="truncate">{windowLabel}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Minus
              className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => setMode(windowId, "minimized")}
            />
            {windowMode === "maximized" ? (
              <Minimize2
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setMode(windowId, "docked")}
              />
            ) : (
              <Maximize2
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setMode(windowId, "maximized")}
              />
            )}
            <button
              type="button"
              title="Pop out to its own window — drag it to any monitor"
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              onClick={() => setMode(windowId, "popped")}
            >
              Pop out
            </button>
            <XIcon
              className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => closeWindow(windowId)}
            />
          </div>
        </div>
      )}

      {/* The workflow (Map/Steps) and the Live Workspace each stand on their own now — the extra
          outer card that used to wrap both was one frame too many once the workspace already has
          its own border, and just ate space that the two panels can use instead. */}
      <div
        className={cn(
          "relative grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
          fillToTaskbar && "flex min-h-0 flex-1 flex-col lg:grid",
        )}
      >
          {/* Engine Map — always visible on the left. Clicking a node opens that step inline in
              the Live Workspace beside it, instead of navigating away from this screen. When
              nothing else is competing for screen space (the common case), both panels stretch to
              fill all the way down to the taskbar of open bid tabs rather than stopping short of
              it; a docked/floating workspace instead keeps a fixed viewport-relative height, since
              it's a small window rather than the whole screen. */}
          <div
            className={cn(
              "flex w-full flex-col overflow-hidden p-3 sm:p-5",
              fillToTaskbar ? "h-full" : "h-[calc((100vh-190px)*0.945 + 1cm + 31px)]",
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className="label-caps text-muted-foreground">Izenzo Trade Workflow</p>
              {/* A switch, not a collapse: closing the map shows the vertical stepper instead, and
                  opening it hides the stepper again. One of the two is always on display. */}
              <div
                role="group"
                aria-label="Workflow view"
                className="flex items-center gap-0.5 rounded-full border border-border p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  aria-pressed={mapOpen}
                  className={cn(
                    "label-caps rounded-full px-2 py-0.5 transition-colors",
                    mapOpen
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Map
                </button>
                <button
                  type="button"
                  onClick={() => setMapOpen(false)}
                  aria-pressed={!mapOpen}
                  className={cn(
                    "label-caps rounded-full px-2 py-0.5 transition-colors",
                    !mapOpen
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Steps
                </button>
              </div>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {/* The map scales to fit the panel, so this scrollbar shouldn't usually need to
                  move — but it's a real native scrollbar (not custom buttons) as a fallback for
                  a short/narrow window where the scaled map is still taller than the panel. */}
              {mapOpen ? (
                <MapView
                  tx={dealTx ?? null}
                  reload={() => void reloadDeal()}
                  readOnly={!dealTx}
                  onOpenStep={openMapStep}
                  overrideStates={stepOverrides}
                  reference={dealTx?.reference ?? draftReference}
                  {...(dealTx ? {} : { onBid: startNewDeal })}
                />
              ) : (


                <ClassicView
                  tx={dealTx ?? FLOWCHART_PREVIEW_TX}
                  reload={() => void reloadDeal()}
                  readOnly={!dealTx}
                  onRegister={startNewDeal}
                  onOpenStep={openMapStep}
                  overrideStates={stepOverrides}
                />
              )}

            </div>
          </div>

          {/* Live Workspace — always visible on the right. Its heading line carries the bid/offer
              reference on the same row; below it is either the real upload frame (before any
              document is attached) or a bulleted list of what's been classified from the documents
              already uploaded. */}
          <div
            className={cn(
              "w-full overflow-y-auto rounded-3xl border border-border bg-card p-3 shadow-sm sm:p-5",
              fillToTaskbar ? "h-full" : "h-[calc((100vh-190px)*0.945 + 1cm + 31px)]",
            )}
          >
          {/* Everything pinned to the top of the workspace sits inside one opaque, full-bleed
              surface — the heading row, the Bid Registration frame, and the Bid Information
              frame together — so nothing scrolling underneath (e.g. counterparty results) can
              appear through it or in the gap above it. */}
          <div className="sticky -top-3 z-20 -mx-3 -mt-3 mb-1.5 bg-card px-3 pb-3 pt-3 sm:-top-5 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pt-5">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <p className="label-caps text-muted-foreground">Live Workspace</p>
            {dealTx && (
              <AlertDialog>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title="Cancel or archive this bid/offer"
                      aria-label="Cancel or archive this bid/offer"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Ban className="mr-2 h-3.5 w-3.5" />
                        Cancel bid/offer
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <DropdownMenuItem onSelect={() => void cancelOrArchiveDeal("archived")}>
                      <Archive className="mr-2 h-3.5 w-3.5" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this bid/offer?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {windowLabel} will be marked cancelled and removed from your open workspaces. This
                      doesn't delete it — it stays visible in the Trades report.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void cancelOrArchiveDeal("cancelled")}>
                      Cancel bid/offer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Bid Registration — the very top of the workspace, pinned above everything else that
              scrolls beneath it. The BID/OFF id sits on the same line as the heading (not its own
              row) to keep this frame as short as possible. Column 1: the bidder's identity/
              verification and how long that business has been active. Column 2: the bid's own
              name (wrapped, right-aligned), when it was registered, and the country. */}
          {activity && dealTx && (
            // Fully opaque: the glass treatment's translucency let content scrolling beneath show
            // through this pinned frame.
            <div className="glass-node space-y-1 bg-card p-3 [backdrop-filter:none] [background-image:none]">
              <div className="flex items-center justify-between gap-2">
                <p className="label-caps rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">Bid Registration</p>
                {(((dealTx as unknown as { reference?: string | null } | null)?.reference) ?? draftReference) && (
                  <span className="flex shrink-0 items-center gap-2 font-mono text-base font-bold tracking-wide text-foreground">
                    {workspaceDocs.length > 0 && (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-default">
                              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" className="max-w-[240px] bg-popover text-popover-foreground">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {savedAttachments.length} file{savedAttachments.length === 1 ? "" : "s"} on this bid
                            </p>
                            <ul className="space-y-0.5">
                              {savedAttachments.map((a, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-xs">
                                  <span className="truncate">{a.name}</span>
                                  <span className="shrink-0 text-[10px] text-muted-foreground">{a.kind}</span>
                                </li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {((dealTx as unknown as { reference?: string | null } | null)?.reference) ?? draftReference}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 items-start gap-3">
                <div className="min-w-0 space-y-1">
                  <SubmitterIdentity orgId={dealTx.org_id} createdBy={null} currentCheckStatus={idCheck?.status ?? null} />
                  {(org as unknown as { created_at?: string } | null)?.created_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Bidder Active Since:{" "}
                      {new Date((org as unknown as { created_at: string }).created_at).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "short", day: "numeric" },
                      )}
                    </p>
                  )}
                  {(org?.country || dealTx.jurisdiction) && (
                    <p className="text-[11px] text-muted-foreground">
                      {org?.country ?? dealTx.jurisdiction}
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-1 text-right">
                  {(dealTx.commodity || dealTx.title) && !GENERIC_TITLES.has(dealTx.title) && (
                    <p className="text-right">
                      {/* box-decoration-break: clone gives each wrapped line its own pill instead
                          of one pill stretching across every line the name wraps onto. */}
                      <span
                        className="inline whitespace-normal break-words rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold leading-[1.9] text-white"
                        style={{ WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone" }}
                      >
                        {dealTx.commodity || dealTx.title}
                      </span>
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Registered {new Date(activity.time ?? dealTx.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bidder details + AI summary come next — what was actually submitted, never buried
              behind the progress ribbon. The attachment(s) live here too, with preview/download. */}
          {activity && dealTx && (
            <div className="glass-node mt-1.5 space-y-1.5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setBidInfoCollapsed(dealTx.id, bidInfoOpen)}
                  aria-expanded={bidInfoOpen}
                  className="label-caps flex items-center gap-1.5 rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)] transition-colors hover:brightness-110"
                >
                  BID INFORMATION
                  <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", bidInfoOpen && "rotate-180")} />
                </button>
                {/* The ID check status already shows once, next to the submitter's name on the
                    Bid Registration card above — showing it again here (from the same
                    per-transaction check, but computed separately) was what let one place say
                    "Verified" while this one still said "ID check pending". */}
              </div>
              {bidInfoOpen && (
                <>
              {/* The value of the trade belongs with the rest of its material aspects, inside this
                  frame, rather than sitting on its own outside it. */}
              {(Number(activity.price) > 0 || Number(activity.quantity) > 0) && (
                <p className="text-sm font-semibold text-foreground">
                  {Number(activity.price) > 0
                    ? `${activity.currency ?? ""} ${activity.price}`.trim()
                    : "Value not stated"}
                  {Number(activity.quantity) > 0
                    ? ` · ${activity.quantity} ${activity.unit ?? ""}`.trimEnd()
                    : ""}
                </p>
              )}
              {documentSummary ? (
                <ul className="mt-1 space-y-1 text-xs leading-relaxed text-foreground">
                  {documentSummary
                    .slice(0, summaryRevealLen)
                    .split("\n")
                    .filter((raw) => raw.trim().length > 0)
                    .map((raw, i) => {
                      // A sub-bullet is indented under the section header directly above it (e.g.
                      // Scope/Deliverables/Evaluation Criteria's own items) — nested and disc-
                      // marked, but never run through highlightKeyTerms on the header word itself.
                      const isSub = /^\s{2,}[-•*]/.test(raw);
                      const text = raw.replace(/^\s*[-•*]\s*/, "").trim();
                      const headerMatch = !isSub && /^(Proposal|Scope|Deliverables|Evaluation Criteria|Due Date)\s*:?\s*(.*)$/i.exec(text);
                      if (isSub) {
                        return (
                          <li key={i} className="ml-4 list-disc pl-1">
                            {highlightKeyTerms(text)}
                          </li>
                        );
                      }
                      if (headerMatch) {
                        const [, label, rest] = headerMatch;
                        return (
                          <li key={i} className="list-none pt-1.5 font-semibold text-foreground first:pt-0">
                            {label}
                            {rest ? <>: {highlightKeyTerms(rest)}</> : null}
                          </li>
                        );
                      }
                      return (
                        <li key={i} className="ml-4 list-disc pl-1">
                          {highlightKeyTerms(text)}
                        </li>
                      );
                    })}
                </ul>
              ) : workspaceDocs.length === 0 && !submittedForThisBid ? (
                <p className="text-xs text-muted-foreground">
                  The AI summary appears here once a document is uploaded.
                </p>
              ) : readError ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <p className="text-[11px] text-muted-foreground">Couldn't read these documents.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={rereading}
                    onClick={() => void rereadDocuments(dealTx.id)}
                  >
                    {rereading ? "Reading…" : "Try again"}
                  </Button>
                </div>
              ) : (
                /* Documents are in and the summary isn't saved yet — show the read running as a
                   progress bar rather than a line of text about it not having happened. */
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Reading your documents…</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-progress-track">
                    <div className="h-full w-1/3 animate-[slide-in-right_1.4s_ease-in-out_infinite] rounded-full bg-success" />
                  </div>
                </div>
              )}


              {savedAttachments.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-border pt-2">
                  {savedAttachments.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-background/70" />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className="shrink-0 text-xs text-background/70">{a.kind}</span>
                      {/* Both icons always show — greyed out for files recorded before uploads
                          were kept, so a row never looks half-built. */}
                      <button
                        type="button"
                        disabled={!a.path}
                        onClick={() => openAttachment(a)}
                        title={
                          a.path
                            ? `Preview ${a.name}`
                            : "No stored copy — this file was recorded before uploads were kept"
                        }
                        className="shrink-0 rounded p-1 text-background/80 hover:bg-background/20 hover:text-background disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!a.path}
                        onClick={() => downloadAttachment(a)}
                        title={
                          a.path
                            ? `Download ${a.name}`
                            : "No stored copy — this file was recorded before uploads were kept"
                        }
                        className="shrink-0 rounded p-1 text-background/80 hover:bg-background/20 hover:text-background disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Explicit go: collapses this frame and hands the workspace over to the search. */}
              {workspaceDocs.length > 0 &&
                !searchGoByTx.has(dealTx.id) &&
                interestCount === 0 &&
                flowStep !== "searching" && (
                  <Button
                    className="mt-2 w-full bg-emerald-500 text-black hover:bg-emerald-400"
                    disabled={rereading || workspaceDocsPending || !(documentSummary || readError)}
                    onClick={() => goToSearch(dealTx.id)}
                  >
                    {rereading || !(documentSummary || readError) ? "Reading documents…" : "Submit"}
                  </Button>
                )}
                </>

              )}
            </div>
          )}

          </div>

            {/* Only rendered when the upload control itself is — an always-present empty row here
                added a gap between Bid Information and the frames below it. */}
            {dealTx && !workspaceDocsPending && workspaceDocs.length === 0 && !submittedForThisBid ? (
              <div className="mt-1 flex items-start justify-end gap-4">
                <div className="w-1/2 max-w-[260px] shrink-0">
                  {(
                    <DocumentUploadStep
                      // A stale resumed deal (from the "keep working on your last bid"
                      // localStorage effect) can mount this before the freshly-seeded one
                      // replaces it — without a key tied to the transaction, the seed-once
                      // effect below would fire for the wrong deal and never run again once the
                      // real one arrives, silently dropping any prompt/files carried from the
                      // homepage.
                      key={dealTx.id}
                      transactionId={dealTx.id}
                      reference={(dealTx as unknown as { reference?: string | null }).reference ?? draftReference}
                      // Firing this is what actually hands the workspace over to the search —
                      // Bid Information folds away right here, and the auto-search effect (gated
                      // on searchGoByTx) picks up once the read this triggered has landed.
                      onNext={() => goToSearch(dealTx.id)}
                      onSubmitted={() => markSubmitted(dealTx.id)}
                      onFirstClassified={({ directionGuess }) => void applyDirectionGuess(directionGuess)}
                      initialPrompt={seedPrompt}
                      initialFiles={seedFiles}
                    />
                  )}


                </div>
              </div>
            ) : null}


          {/* No deal yet: shows the upload/search starting card. If a `seed` came from the
              homepage's search bar, CanvasStart auto-creates the deal on mount instead of
              waiting for another click — so a visitor who already searched on the homepage lands
              straight on the summary panel below, never back on this same picker. */}
          {!activity && (
            <div className="glass-node mt-1.5 space-y-1.5 bg-card p-3 [backdrop-filter:none] [background-image:none]">
              {/* A brand-new workspace already reads as a bid: the same Bid Registration frame,
                  with the BID number on the heading row, around the description/upload bar. */}
              <div className="flex items-center justify-between gap-2">
                <p className="label-caps rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">Bid Registration</p>
                {draftReference && (
                  <span className="shrink-0 font-mono text-base font-bold tracking-wide text-foreground">
                    {draftReference}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 items-start gap-3">
                <div className="min-w-0 space-y-1">
                  {org?.id && <SubmitterIdentity orgId={org.id} createdBy={null} />}
                  {(org as unknown as { created_at?: string } | null)?.created_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Bidder Active Since:{" "}
                      {new Date((org as unknown as { created_at: string }).created_at).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "short", day: "numeric" },
                      )}
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-1 text-right">
                  {org?.country && <p className="text-[11px] text-muted-foreground">{org.country}</p>}
                </div>
              </div>

              <CanvasStart
                // Re-keyed on each New press so the starting card remounts and draws its own fresh
                // BID number rather than reusing the one already on screen.
                key={freshNonce ?? "new"}
                initialDirection={pendingDirection}
                initialPrompt={seed}
                initialFiles={seedFilesFromHome}
                initialReference={draftReference}
                onDraftReference={setDraftReference}
                onCreated={(tx, recorded, seed) => {
                  setPicking(false);
                  setDirection(null);
                  setPendingDirection(null);
                  setDraftReference(null);
                  setActivity(recorded);
                  setDealTx(tx);
                  setSeedPrompt(seed.prompt);
                  setSeedFiles(seed.files);
                  try {
                    localStorage.setItem(ACTIVE_DEAL_KEY, JSON.stringify({ txId: tx.id, activity: recorded }));
                  } catch {
                    // Best-effort — resuming later just won't work if storage is unavailable.
                  }
                  // Stays on "documents" so the caller (this page) still treats it as such —
                  // the workspace header above now owns showing the upload frame.
                }}
                onPickingChange={setPicking}
                onDirectionChange={setDirection}
              />
            </div>
          )}

          {panel === "matches" && (
            <MatchResultsPanel
              query={matchQuery}
              transactionId={dealTx?.id}
              className="mt-1.5"
            />
          )}

          {activity && dealTx && flowStep === "searching" && (
            <div className="mt-1.5 overflow-hidden rounded-xl border border-border">
              <div className="flex items-center gap-3 bg-[#F1F5F9] px-4 py-3">
                <p className="text-xs text-foreground">Running AI and AI+ search for matching counterparties…</p>
                {interestCount === 0 ? (
                  <span className="ml-auto text-[11px] text-muted-foreground">Finding counterparties…</span>
                ) : null}
              </div>

              <div className="h-1.5 w-full animate-ribbon-sweep" />
            </div>
          )}

          {/* Bid Registration / Submission of documents now tick in the workflow column instead. */}


          {mapPanel && dealTx && (
            <div className="mt-1.5">
              <InlineFrame
                tx={dealTx}
                stage={mapPanel.stage}
                step={mapPanel.step}
                reload={() => void reloadDeal()}
                onClose={() => setMapPanel(null)}
                viewOnly={mapPanel.viewOnly}
              />
            </div>
          )}

          {activity ? (
            <div className="mt-1.5 space-y-1.5">
                {/* The commodity name already shows on the Bid Registration card above — repeating
                    it here as its own pill just floated a second copy of the bid name with nothing
                    else around it. */}

                {/* The registration card and the one attachment list both live at the top of the
                    workspace now — no duplicate frames down here. */}


                {/* Once a party is chosen the gate panel takes over the workspace — leaving the
                    match list open below it is what made the screen look stuck. */}
                {(flowStep === "searching" || flowStep === "results") &&
                  dealTx &&
                  (choicePending ||
                    !stagePanel ||
                    (stagePanel === "intent" && dealTx.intent_confirmed_at)) &&
                  !dealTx.wad_completed_at && (
                  <div className="rounded-2xl border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => setSearchResultsOpen(dealTx.id, !searchResultsOpen)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
                      aria-expanded={searchResultsOpen}
                    >
                      <span className="label-caps rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                        {dbHasChosenParty ? "Chosen Counterparty" : "Search Results"}
                      </span>

                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", searchResultsOpen && "rotate-180")}
                      />
                    </button>
                    {searchResultsOpen && (
                    <div className="space-y-2 px-3.5 pb-3">
                    {searchError && (
                      <p className="text-xs text-destructive">Search failed: {searchError}</p>
                    )}
                    <CounterpartyRecord
                      txId={dealTx.id}
                      searching={flowStep === "searching"}
                      error={searchError}
                      screening={screening}
                      screeningResults={screeningResults}
                      onContinue={startMediaChecks}
                      mediaRunning={mediaRunning}
                      mediaResults={mediaResults}
                      mediaProgress={mediaProgress}
                      onMediaContinue={startScreening}
                      onFinalize={finalizeChoice}
                      finalizing={finalizing}
                    />
                    </div>
                    )}
                  </div>
                )}

                {/* Online Media Screening results, once screening has actually finished — its own
                    collapsed frame right under Search Results, closed by default since this is a
                    record to check back on rather than something needing attention the moment it's
                    ready. */}
                {dealTx && mediaResults && mediaResults.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMediaResultsOpen(dealTx.id, !mediaResultsOpen)}
                        aria-expanded={mediaResultsOpen}
                        className="label-caps flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]"
                      >
                        <span>
                          {dbHasChosenParty ? "CHOSEN COUNTERPARTY" : "ONLINE MEDIA SCREENING RESULTS"}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="text-[10px] font-semibold">
                            {mediaResults.length} counterpart{mediaResults.length === 1 ? "y" : "ies"}
                          </span>
                          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", mediaResultsOpen && "rotate-180")} />
                        </span>
                      </button>
                      {/* The prompt reads as plain subtext; a real button only appears once a
                          party has actually been picked. */}
                      {!dbHasChosenParty && (mediaPick || finalizing) && (
                        <Button
                          size="sm"
                          className="shrink-0"
                          disabled={finalizing}
                          onClick={() => mediaPick && finalizeChoice(mediaPick)}
                        >
                          {finalizing ? "Recording your choice…" : "Continue"}
                        </Button>
                      )}
                    </div>
                    {!dbHasChosenParty && !mediaPick && !finalizing && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Select who you want to trade with
                      </p>
                    )}


                    {mediaResultsOpen && (
                      <RadioGroup
                        value={mediaPick ?? ""}
                        onValueChange={setMediaPick}
                        disabled={dbHasChosenParty}
                        asChild
                      >
                      <ul className="mt-2 space-y-2">
                        {mediaResults.map((m) => (
                          <li key={m.counterpartyId} className="rounded-lg border border-border p-2.5">
                            <div className="flex items-start gap-2">
                              {!dbHasChosenParty && (
                                <RadioGroupItem
                                  id={`media-elect-${m.counterpartyId}`}
                                  value={m.counterpartyId}
                                  className="mt-0.5 shrink-0"
                                />
                              )}
                              <label
                                htmlFor={`media-elect-${m.counterpartyId}`}
                                className={cn("min-w-0 flex-1 text-xs font-semibold text-foreground", !dbHasChosenParty && "cursor-pointer")}
                              >
                                {m.name}
                              </label>
                            </div>
                            <ul className="mt-1.5 space-y-1">
                              {m.findings.map((f) => (
                                <li key={f.source} className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="text-muted-foreground">{f.label}</span>
                                  <span
                                    className={cn(
                                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                      f.status === "adverse"
                                        ? "bg-destructive/15 text-destructive"
                                        : f.status === "found"
                                          ? "bg-success/15 text-success"
                                          : "bg-muted text-muted-foreground",
                                    )}
                                  >
                                    {f.status === "adverse"
                                      ? "Adverse"
                                      : f.status === "found"
                                        ? "Found"
                                        : f.status === "not_found"
                                          ? "Nothing found"
                                          : f.status === "unavailable"
                                            ? "Not connected"
                                            : "Could not scan"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                      </RadioGroup>
                    )}
                    {/* The choice action lives on the heading row above. */}

                  </div>
                )}

                {/* Screening came back with nothing at all — say so, rather than leaving an empty
                    space where the choice controls would be. The search results above keep their
                    own selection controls in that case. */}
                {dealTx && mediaResults && mediaResults.length === 0 && (
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <p className="label-caps inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                      ONLINE MEDIA SCREENING RESULTS
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Screening returned no records — pick a counterparty from the search results above to
                      continue.
                    </p>
                  </div>
                )}

                {/* Once Intent is confirmed its frame is no longer the thing needing attention —
                    fold it into a small accordion under the screening results instead of leaving
                    it open at full size. */}
                {dealTx && stagePanel === "intent" && dealTx.intent_confirmed_at ? (
                  <div className="rounded-2xl border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => setConfirmedIntentOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
                      aria-expanded={confirmedIntentOpen}
                    >
                      <span className="label-caps rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                        Confirmed Intent
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", confirmedIntentOpen && "rotate-180")}
                      />
                    </button>
                    {confirmedIntentOpen && (
                      <div className="px-3.5 pb-3">
                        {/* `bare`: this accordion already carries the "Confirmed Intent"
                            heading, so the frame inside it must not add another one. */}
                        <InlineFrame
                          bare
                          tx={dealTx}
                          stage="trading"
                          step="intent"
                          reload={() => void reloadDeal()}
                          onClose={() => setStagePanel(null)}
                          onChangeParty={() => void reopenChoice()}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  dealTx && stagePanel && (
                    <InlineFrame
                      tx={dealTx}
                      stage={stagePanel === "wad" ? "compliance" : stagePanel === "business-docs" ? "execution" : "trading"}
                      step={stagePanel}
                      reload={() => void reloadDeal()}
                      onClose={() => {
                        setStagePanel(null);
                        if (stagePanel === "intent" && !dealTx.intent_confirmed_at) setIntentDismissed(true);
                      }}
                      onChangeParty={() => void reopenChoice()}
                    />
                  )
                )}

                {/* Only once Step 2's own documents (Business Docs) are in — not the moment the
                    compliance checks clear. Collapsed by default: it's a record to check back on,
                    and Execution is what needs attention by then. */}
                {dealTx?.wad_completed_at && stepOverrides["businessDocs"] === "done" && (
                  <div className="mt-1.5 rounded-2xl border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => setTradeSummaryOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
                      aria-expanded={tradeSummaryOpen}
                    >
                      <span className="label-caps rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                        Trade Summary
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", tradeSummaryOpen && "rotate-180")}
                      />
                    </button>
                    {tradeSummaryOpen && (
                      <div className="px-3.5 pb-3">
                        <TradeSummary tx={dealTx} />
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : null}
        </div>
        </div>
    </>
  );

  if (popout) {
    return <div className="min-h-screen bg-background p-4">{workspaceContent}</div>;
  }

  if (soloWorkspace || windowMode === "maximized") {
    return (
      <AppShell wide compactFooter hideFooter>
        {/* bottom-14 (not inset-4 on every side) leaves room for the taskbar of open deal tabs
            fixed to the viewport bottom, so the workspace stretches all the way down to it
            without ever drawing underneath it. Used both when this is the only workspace open
            and when it's explicitly maximized — in both cases it's the full screen, not a small
            floating window. */}
        <div className="fixed inset-x-4 top-[calc(7.5rem+1vh)] bottom-[calc(3.5rem+2.5vh-23px)] z-30 flex flex-col overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl">
          {workspaceContent}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell wide compactFooter hideFooter>
      <div
        className="fixed z-30 w-[min(1040px,calc(100vw-2rem))] rounded-2xl"
        style={{ left: posX, top: posY }}
      >
        {workspaceContent}
      </div>
    </AppShell>
  );
}
