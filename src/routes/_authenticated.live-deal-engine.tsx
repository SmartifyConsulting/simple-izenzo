import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Lock,
  Maximize2,
  Minimize2,
  Minus,
  MoreVertical,
  Move,
  Paperclip,
  Ban,
  Plus,
  X as XIcon,
  StopCircle,
  Pencil,
  User,
  RefreshCw,
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
import { CounterpartyWorkspaceView } from "@/components/canvas/CounterpartyWorkspaceView";
import { DocumentSummaryList } from "@/components/canvas/DocumentSummaryList";
import { MutualEngagementPanel } from "@/components/engagement/MutualEngagementPanel";
import { Confetti } from "@/components/effects/Confetti";
import { hasSeenOfferCelebration, markOfferCelebrationSeen } from "@/lib/celebrationSeen";
import { TradeSummary } from "@/components/canvas/TradeSummary";
// Performance only: the map and the classic stepper are each large and only one of them is on
// screen at a time, so they load as their own chunks instead of inside the first workspace
// download. Same components, same props, same behaviour.

import { SubmitterIdentity } from "@/components/canvas/SubmitterIdentity";
import { MatchResultsPanel } from "@/components/canvas/MatchResultsPanel";

const ClassicView = lazy(() =>
  import("@/components/canvas/ClassicView").then((m) => ({ default: m.ClassicView })),
);
const MapView = lazy(() => import("@/components/canvas/MapView").then((m) => ({ default: m.MapView })));
import { DocumentUploadStep } from "@/components/guided/DocumentUploadStep";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { loadRelevantCounterparties } from "@/lib/bidRelevance";
import { nameKey } from "@/lib/dedupeOrgs";
import { advance, fallbackReference, recordEvent, swapReferencePrefix, tradeKindOf, type TradeKind, type Transaction } from "@/lib/tx";
import type { StageKey } from "@/lib/spine";
import { openingFrameFor } from "@/lib/openingFrame";
import { useAuth } from "@/lib/auth";
import { classifyTradeSide, searchCounterparties } from "@/lib/izenzo.functions";

import { runBackgroundScreening, type ScreeningResult } from "@/lib/screening.functions";
import { runOnlineMediaChecks, type MediaCheckResult, type MediaFinding } from "@/lib/onlineMedia.functions";
import { listVerificationsForTx } from "@/lib/didit.functions";
import { summarizeBidDocuments } from "@/lib/docSummary.functions";
import { cancelBid } from "@/lib/cancelBid.functions";
import { runComplianceSnapshot } from "@/lib/complianceSnapshot.functions";
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

type Attachment = {
  name: string;
  kind: "ID" | "ID front" | "ID back" | "Document" | "NDA" | "MOU" | "Contract" | "Certificate" | "Authority to Act";
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
        // A deal this org was chosen as the counterparty on belongs in the tab bar too — not just
        // ones it registered itself. Restricting to org_id alone meant opening one as a
        // counterparty found no matching row here, so the tab fell back to a bare "ID…" label
        // (fallbackReference has no real reference to work from) even though the deal itself has
        // a real BID/OFF reference.
        .or(`org_id.eq.${org!.id},counterparty_org_id.eq.${org!.id}`)
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
  // Set when a `?tx=` link could not be opened. Without this the loader returned silently and the
  // page fell through to an empty canvas, which looked like a brand-new workspace with a fresh ID
  // rather than a deal that failed to load.
  const [dealLoadError, setDealLoadError] = useState<string | null>(null);
  // Set when a search finished and found nothing relevant, so Bid Information can show what was
  // searched for and let the person refine it instead of implying a search is still running.
  const [noMatchesTx, setNoMatchesTx] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);
  // Stop/Edit while the search is still running, on the slim progress bar itself — the Search
  // Results accordion below stays hidden until there's something to show, so these are the only
  // controls available in the meantime.
  const [topEditingSearch, setTopEditingSearch] = useState(false);
  const [topEditedPrompt, setTopEditedPrompt] = useState("");
  const [screening, setScreening] = useState(false);
  const [screeningResults, setScreeningResults] = useState<ScreeningResult[] | null>(null);
  const [mediaRunning, setMediaRunning] = useState(false);
  // Checked between counterparties in the screening loop — the in-flight request for the current
  // counterparty is left to finish naturally, but no further ones are started once this is set.
  const mediaStopRequested = useRef(false);
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
  /** Name of the chosen counterparty, so the folded frame can say who without being opened. */
  const [chosenPartyName, setChosenPartyName] = useState<string | null>(null);
  // Every currently shortlisted company, so the Search Results header can name all of them (not
  // just the one eventually chosen). Polled (rather than sharing CounterpartyRecord's own
  // ["counterparties", txId] cache entry, which holds a different select() shape) so it stays
  // current as shortlisting changes.
  const { data: shortlistedNames = [] } = useQuery({
    queryKey: ["shortlisted-names", dealTx?.id],
    enabled: Boolean(dealTx?.id),
    // The shortlist can still change while the person is choosing, so it keeps polling until a
    // counterparty is actually recorded — after that the list is settled and the poll stops.
    refetchInterval: dbHasChosenParty ? false : 4000,
    queryFn: async () => {
      const rows = await loadRelevantCounterparties(dealTx!.id);
      return rows
        .filter((c) => c.shortlisted)
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
        .map((c) => c.name);
    },
  });

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
    // Start from whatever this bid's own row already has, never a previous bid's leftover value
    // (the earlier bug this guarded against) — but unlike hardcoding null, this doesn't also wipe
    // out a summary (or a recorded read failure) the new bid already had saved. Resetting to null
    // unconditionally here ran *after* the loader above had already set the real value (both fire
    // off the same dealTx.id change), so an old bid's saved summary got overwritten back to null
    // the moment its tab was opened, which then made the "not yet summarised" fast path re-run the
    // AI read on every document again — even though nothing about the bid had changed.
    const freshTx = dealTx as unknown as {
      document_summary?: string | null;
      document_summary_error?: string | null;
    } | null;
    setDocumentSummary(freshTx?.document_summary ?? null);
    setReadError(freshTx?.document_summary_error ?? null);
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
      const { data, count } = await supabase
        .from("counterparties")
        .select("id, name", { count: "exact" })
        .eq("transaction_id", dealTx.id)
        .eq("status", "chosen");
      if (live) {
        setHasChosen((count ?? 0) > 0);
        setDbHasChosenParty((count ?? 0) > 0);
        setChosenPartyName(data?.[0]?.name ?? null);
      }
    })();
    return () => {
      live = false;
    };
  }, [dealTx?.id]);
  // media_flags on each counterparty is where Online Media Screening's findings are actually
  // persisted (see onlineMedia.functions.ts) — mediaResults above is otherwise plain session-local
  // state that resets to null on every fresh page load, which made the whole "Online Scanning
  // Results" accordion vanish on reload even though the checks had already run. Read it straight
  // back from the counterparties that have it, rather than only ever setting it from a live run.
  useEffect(() => {
    if (!dealTx?.id) return;
    let live = true;
    (async () => {
      const { data } = await supabase
        .from("counterparties")
        .select("id, name, media_flags")
        .eq("transaction_id", dealTx.id)
        .not("media_flags", "is", null);
      if (!live) return;
      const rows = (data ?? []) as unknown as {
        id: string;
        name: string;
        media_flags: { findings?: MediaFinding[] } | null;
      }[];
      // Only counterparties that were actually scanned belong here (search results carry
      // media_flags too, for their evidence), and the same organisation found by both AI and AI+ is
      // listed once.
      const scanned = new Map<string, (typeof rows)[number]>();
      for (const r of rows) {
        if (!r.media_flags?.findings?.length) continue;
        const key = nameKey(r.name) || r.id;
        const kept = scanned.get(key);
        if (!kept || (r.media_flags.findings?.length ?? 0) >= (kept.media_flags?.findings?.length ?? 0)) {
          scanned.set(key, r);
        }
      }
      if (scanned.size > 0) {
        setMediaResults((prev) =>
          prev ??
          [...scanned.values()].map((r) => ({
            counterpartyId: r.id,
            name: r.name,
            findings: r.media_flags?.findings ?? [],
          })),
        );
      }
    })();
    return () => {
      live = false;
    };
  }, [dealTx?.id]);
  // `dbHasChosenParty` is also set optimistically by finalizeChoice/startMediaChecks, so the name
  // is re-read whenever it flips rather than only on switching deals.
  useEffect(() => {
    if (!dealTx?.id) return;
    if (!dbHasChosenParty) {
      setChosenPartyName(null);
      return;
    }
    let live = true;
    (async () => {
      const { data } = await supabase
        .from("counterparties")
        .select("name")
        .eq("transaction_id", dealTx.id)
        .eq("status", "chosen")
        .limit(1);
      if (live) setChosenPartyName(data?.[0]?.name ?? null);
    })();
    return () => {
      live = false;
    };
  }, [dealTx?.id, dbHasChosenParty]);


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
  const classifySide = useServerFn(classifyTradeSide);
  const runComplianceCheck = useServerFn(runComplianceSnapshot);
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
  // Opened explicitly the moment a search starts (see setSearchResultsOpen(txId, true) below) —
  // this bare default only matters on a page refresh of an existing deal, where nothing "starts"
  // to trigger that call. Collapsed there, like every other frame on reload, rather than
  // reopening on its own regardless of where the deal actually is.
  const searchResultsOpen = dealTx ? (searchResultsOpenByTx[dealTx.id] ?? false) : false;
  // Once a party is actually chosen the choice is settled: this folds back into the plain
  // "Search Results" record instead of staying open.
  useEffect(() => {
    if (!dealTx || !dbHasChosenParty) return;
    setSearchResultsOpenByTx((prev) => ({ ...prev, [dealTx.id]: false }));
  }, [dealTx?.id, dbHasChosenParty]);
  // Online media screening taking over is what the search results make way for: the record folds
  // itself the moment screening starts, leaving the screen to the screening list below it.
  useEffect(() => {
    if (!dealTx || !mediaRunning) return;
    setSearchResultsOpenByTx((prev) => ({ ...prev, [dealTx.id]: false }));
  }, [dealTx?.id, mediaRunning]);
  // Documents: attachments and the certificates the deal produces, in their own folded frame
  // under Bid Information. Never opened automatically — filing a certificate is quiet.

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
  // Step 1 · Trading bundles every completed Trading-stage record (Bid Registration, Bid
  // Information, Search Results, Online Scanning Results, Confirmed Intent, Seal Intent, Offer)
  // behind one collapsed-by-default accordion, so a deal that's moved on doesn't keep the whole
  // trail of how it got here taking up the top of the workspace. Compliance/Execution frames
  // further down are untouched by this — only Step 1's own records are gated on it.
  const [step1Open, setStep1Open] = useState(false);
  const [step2Open, setStep2Open] = useState(false);
  const [step3Open, setStep3Open] = useState(false);
  // Once Intent is confirmed, its frame folds into a small accordion nested under Online Media
  // Screening Results rather than staying open as its own full-size panel.
  const [confirmedIntentOpen, setConfirmedIntentOpen] = useState(false);

  // The sealed Proof of Intent folds the same way — closed until the certificate is wanted.
  const [sealedPoiOpen, setSealedPoiOpen] = useState(false);
  // The Offer has its own frame. Collapsed on a fresh page load like every other frame — opened
  // explicitly the moment Seal Intent actually happens (see below) rather than defaulting open,
  // which previously meant reloading an existing deal always showed it open regardless of where
  // the negotiation actually stood.
  const [offerFrameOpen, setOfferFrameOpen] = useState(false);
  // Cleared WaD case — same folded-record treatment, closed until wanted.
  const [sealedWadOpen, setSealedWadOpen] = useState(false);
  // Opens the Offer frame the moment sealing actually happens live in this session — distinct
  // from a page load (or a switch to a different tab) that finds the deal already sealed, which
  // leaves it collapsed like every other frame. Tracked per transaction id: the first time this
  // effect sees a given deal, it only records where poi_sealed_at already stood — never opens the
  // frame off that baseline read — and only a later, live transition from null to set (for that
  // same tx id) actually opens it.
  const lastSeenSealRef = useRef<{ txId: string; poiSealedAt: string | null } | null>(null);
  useEffect(() => {
    if (!dealTx) return;
    const current = dealTx.poi_sealed_at ?? null;
    const last = lastSeenSealRef.current;
    if (last && last.txId === dealTx.id && !last.poiSealedAt && current) setOfferFrameOpen(true);
    lastSeenSealRef.current = { txId: dealTx.id, poiSealedAt: current };
  }, [dealTx?.id, dealTx?.poi_sealed_at]);

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

  // The counterparty's own identity, once Seal Intent has actually happened — shown alongside the
  // bidder's in Bid Registration, in blue (the counterparty's colour everywhere else in this
  // workspace), with the same KYC/KYB verification status the WaD gate itself tracks.
  const { data: counterpartyIdentity } = useQuery({
    queryKey: ["counterparty-identity", dealTx?.id, dealTx?.poi_sealed_at],
    enabled: Boolean(dealTx?.id && dealTx?.poi_sealed_at),
    queryFn: async () => {
      const [{ data: cp }, { data: diligence }] = await Promise.all([
        supabase
          .from("counterparties")
          .select("name")
          .eq("transaction_id", dealTx!.id)
          .eq("status", "chosen")
          .maybeSingle(),
        supabase
          .from("engagement_diligence")
          .select("kyc_state, kyb_state")
          .eq("transaction_id", dealTx!.id)
          .eq("reviewer_side", "counterparty")
          .maybeSingle(),
      ]);
      // The link between this deal and the counterparty's own organisation lives on the
      // transaction itself (set once they claim the match), not on the counterparties row.
      const orgId = dealTx!.counterparty_org_id;
      const { data: org } = orgId
        ? await supabase.from("organisations").select("created_at").eq("id", orgId).maybeSingle()
        : { data: null };
      const settled = ["passed", "waived"];
      const row = diligence as { kyc_state?: string; kyb_state?: string } | null;
      const verified = Boolean(row && settled.includes(row.kyc_state ?? "") && settled.includes(row.kyb_state ?? ""));
      return {
        name: (cp as { name?: string | null } | null)?.name ?? null,
        activeSince: (org as { created_at?: string } | null)?.created_at ?? null,
        verified,
      };
    },
  });

  // Same query key DocumentUploadStep uses, so once a file is attached there (or here) both
  // stay in sync off one cache entry rather than each polling storage independently.
  const workspaceKind: TradeKind = tradeKindOf(
    (dealTx as unknown as { reference?: string | null } | null)?.reference ?? activity?.reference ?? draftReference,
  );
  const kindWord = workspaceKind === "offer" ? "Offer" : workspaceKind === "bid" ? "Bid" : "Bid/Offer";
  const registrationLabel = `${kindWord} Registration`;
  const informationLabel = `${kindWord} Information`;
  // Plain grey, the same as every other form-heading pill in this workspace — Bid Registration
  // isn't a special case just because a bid/offer has a colour of its own elsewhere on the card.
  const registrationPill = "bg-[var(--lw-pill-bg)] text-[var(--lw-pill-fg)]";
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
  // AI summarisation (below) is a Bid Information thing — it reads whatever was uploaded up front to
  // help find a counterparty. Legal Agreements and certificates get attached much later, for an
  // entirely different reason, and were still triggering a fresh "documents summarised" read just
  // because they landed in the same shared `documents` table and bumped workspaceDocs.length.
  const bidInfoDocCount = useMemo(
    () => workspaceDocs.filter((d) => d.notes !== "Legal Agreement" && d.doc_type !== "certificate").length,
    [workspaceDocs],
  );
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
                  : d.doc_type === "authority-to-act"
                    ? "Authority to Act"
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
  // submittedBids/sessionStorage are both ephemeral — cleared or simply absent whenever a deal is
  // resumed fresh (a different tab, a later visit, sessionStorage unavailable). The transaction's
  // own persisted step is the one signal that always survives a resume: once it has moved off
  // "documents" the ask was genuinely made, however that happened, and the upload/search-prompt
  // frame must never come back to ask again. This was the actual cause of a keyword-only bid
  // reopening to the upload screen after being left and resumed.
  const submittedForThisBid = dealTx ? submittedBids.has(dealTx.id) || dealTx.step !== "documents" : false;
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
      bidInfoDocCount === 0 ||
      !documentSummary ||
      !GENERIC_TITLES.has(dealTx.title) ||
      titleGenerationStarted.current === dealTx.id
    ) return;
    titleGenerationStarted.current = dealTx.id;
    void rereadDocuments(dealTx.id);
  }, [dealTx?.id, dealTx?.title, documentSummary, bidInfoDocCount]);

  // Documents attached: (re-)read them into a summary. Keyed by how many files this deal has been
  // summarised for, not just "has a summary at all" — so dropping another file after the first
  // summary already exists still triggers a fresh read that folds it in, rather than only ever
  // reading once per deal. Debounced so several files dropped together produce one read, not one
  // per file.
  const summarizedDocCount = useRef<Record<string, number>>({});
  const rereadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dealTx || bidInfoDocCount === 0 || rereading) return;
    const txId = dealTx.id;
    if (summarizedDocCount.current[txId] === bidInfoDocCount) return;
    // A bid opened for the first time this session has no entry in the ref yet, which otherwise
    // looks identical to "never summarised" even when it already has a summary (or a recorded read
    // failure) saved from an earlier session — trust that existing outcome instead of re-reading
    // every document again just because this is the first time this tab has been clicked since the
    // page loaded. A genuine failed read still surfaces via readError and the "Try again" button;
    // it just doesn't retry itself automatically.
    if (summarizedDocCount.current[txId] === undefined && (documentSummary || readError)) {
      summarizedDocCount.current[txId] = bidInfoDocCount;
      return;
    }
    if (rereadDebounceRef.current) clearTimeout(rereadDebounceRef.current);
    rereadDebounceRef.current = setTimeout(() => {
      summarizedDocCount.current[txId] = bidInfoDocCount;
      void rereadDocuments(txId);
    }, 1200);
    return () => {
      if (rereadDebounceRef.current) clearTimeout(rereadDebounceRef.current);
    };
  }, [dealTx?.id, bidInfoDocCount, rereading, documentSummary, readError]);


  // Has interest already been fetched for this bid? Drives the "Fetch Interest" button, so it
  // stays offered for any bid that has documents but no matches yet — not only in the moment
  // straight after an upload.
  const { data: interestCount = 0, isPending: interestCountPending } = useQuery({
    queryKey: ["counterparties-count", dealTx?.id],
    enabled: Boolean(dealTx?.id),
    queryFn: async () => {
      // Counted by the same relevance rule the list uses, so unrelated leftovers never make a
      // search look like it found something.
      return (await loadRelevantCounterparties(dealTx!.id)).length;
    },
  });

  // Counterparty search starts itself once "go" is pressed — immediately when there are no
  // documents (the typed Search field is enough to search on), or once the read has finished when
  // there are, so it searches on what the documents actually say rather than on their file names.
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
      rereading ||
      (workspaceDocs.length > 0 && !(documentSummary || readError)) ||
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

  /** Whose move the Offer ⇄ Counter Offer loop is waiting on, read from the engagement responses
   * both sides already record. "counterparty" = the bidder's offer is with them and nobody has
   * answered yet; "counteroffer" = they countered and the bidder needs to answer; "offer" = the
   * bidder has re-submitted and it's the counterparty's turn again. "accepted"/"opted_out" once
   * the offer is settled either way. */
  const { data: negotiationTurn } = useQuery({
    queryKey: ["negotiation-turn", dealTx?.id],
    enabled: Boolean(dealTx?.id && dealTx?.poi_sealed_at && !dealTx?.wad_completed_at),
    // The other party accepting/countering while this tab sits open and idle has nothing to
    // invalidate this specific query on this browser otherwise (their action only invalidates it
    // on their own client) — polling is what keeps a stale "whose turn" reading from lingering.
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("engagement_responses")
        .select("responder_side, response, created_at")
        .eq("transaction_id", dealTx!.id)
        .order("created_at", { ascending: true });
      const rows = (data ?? []) as { responder_side: string; response: string }[];
      const last = rows[rows.length - 1];
      if (!last) return "counterparty" as const;
      if (last.response === "challenged") {
        return last.responder_side === "counterparty" ? ("counteroffer" as const) : ("offer" as const);
      }
      return last.response === "accepted" ? ("accepted" as const) : ("opted_out" as const);
    },
  });

  // The moment the offer is accepted, the Offer frame collapses and Without a Doubt takes over —
  // it doesn't appear alongside a still-open Offer.
  useEffect(() => {
    if (negotiationTurn !== "accepted" || !dealTx || dealTx.wad_completed_at) return;
    setOfferFrameOpen(false);
    setStagePanel((prev) => (prev === "wad" ? prev : "wad"));
  }, [negotiationTurn, dealTx?.id, dealTx?.wad_completed_at]);

  // A brief confetti moment the first time this browser sees an approved offer on this deal —
  // whether that's live, right after clicking Accept, or the next time the bidder opens this
  // screen having been away when the counterparty approved it. Never repeats after that first
  // sighting (see celebrationSeen.ts).
  const [celebrateApproval, setCelebrateApproval] = useState(false);
  useEffect(() => {
    if (!dealTx || (negotiationTurn !== "accepted" && !dealTx.wad_completed_at)) return;
    if (hasSeenOfferCelebration(dealTx.id)) return;
    markOfferCelebrationSeen(dealTx.id);
    setCelebrateApproval(true);
  }, [negotiationTurn, dealTx?.id, dealTx?.wad_completed_at]);

  // Step 1 opens itself the moment there's genuinely live work in it that needs attention — a
  // search or screening actually running, a choice sitting there waiting to be made, or an
  // unresolved Offer someone still needs to accept/counter/reject — rather than leaving those
  // behind a manual click just because the accordion defaults closed. Once the offer is settled
  // (accepted/opted_out) it's just a record again and can stay collapsed like everything else.
  const offerUnresolved = Boolean(
    dealTx?.poi_sealed_at &&
      !dealTx?.wad_completed_at &&
      negotiationTurn &&
      negotiationTurn !== "accepted" &&
      negotiationTurn !== "opted_out",
  );
  useEffect(() => {
    if (flowStep === "searching" || mediaRunning || choicePending) setStep1Open(true);
    if (offerUnresolved) setStep2Open(true);
  }, [flowStep, mediaRunning, choicePending, offerUnresolved]);

  /** Continue on the cleared Without a Doubt gate. This is the one deliberate hand-off into
   * execution: the moment is stamped on the transaction so the Legal Agreements pulse (and every
   * other device reading the deal) can see the bidder actually went there, the workflow's own step
   * moves on so the gate is genuinely behind them, and Step 3 is opened in place of Steps 1 and 2.
   *
   * Stamped with an update rather than advance() alone: advance() only writes stage/step, and the
   * whole point of this column is to distinguish "WaD cleared" from "bidder continued past it".
   *
   * The folding is done here rather than left to the effect below, because this is a live click:
   * the person has just finished with Steps 1 and 2 and should see them close as Step 3 opens, the
   * same collapse-on-advance every other hand-off in this workspace gets. The effect covers arriving
   * at a deal that was already continued; it deliberately leaves the frames alone once it has. */
  async function continueFromWad() {
    if (!dealTx) return;
    await supabase
      .from("transactions")
      .update({
        wad_continued_at: dealTx.wad_continued_at ?? new Date().toISOString(),
        stage: "execution",
        step: "business-docs",
      } as never)
      .eq("id", dealTx.id);
    await reloadDeal();

    // Step 1 (every trading record) and Step 2 (the WaD gate) are now behind the deal — collapse
    // both, and open Step 3's frame so execution is what's on screen.
    setStep1Open(false);
    setConfirmedIntentOpen(false);
    setSealedPoiOpen(false);
    setOfferFrameOpen(false);
    setSealedWadOpen(false);
    setTradeSummaryOpen(false);
    setMapPanel(null);
    setStagePanel("business-docs");
  }

  // Where the workspace should land around the WaD hand-off. Deliberately transition-based rather
  // than derived on every render: once the bidder has moved on, the frames stay theirs to open and
  // close. What this covers is arriving at a deal — a reload or a tab switch with no live event to
  // hang off — so a cleared deal opens on the gate that still needs continuing, and a continued one
  // opens where Continue sent it rather than back on the finished gate.
  const wadHandoffRef = useRef<{ txId: string; continued: boolean } | null>(null);
  useEffect(() => {
    if (!dealTx || !dealTx.wad_completed_at) return;
    const continued = Boolean(dealTx.wad_continued_at);
    const prev = wadHandoffRef.current;
    const firstLook = !prev || prev.txId !== dealTx.id;
    const justChanged = Boolean(prev && prev.txId === dealTx.id && prev.continued !== continued);
    wadHandoffRef.current = { txId: dealTx.id, continued };
    if (!firstLook && !justChanged) return;

    // A cleared WaD folds away and Legal Agreements opens as the one active frame.
    setStep1Open(false);
    setSealedWadOpen(false);
    setStagePanel("business-docs");
  }, [dealTx?.id, dealTx?.wad_completed_at, dealTx?.wad_continued_at]);

  /** Which workflow item is genuinely current right now — the stored stage/step can't tell
   * "searching" apart from "results are in", so the page says it outright. Search AI + AI+ and
   * Online Media Screening are two separate, independently-timed operations — each pulses only
   * while it is itself actually running, not just because the other one is. */
  const stepOverrides = useMemo(() => {

    const o: Record<string, "locked" | "open" | "active" | "done"> = {};
    if (!dealTx) return o;
    o["bidRegistration"] = "done";
    // Pulses only while genuinely still on Upload Files with nothing attached. Once a search has
    // actually been run (flowStep moved past "documents"), no documents means none are coming —
    // Upload Files reads as done rather than pulsing forever for something that isn't arriving,
    // and the rest of the map (Search, Search Results, Choice…) can pulse normally instead of
    // this function returning early every time and leaving the whole map stuck on this tile.
    if (workspaceDocs.length === 0 && flowStep === "documents") {
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
        // The Offer ⇄ Counter Offer loop is its own turn-taking exchange, so the pulse follows
        // whose move it is rather than sitting on the checks row. "counterparty" and "offer" both
        // mean the counterparty still has to answer — the bidder is waiting, so Counter Offer
        // pulses (it's the response everyone's watching for). "counteroffer" means the
        // counterparty just answered and it's the bidder's turn — the pulse moves to Offer. It
        // keeps bouncing between the two, whichever, until someone actually accepts.
        // Built as one mutually-exclusive "whose turn" phase rather than three independent
        // ternaries — Offer, Counter Offer and Without a Doubt all share the same stage/step, so
        // three separate conditions that individually happened to agree (or a stale/loading
        // negotiationTurn value) could previously leave more than one reading "active" at once.
        // Computing a single phase up front and deriving all three from it makes that structurally
        // impossible: exactly one of them (or none, once WaD is cleared) is ever "active".
        const phase: "counterOffer" | "offer" | "wad" | "none" = dealTx.wad_completed_at
          ? "none"
          : negotiationTurn === "accepted"
            ? "wad"
            : negotiationTurn === "counteroffer"
              ? "offer"
              : negotiationTurn === "counterparty" || negotiationTurn === "offer"
                ? "counterOffer"
                : "none";
        o["counterOffer"] = phase === "counterOffer" ? "active" : "open";
        o["offer"] = phase === "offer" ? "active" : "open";
        // The KYC/KYB/PEP/AML checks now run before Without a Doubt: the pulse sits on the
        // checks row while they are outstanding, and the gate row only turns green with them.
        o["kycKyb"] = dealTx.wad_completed_at ? "done" : "active";
        // Green pulse moves to WaD itself the moment the offer is accepted — not just once WaD
        // is fully cleared.
        // Cleared, but the bidder has not yet continued past it — the pulse stays on WaD itself so
        // the Continue button is what draws the eye. Legal Agreements is deliberately left not
        // pulsing until then: it is not the current step until the bidder has been sent there.
        // WaD and Legal Agreements never pulse together: the moment the certificate issues, WaD is
        // done and the pulse hands straight over to Legal Agreements.
        o["wad"] = !dealTx.wad_completed_at ? (phase === "wad" ? "active" : "open") : "done";
        if (dealTx.wad_completed_at) {
          o["businessDocs"] =
            dealTx.stage === "compliance" || dealTx.step === "business-docs" ? "active" : "done";
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
        const wadContinued = Boolean(dealTx.wad_continued_at);
        void wadContinued;
        o["kycKyb"] = dealTx.wad_completed_at ? "done" : "active";
        o["wad"] = !dealTx.wad_completed_at ? "open" : "done";
        if (dealTx.wad_completed_at) {
          o["businessDocs"] =
            dealTx.stage === "compliance" || dealTx.step === "business-docs" ? "active" : "done";
          if (o["businessDocs"] === "done") {
            o["execution"] = "active";
            o["preparation"] = "active";
          }

        }

      }
    }
    return o;
  }, [
    dealTx,
    flowStep,
    mediaRunning,
    mediaResults,
    screening,
    screeningResults,
    hasChosen,
    intentDismissed,
    negotiationTurn,
    workspaceDocs.length,
  ]);

  // Step 2 · GRC is finished once every legal agreement is signed by both parties. Shares the
  // Legal Agreements query key so a signature refreshes this immediately.
  const { data: legalDocs = [] } = useQuery({
    queryKey: ["legal-agreements", dealTx?.id],
    enabled: Boolean(dealTx?.id && dealTx?.wad_completed_at),
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("transaction_id", dealTx!.id)
        .eq("notes", "Legal Agreement")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const legalAllSigned =
    legalDocs.length > 0 &&
    legalDocs.every((d) => Boolean((d as { fully_signed_at?: string | null }).fully_signed_at));
  const grcDone = Boolean(
    dealTx?.wad_completed_at && (legalAllSigned || stepOverrides["businessDocs"] === "done"),
  );
  // Workflow hand-offs: confirmed Intent folds Step 1 and opens Step 2; a finished GRC folds
  // Step 2 and opens Step 3. Only on the transition (or first look at a deal), so manual +/−
  // still works afterwards.
  const stepFlowRef = useRef<{ txId: string; phase: number } | null>(null);
  useEffect(() => {
    if (!dealTx) return;
    const phase = grcDone ? 3 : dealTx.intent_confirmed_at ? 2 : 1;
    const prev = stepFlowRef.current;
    stepFlowRef.current = { txId: dealTx.id, phase };
    if (prev && prev.txId === dealTx.id && prev.phase === phase) return;
    if (phase === 1) return;
    setStep1Open(false);
    setStep2Open(phase === 2);
    setStep3Open(phase === 3);
  }, [dealTx?.id, dealTx?.intent_confirmed_at, grcDone]);



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
    // A new party has been picked, so an intent confirmed against the previous one no longer
    // applies: clear it so it can be granted again for this party. A *sealed* Proof of Intent is
    // a governance milestone and is never unwound — the deal stays with the party it names.
    if (dealTx.poi_sealed_at) {
      toast.error("Intent is sealed for this bid — the counterparty can no longer change.");
      return;
    }
    if (dealTx.intent_confirmed_at) {

      await supabase
        .from("transactions")
        .update({ intent_confirmed_at: null })
        .eq("id", dealTx.id);
      await recordEvent({
        transactionId: dealTx.id,
        stage: "trading",
        step: "intent",
        action: "intent_reopened",
        summary: "Intent reopened — a different counterparty was chosen",
      });
      setDealTx((prev) => (prev ? { ...prev, intent_confirmed_at: null } : prev));

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
    // This frame is the current step now — it opens itself rather than waiting to be clicked
    // open; finalizeChoice already folds it away again the moment the workspace moves on.
    setMediaResultsOpen(dealTx.id, true);
    mediaStopRequested.current = false;
    const collected: MediaCheckResult[] = [];
    let scanned = 0;
    let stopped = false;
    try {
      for (const counterpartyId of counterpartyIds) {
        if (mediaStopRequested.current) {
          stopped = true;
          break;
        }
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
      if (stopped) {
        toast("Online media screening stopped — showing what was found so far.");
      } else {
        await recordEvent({
          transactionId: dealTx.id,
          stage: "trading",
          step: "online-media",
          action: "online_media_checked",
          summary: `Online media checked for ${collected.length} counterpart${collected.length === 1 ? "y" : "ies"}`,
        });
        toast.success("Online media screening complete");
      }
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
      // Intent signed → Proof of Intent; sealed → the Offer takes over (its own frame, above);
      // Without a Doubt only opens once the offer is actually accepted — it waits its turn rather
      // than appearing alongside the still-open Offer; cleared → fold it away.
      if (fresh.wad_completed_at) {
        setSealedWadOpen(false);
        setStagePanel("business-docs");
      } else if (fresh.poi_sealed_at) {
        const { data: lastResponse } = await supabase
          .from("engagement_responses")
          .select("response")
          .eq("transaction_id", fresh.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setStagePanel((lastResponse as { response?: string } | null)?.response === "accepted" ? "wad" : null);
      } else if (fresh.intent_confirmed_at) {
        setStagePanel("poi");
      } else {
        setStagePanel("intent");
      }
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
      // The screening record has served its purpose — fold it so Intent has the room.
      setMediaResultsOpen(dealTx.id, false);
      setDbHasChosenParty(true);
      toast.success("Choice recorded — confirm the intent to continue");

      // The counterparty is emailed only once intent is actually confirmed (see IntentStep's
      // confirm() in StepScreen.tsx) — choosing them here is not yet a commitment worth reaching
      // out on.

      // A lightweight, automated go/no-go signal on the organisation just chosen — a registry
      // lookup plus one focused sanctions/adverse-media search, never a hosted verification the
      // counterparty would need to complete. Best-effort: it never undoes the choice, and it
      // never claims a clean result it didn't actually check for.
      runComplianceCheck({ data: { counterpartyId } })
        .then((res) => {
          if (res.verdict === "red") {
            toast.warning(
              `Cursory web compliance check raised ${res.flags.length} concern${res.flags.length === 1 ? "" : "s"} on this counterparty: ${res.flags.map((f) => f.reason).join(" · ")}. This isn't the formal check — that runs at Without a Doubt.`,
              { duration: 12000 },
            );
          } else if (res.verdict === "green") {
            toast.success(
              "Cursory web compliance check: no sanctions, fraud or legal concerns found. The formal KYC/KYB check still runs at Without a Doubt.",
            );
          }
          // "unknown" (nothing configured, or the search failed) stays quiet here — it's recorded
          // as Neutral rather than presented as either a pass or a failure.
        })
        .catch(() => {
          // Best-effort only — never blocks or alarms over a check that simply couldn't run.
        });

    } catch (err) {
      toast.error((err as Error).message || "Couldn't record that choice — please try again.");
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
    setDealLoadError(null);
    (async () => {
      try {
        const { data: txRow } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", txParam)
          .maybeSingle();
        if (!txRow) {
          // Either the deal doesn't exist or this account can't see it. Saying so is the point: a
          // silent return here left the visitor on an empty canvas that looked like a new workspace.
          setDealLoadError(
            "That deal couldn't be opened on this account. If you were invited to it as the counterparty, use the link from your invitation email so it can be linked to your company first.",
          );
          return;
        }
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

        // Opening a bid by its ID (a hyperlink from a report or another screen) should land on the
        // step the deal is actually up to, with that frame already expanded — otherwise the
        // workspace opens on a column of collapsed headings and there's no sign of what to do next.
        // Only the one current frame is opened; the rest stay folded away as records.
        switch (openingFrameFor(tx).kind) {
          case "businessDocs":
            setSealedWadOpen(false);
            if (tx.step === "business-docs") setStagePanel("business-docs");
            break;
          case "sealedWad":
            setSealedWadOpen(true);
            break;
          case "offer":
            // Negotiation is live — the Offer frame is the thing waiting on someone.
            setOfferFrameOpen(true);
            break;
          case "sealedPoi":
            setSealedPoiOpen(true);
            break;
          case "confirmedIntent":
            setConfirmedIntentOpen(true);
            break;
        }
        // Step 1 holds the record of how the deal got here; it only needs to be open while its own
        // work is still live, which the stepOverrides-driven effect above already handles.
        setStep1Open(false);
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

  // An empty workspace still gets its number up front (WS…, until its search is categorised as a
  // Bid or an Offer), so the map can show it rather than waiting for the first upload.
  useEffect(() => {
    if (dealTx || draftReference) return;
    let cancelled = false;
    void claimReference("workspace").then((ref) => {
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
  /** Once the AI has categorised the search — for a seller (a Bid) or for a buyer (an Offer) — the
   * workspace becomes that: the number's WS prefix turns into BID or OFF and every label follows. */
  async function applyClassification(txId: string, direction: "bid" | "offer") {
    const { data: row } = await supabase.from("transactions").select("reference").eq("id", txId).maybeSingle();
    const currentReference = (row as { reference?: string | null } | null)?.reference ?? dealTx?.reference ?? "";
    if (tradeKindOf(currentReference) === direction) return;
    const newReference = swapReferencePrefix(currentReference || fallbackReference(txId, direction), direction);
    const newTitle = direction === "bid" ? "New Bid" : "New Offer";
    const [{ error: boError }, { error: txError }] = await Promise.all([
      supabase.from("bid_offers").update({ direction }).eq("transaction_id", txId),
      supabase.from("transactions").update({ reference: newReference, title: newTitle }).eq("id", txId),
    ]);
    if (boError || txError) {
      toast.error("Could not record whether this is a bid or an offer.");
      return;
    }
    setDealTx((prev) => (prev && prev.id === txId ? { ...prev, reference: newReference, title: newTitle } : prev));
    setActivity((prev) => (prev ? { ...prev, direction, reference: newReference, title: newTitle } : prev));
    toast.success(
      direction === "bid"
        ? `Searching for a seller — recorded as bid ${newReference}.`
        : `Searching for a buyer — recorded as offer ${newReference}.`,
    );
  }

  /** Asks the AI whether the person is searching for a seller or for a buyer, before the search
   * runs. Only ever happens while the workspace is still a plain Workspace.
   *
   * The reference and every Bid/Offer label are only ever changed once the AI is actually certain.
   * A search that is only keywords, with nothing in the wording pointing either way, must not have
   * its ID or labels committed to Bid or Offer on a guess — it stays a plain Workspace (ID…) until
   * a clearer search or an uploaded document resolves it. The search itself still runs regardless:
   * bid_offers already defaults to "bid" internally, so nothing here blocks finding counterparties —
   * this only decides whether the visible identity of the workspace changes. */
  async function categoriseSearch(txId: string) {
    try {
      const { data: row } = await supabase.from("transactions").select("reference").eq("id", txId).maybeSingle();
      if (tradeKindOf((row as { reference?: string | null } | null)?.reference) !== "workspace") return;
      const { direction } = await classifySide({ data: { transactionId: txId } });
      if (direction) await applyClassification(txId, direction);
    } catch {
      // Could not be categorised (e.g. offline) — leave the workspace as it is rather than
      // guessing. Never blocks the search itself.
    }
  }

  /** Saves the edited search string onto the bid and runs the search again on it — the "Edit
   * Search" action in the Search Results record. */
  async function refineSearch(txId: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setRefining(true);
    try {
      const { error } = await supabase.from("transactions").update({ search_prompt: trimmed }).eq("id", txId);
      if (error) {
        toast.error(`Your search could not be saved: ${error.message}`);
        return;
      }
      setDealTx((prev) => (prev ? ({ ...prev, search_prompt: trimmed } as Transaction) : prev));
      setNoMatchesTx(null);
      await runSearch(txId);
    } finally {
      setRefining(false);
    }
  }

  /** Gives up watching a search that's taking a long time (e.g. AI silently retrying a rate limit
   * for 10-20s with nothing on screen to show for it) — the request itself is left to finish on
   * its own server-side and will still save whatever it finds; this only stops the "Searching…"
   * state so editing is available straight away instead of leaving no way out of the spinner. */
  function stopSearch() {
    setFlowStep("results");
  }

  /** Stops the online media screening loop before its next counterparty starts — the counterparty
   * currently mid-check is left to finish server-side, matching how Stop already behaves on the
   * AI+ search. */
  function stopMediaScreening() {
    mediaStopRequested.current = true;
  }

  /** "Find Counterparties" — runs the AI/AI+ search. Online media screening comes later, only once
   * a person has made their choice and continued. */
  async function fetchInterest(txId: string) {
    await runSearch(txId);
  }

  async function runSearch(txId: string) {
    await categoriseSearch(txId);
    // Bid Information folds away the moment the stage moves to Search — not just once results
    // land — so the search/results view always has the room, not the bid's own details.
    setBidInfoCollapsed(txId, true);
    setFlowStep("searching");
    // Force it open the moment a search starts — a re-run (after "Choose a different party", a
    // counter offer, etc.) could otherwise still be carrying the collapsed state a *previous*
    // round of this same deal left behind, hiding the "Search — Using AI" progress entirely
    // until someone thought to click the frame open by hand.
    setSearchResultsOpen(txId, true);

    setSearchError(null);
    setNoMatchesTx(null);
    let failure: string | null = null;
    // Marks Upload Documents done and moves the active step onto Search the moment the search
    // actually starts — previously this only advanced once AI/AI+ succeeded, so a failed search
    // (e.g. the counterparty provider being unreachable) left Documents stuck showing as still in
    // progress even though it had genuinely finished.
    await advance(txId, "trading", "search");
    setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "search" } : prev));
    try {
      // AI+ no longer runs alongside the first search: it's a deeper, heavier pass that only has
      // something to be deep about once a person has actually picked candidates from this first,
      // lighter search to shortlist — see requestAiPlusForShortlist, fired from the shortlist
      // toggle. Running it upfront for every search meant every search waited on its slower,
      // more thorough pipeline even when nobody had looked at the first results yet.
      await search({ data: { transactionId: txId, kind: "ai" } });
      // Straight to "choice" — once every candidate has surfaced and no more are forthcoming,
      // the counterparties step is already done, so the active-step pulse should land on Choice
      // rather than sitting on Counterparties.
      await advance(txId, "trading", "choice");
      setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "choice" } : prev));
    } catch (err) {
      failure = (err as Error).message;
      setSearchError(failure);
    } finally {
      setFlowStep("results");
      // The candidates are written server-side, so the Record panel's cached (empty) list has to
      // be refreshed or it stays stuck on "Searching for counterparties…".
      await queryClient.invalidateQueries({ queryKey: ["counterparties", txId] });
      const count = (await loadRelevantCounterparties(txId)).length;
      await queryClient.invalidateQueries({ queryKey: ["counterparties-count", txId] });
      // A search never used to say anything when it actually finished — the step just quietly
      // changed underneath, so there was no clear moment to point to as "done". One toast per
      // outcome now marks that moment explicitly.
      const noMatches = !failure || failure.startsWith("No organisations relevant");
      if ((count ?? 0) > 0) {
        toast.success(`Search complete — ${count} counterpart${count === 1 ? "y" : "ies"} found.`);
      } else if (noMatches) {
        toast.message("Search complete — no matches found. Refine your search and try again.");
      } else {
        toast.error(`Search failed: ${failure}`);
      }
      // Counterparties found: fold Bid Information away so the results list gets the room.
      if ((count ?? 0) > 0) setBidInfoCollapsed(txId, true);
      // Nothing relevant came back: keep Bid Information open, showing the search string next to
      // its own heading — "Edit Search" in the Search Results record below is where it's refined.
      else if (noMatches) {
        setNoMatchesTx(txId);
        setBidInfoCollapsed(txId, false);
      }
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
    // The tab has to be opened straight away, while the click still counts — a tab opened only
    // after the file has finished loading is treated by the browser as an unrequested pop-up.
    // (And `noopener` would make window.open return null even on success, so it is cut loose
    // afterwards instead.)
    const tab = window.open("", "_blank");
    if (tab) {
      tab.document.title = a.name;
      tab.document.body.innerText = "Opening document…";
    }
    const blob = await loadAttachmentBlob(a);
    if (!blob) {
      tab?.close();
      return;
    }
    const url = URL.createObjectURL(blob);
    if (!tab) {
      // Pop-ups really are blocked here — save the file instead of failing.
      const link = document.createElement("a");
      link.href = url;
      link.download = a.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.info("Pop-ups are blocked, so the document was downloaded instead");
      return;
    }
    tab.opener = null;
    tab.location.href = url;
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
  // A real deal's label must come from its own row, never from the blank workspace's draft
  // reference. When a deal is opened from the URL, `txParam` is a real transaction id on the very
  // first render while `dealTx` is still null — letting `draftReference` (the "ID…" claimed for
  // the empty workspace) label it there wrote that placeholder onto a real deal's tab, and left it
  // there if the person switched away before the row arrived. Until the row is in, the label is
  // withheld rather than guessed, and the effect below skips the update for this render.
  const windowLabel = dealTx
    ? dealTx.reference || activity?.reference || fallbackReference(dealTx.id, activity?.direction ?? "bid")
    : windowId === "new"
      ? (draftReference ?? "+ New")
      : null;
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
    // windowLabel is null while a real deal's row is still loading — registering then would hand
    // the tab a guessed label, which is exactly the "ID…" placeholder bug. The effect re-runs as
    // soon as the row lands and the real reference is known.
    if (windowLabel) registerWindow(windowId, windowLabel, dealTx?.commodity ?? dealTx?.title ?? undefined);
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

  // A linked counterparty organisation gets a different, read-only view of this exact same
  // record — Bid Registration, Bid Information, and everything from Proof of Intent onward.
  // Never the bidder's own working steps (Search, AI/AI+, Choice, Online Media).
  if (dealTx && org && dealTx.counterparty_org_id === org.id) {
    return <CounterpartyWorkspaceView tx={dealTx} reload={() => void reloadDeal()} />;
  }

  const workspaceContent = (
    <>
      {celebrateApproval && (
        <Confetti message="The offer has been approved." onDone={() => setCelebrateApproval(false)} />
      )}
      {/* A `?tx=` link that couldn't be opened says so, instead of quietly leaving an empty canvas
          that reads as a brand-new workspace. */}
      {dealLoadError && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2">
          <p className="text-xs text-destructive">{dealLoadError}</p>
        </div>
      )}
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
            <div
              className="mt-3 min-h-0 flex-1 overflow-y-auto"
              // The active-step pulse reads as royal blue rather than the usual aqua/primary
              // accent when this org is the counterparty on this deal — a quick visual cue for
              // which side of the deal you're looking at, matching the blue already used for
              // "Offer" elsewhere in the workspace. --throb-accent is what animate-throb-aqua
              // actually pulses, so overriding it here cascades to both the map and the classic
              // stepper without touching either component.
              style={
                org?.id && dealTx?.counterparty_org_id === org.id
                  ? ({ "--throb-accent": "#4169e1" } as CSSProperties)
                  : undefined
              }
            >
              {/* The map scales to fit the panel, so this scrollbar shouldn't usually need to
                  move — but it's a real native scrollbar (not custom buttons) as a fallback for
                  a short/narrow window where the scaled map is still taller than the panel. */}
              <Suspense fallback={<div className="h-[420px]" aria-hidden />}>
              {mapOpen ? (
                <MapView
                  tx={dealTx ?? null}
                  reload={() => void reloadDeal()}
                  readOnly={!dealTx}
                  onOpenStep={openMapStep}
                  overrideStates={stepOverrides}
                  reference={dealTx?.reference ?? draftReference}
                  documents={savedAttachments}
                  onOpenDocument={(d) => void openAttachment(d as Attachment)}
                  onDownloadDocument={(d) => void downloadAttachment(d as Attachment)}
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
              </Suspense>

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
            <div className="flex shrink-0 items-center gap-1">
            {/* A second Refresh, right here at the Live Workspace frame itself — the taskbar's own
                one (bottom of the screen) is easy to miss when the frame this affects is what's
                actually in view. Same real page reload either way. */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              title="Refresh this page"
              aria-label="Refresh this page"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
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
                    {!dealTx.poi_sealed_at && (
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Ban className="mr-2 h-3.5 w-3.5" />
                          Cancel bid/offer
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    )}
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
          </div>

          {/* Once Proof of Intent is sealed, the record up to that point is immutable at the
              database level (see protect_sealed_transaction) — this banner says so in the UI
              instead of letting someone try to edit something that will just be rejected. Hidden
              again once Step 1 itself is behind us (the deal has moved past Trading) — by then
              the Step 1 accordion below already says the same thing more usefully. */}
          {dealTx?.poi_sealed_at && dealTx.stage === "trading" && (
            <div className="mb-1.5 flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-[11px] font-medium text-success">
              <Lock className="h-3 w-3 shrink-0" />
              Intent sealed — everything above is now read-only.
            </div>
          )}

          {/* The single toggle for every completed Trading-stage record below — always visible
              itself (that's the point: it's the way back in once the group is collapsed), and
              collapsed by default so a deal that's moved on doesn't open with its whole history
              already taking up the screen. Styled like Memory's own tile on the map (gold, black
              outline) only once the deal has actually moved past the Trading stage — the same
              "settled record" look Step 1 plays there. While Trading is still in progress this
              stays a plain light-grey pill instead, since nothing in it has actually settled yet. */}
          {activity && dealTx && (
            <button
              type="button"
              onClick={() => setStep1Open((v) => !v)}
              aria-expanded={step1Open}
              className={cn(
                "mb-1.5 flex w-full items-center gap-2 rounded-full border-2 px-3 py-1.5 text-left text-xs font-semibold text-foreground",
                // dealTx.stage flips to "compliance" at Seal Intent, before the Offer/Counter Offer
                // negotiation that follows it even starts — using that alone turned this gold the
                // moment the Offer frame opened, well before anyone had approved anything. Settles
                // only once the bid/offer is actually approved (negotiationTurn === "accepted") or
                // further along (wad_completed_at).
                dealTx.intent_confirmed_at
                  ? "border-black bg-amber-400/35 hover:bg-amber-400/50"
                  : "border-border bg-muted hover:bg-muted/70",
              )}
            >
              {step1Open ? <Minus className="h-3.5 w-3.5 shrink-0" /> : <Plus className="h-3.5 w-3.5 shrink-0" />}
              <span className="label-caps rounded-full bg-[var(--step-pill-bg)] px-2.5 py-0.5 text-[var(--step-pill-fg)]">
                Step 1 · Trading
              </span>
              {(((dealTx as unknown as { reference?: string | null } | null)?.reference) ?? draftReference) && (
                <span className="ml-auto shrink-0 font-mono text-base font-bold tracking-wide text-foreground">
                  {((dealTx as unknown as { reference?: string | null } | null)?.reference) ?? draftReference}
                </span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", step1Open && "rotate-180")} />
            </button>
          )}

          {/* Bid Registration — the very top of the workspace, pinned above everything else that
              scrolls beneath it. The BID/OFF id sits on the same line as the heading (not its own
              row) to keep this frame as short as possible. Column 1: the bidder's identity/
              verification and how long that business has been active. Column 2: the bid's own
              name (wrapped, right-aligned), when it was registered, and the country. */}
          {step1Open && activity && dealTx && (
            // Fully opaque: the glass treatment's translucency let content scrolling beneath show
            // through this pinned frame.
            <div className="glass-node space-y-1 bg-card p-3 [backdrop-filter:none] [background-image:none]">
              <div className="flex items-center justify-between gap-2">
                <p className={cn("label-caps rounded-full px-2.5 py-1", registrationPill)}>{registrationLabel}</p>
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
                      Active Since:{" "}
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
                  {/* The counterparty's own identity, once the offer has actually been accepted by
                      either party. Same black name/size as the bidder's own identity above it —
                      only the person icon carries the counterparty's colour (royal blue, vs. the
                      bidder's green) — with the same verified/pending badge style. Gated on
                      acceptance (negotiationTurn === "accepted"), not merely on POI being sealed, so
                      the KYC/KYB pending badge never appears while the offer is still being
                      negotiated. */}
                  {dealTx.poi_sealed_at &&
                    (negotiationTurn === "accepted" || dealTx.wad_completed_at) &&
                    counterpartyIdentity?.name && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-border pt-1.5">
                      <User className="h-4 w-4 shrink-0 text-[#4169e1]" aria-label="Counterparty" />
                      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {counterpartyIdentity.name}
                      </span>
                      {counterpartyIdentity.verified ? (
                        <span
                          title="Verified via Didit KYC/KYB"
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#3457e6] px-1.5 py-0.5 text-[10px] font-semibold text-white"
                        >
                          <BadgeCheck className="h-3 w-3" aria-hidden /> Verified
                        </span>
                      ) : (
                        <span
                          title="KYC/KYB check running for this deal"
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground"
                        >
                          KYC/KYB check pending
                        </span>
                      )}
                      {counterpartyIdentity.activeSince && (
                        <p className="w-full pl-6 text-[11px] text-muted-foreground">
                          Active Since:{" "}
                          {new Date(counterpartyIdentity.activeSince).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </div>
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

              {/* The description + drop zone lives here, inside Bid Registration, and nowhere
                  else — it used to appear as its own floating box in the workspace, which read
                  like a stray panel reappearing mid-deal. The moment the first file lands the
                  row disappears for good; later files are added from the Documents frame. */}
              {!workspaceDocsPending && workspaceDocs.length === 0 && !submittedForThisBid && (
                <div className="mt-2">
                  <DocumentUploadStep
                    // A stale resumed deal can mount this before the freshly-seeded one replaces
                    // it — keying on the transaction keeps the seed-once effect on the right deal.
                    key={dealTx.id}
                    transactionId={dealTx.id}
                    reference={(dealTx as unknown as { reference?: string | null }).reference ?? draftReference}
                    onNext={() => goToSearch(dealTx.id)}
                    onSubmitted={() => markSubmitted(dealTx.id)}
                    onPromptSaved={(value) =>
                      setDealTx((prev) =>
                        prev ? ({ ...prev, search_prompt: value.length > 0 ? value : null } as Transaction) : prev,
                      )
                    }
                    initialPrompt={seedPrompt}
                    initialFiles={seedFiles}
                  />
                </div>
              )}
            </div>
          )}

          {/* Bidder details + AI summary come next — what was actually submitted, never buried
              behind the progress ribbon. The attachment(s) live here too, with preview/download. */}
          {step1Open && activity && dealTx && (
            <div className="glass-node mt-1.5 space-y-1.5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="label-caps shrink-0 rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                    {informationLabel}
                  </span>
                  {/* The search phrase this bid is actually running on — kept visible here
                      regardless of which step the workspace is on or whether this frame is
                      collapsed, so it's never necessary to reopen Bid Information (or step back
                      to Search) just to be reminded what was searched for. */}
                  {(dealTx as unknown as { search_prompt?: string | null } | null)?.search_prompt && (
                    <span
                      className="min-w-0 truncate text-[11px] text-muted-foreground"
                      title={(dealTx as unknown as { search_prompt?: string | null }).search_prompt!}
                    >
                      "{(dealTx as unknown as { search_prompt?: string | null }).search_prompt}"
                    </span>
                  )}
                </span>
                {/* The ID check status already shows once, next to the submitter's name on the
                    Bid Registration card above — showing it again here (from the same
                    per-transaction check, but computed separately) was what let one place say
                    "Verified" while this one still said "ID check pending". */}
                <button
                  type="button"
                  onClick={() => setBidInfoCollapsed(dealTx.id, bidInfoOpen)}
                  aria-expanded={bidInfoOpen}
                  aria-label={bidInfoOpen ? `Collapse ${informationLabel}` : `Expand ${informationLabel}`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", bidInfoOpen && "rotate-180")} />
                </button>
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
                <div className="mt-1">
                  <DocumentSummaryList summary={documentSummary} maxChars={summaryRevealLen} />
                </div>
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
              ) : workspaceDocs.length === 0 && noMatchesTx === dealTx.id ? null : workspaceDocs.length === 0 && flowStep === "searching" ? (
                /* Submitted with no documents at all — there is nothing to read, so the search on
                   the typed Search field runs immediately instead of showing a "reading" state
                   that would never resolve. Gated to flowStep === "searching" only: once the
                   search has actually finished (results found, or no-matches handled above) this
                   bar has nothing left to report and must not keep pulsing for the rest of the
                   deal — the Search Results / Online Scanning frames below say what happened. */
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Searching…</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-progress-track">
                    <div className="h-full w-1/3 animate-[slide-in-right_1.4s_ease-in-out_infinite] rounded-full bg-success" />
                  </div>
                </div>
              ) : workspaceDocs.length === 0 ? null : (
                /* Documents are in and the summary isn't saved yet — show the read running as a
                   progress bar rather than a line of text about it not having happened. */
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Reading your documents…</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-progress-track">
                    <div className="h-full w-1/3 animate-[slide-in-right_1.4s_ease-in-out_infinite] rounded-full bg-success" />
                  </div>
                </div>
              )}

              {/* The file list itself now lives on the map, filed under the Documents folder above
                  Step 5 — Bid Information only shows the AI summary, not a second copy of the list. */}

              {/* Explicit go: collapses this frame and hands the workspace over to the search. */}
              {workspaceDocs.length > 0 &&
                !searchGoByTx.has(dealTx.id) &&
                interestCount === 0 &&
                flowStep !== "searching" && (
                  <Button
                    className={cn(
                      "mt-2 w-full bg-emerald-500 hover:bg-emerald-400",
                      rereading || !(documentSummary || readError) ? "text-white" : "text-black",
                    )}
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

          {/* No deal yet: shows the upload/search starting card. If a `seed` came from the
              homepage's search bar, CanvasStart auto-creates the deal on mount instead of
              waiting for another click — so a visitor who already searched on the homepage lands
              straight on the summary panel below, never back on this same picker. */}
          {!activity && (
            <div className="glass-node mt-1.5 space-y-1.5 bg-card p-3 [backdrop-filter:none] [background-image:none]">
              {/* A brand-new workspace already reads as a bid: the same Bid Registration frame,
                  with the BID number on the heading row, around the description/upload bar. */}
              <div className="flex items-center justify-between gap-2">
                <p className={cn("label-caps rounded-full px-2.5 py-1", registrationPill)}>{registrationLabel}</p>
                <div className="flex shrink-0 items-center gap-2">
                  {draftReference && (
                    <span className="font-mono text-base font-bold tracking-wide text-foreground">
                      {draftReference}
                    </span>
                  )}
                  {/* Nothing has been saved yet at this point — no transaction row, no taskbar tab
                      to close it from — so backing out needs its own button rather than relying on
                      a tab that doesn't exist for a workspace this new. */}
                  <button
                    type="button"
                    onClick={() => void navigate({ to: "/live-deal-engine", search: { fresh: true, n: Date.now() } })}
                    title="Cancel — discard this draft"
                    aria-label="Cancel — discard this draft"
                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 items-start gap-3">
                <div className="min-w-0 space-y-1">
                  {org?.id && <SubmitterIdentity orgId={org.id} createdBy={null} />}
                  {(org as unknown as { created_at?: string } | null)?.created_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Active Since:{" "}
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
                  // A brand-new bid/offer (including one seeded from the home page's search bar)
                  // should land with its own Step 1 record visible, not collapsed behind a click —
                  // there's nothing to hide yet since this is the only thing that's happened so far.
                  setStep1Open(true);
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
                <p className="text-xs text-slate-700">Searching using AI for matching counterparties…</p>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={stopSearch}
                    title="Stop watching this search — it keeps running and will still save whatever it finds"
                    className="flex items-center gap-1 rounded p-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  >
                    <StopCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-100"
                    onClick={() => {
                      setTopEditedPrompt(
                        (dealTx as unknown as { search_prompt?: string | null }).search_prompt ?? "",
                      );
                      setTopEditingSearch(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Search
                  </Button>
                </div>
              </div>

              {topEditingSearch && (
                <div className="space-y-1.5 bg-white p-2.5">
                  <Textarea
                    rows={2}
                    value={topEditedPrompt}
                    onChange={(e) => setTopEditedPrompt(e.target.value)}
                    autoFocus
                    className="min-h-0 resize-none text-sm text-slate-800 placeholder:text-slate-400"
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={topEditedPrompt.trim().length === 0 || refining}
                      onClick={() => {
                        setTopEditingSearch(false);
                        void refineSearch(dealTx.id, topEditedPrompt.trim());
                      }}
                    >
                      Search
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-700 hover:bg-slate-200 hover:text-slate-900"
                      onClick={() => setTopEditingSearch(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

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
                onContinue={
                  mapPanel.step === "choice"
                    ? () => {
                        setMapPanel(null);
                        setSearchResultsOpen(dealTx.id, true);
                      }
                    : undefined
                }
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


                {/* The search record stays on the page for the rest of the deal — folded once the
                    flow has moved on, but never removed. Which step the workspace happens to be
                    asking about no longer decides whether it exists. Hidden while still searching —
                    the slim progress bar above is the only thing shown until there's something to
                    open this frame for. */}
                {step1Open && dealTx && (flowStep === "results" || interestCount > 0) && (
                  <div className="rounded-2xl border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => setSearchResultsOpen(dealTx.id, !searchResultsOpen)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
                      aria-expanded={searchResultsOpen}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="label-caps shrink-0 rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                          Search Results
                        </span>
                        {/* Every shortlisted company, readable without opening the frame — not
                            just the one eventually chosen. */}
                        {shortlistedNames.length > 0 && (
                          <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                            {shortlistedNames.join(", ")}
                          </span>
                        )}
                      </span>


                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", searchResultsOpen && "rotate-180")}
                      />
                    </button>
                    {searchResultsOpen && (
                    <div className="space-y-2 px-3.5 pb-3">
                    {searchError && noMatchesTx !== dealTx.id && (
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
                      locked={Boolean(dealTx.intent_confirmed_at || dealTx.poi_sealed_at)}
                      searchPrompt={(dealTx as unknown as { search_prompt?: string | null }).search_prompt ?? null}
                      onSearchAgain={(text) => void refineSearch(dealTx.id, text)}
                      onStopSearch={stopSearch}
                    />
                    </div>
                    )}
                  </div>
                )}

                {/* The AI+ progress bar (and its Stop button) now renders inside Search Results
                    itself, in place of "Select to continue" — see CounterpartyRecord — rather
                    than as a second copy out here. */}

                {/* Online Media Screening results, folded right under Search Results — closed by
                    default once done since it's then a record to check back on, but forced open
                    (see below) while still running so the progress bar inside it is visible. The
                    frame itself now shows the moment screening starts, not just once the first
                    counterparty's results are in, so the progress bar always has this frame to
                    live inside instead of floating above it on its own. */}
                {step1Open && dealTx && (mediaRunning || (mediaResults && mediaResults.length > 0)) && (
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMediaResultsOpen(dealTx.id, !mediaResultsOpen)}
                        aria-expanded={mediaResultsOpen}
                        className="flex min-w-0 flex-1 items-center justify-between gap-1.5 text-left"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="label-caps shrink-0 rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                            Online Scanning Results
                          </span>
                          {dbHasChosenParty && chosenPartyName && (
                            <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                              {chosenPartyName}
                            </span>
                          )}
                        </span>

                        <span className="flex shrink-0 items-center gap-1.5">
                          {mediaResults && mediaResults.length > 0 && (
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {mediaResults.length} counterpart{mediaResults.length === 1 ? "y" : "ies"}
                            </span>
                          )}
                          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", (mediaResultsOpen || mediaRunning) && "rotate-180")} />
                        </span>
                      </button>
                      {/* The choice action lives at the bottom of the records below. */}
                      {dbHasChosenParty && !dealTx?.poi_sealed_at && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              title="Not happy with the online screening findings? Pick someone else."
                              className="shrink-0 text-[11px] font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
                            >
                              Change Party
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Choose a different party?</AlertDialogTitle>
                              <AlertDialogDescription>
                                The party you picked is released and the counterparty list opens again, in case the
                                screening findings above changed your mind. Nothing already screened is lost.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep this party</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void reopenChoice()}>Reopen the list</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>

                    {/* Same slim progress bar treatment as the search above — inside this frame
                        now, rather than as its own separate box floating above it. */}
                    {mediaRunning && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-border">
                        <div className="flex items-center gap-3 bg-[#F1F5F9] px-4 py-3">
                          <p className="text-xs text-slate-700">
                            Scanning LinkedIn, Facebook, TikTok, marketplaces and news…
                          </p>
                          <div className="ml-auto flex shrink-0 items-center gap-1.5">
                            {mediaProgress && mediaProgress.total > 0 && (
                              <span className="text-[11px] text-slate-500">
                                {mediaProgress.failed
                                  ? "Could not finish"
                                  : `${mediaProgress.done} of ${mediaProgress.total} sources`}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={stopMediaScreening}
                              title="Stop the online screening — the counterparty currently being checked keeps running and will still save whatever it finds"
                              className="flex items-center gap-1 rounded p-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                            >
                              <StopCircle className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Stop</span>
                            </button>
                          </div>
                        </div>
                        <div className="h-1.5 w-full animate-ribbon-sweep" />
                      </div>
                    )}

                    {!dbHasChosenParty && !mediaPick && !finalizing && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Select who you want to trade with
                      </p>
                    )}


                    {mediaResultsOpen && (
                      <RadioGroup
                        value={mediaPick ?? ""}
                        onValueChange={setMediaPick}
                        asChild
                      >
                      <ul className="mt-2 space-y-2">
                        {(mediaResults ?? []).map((m) => (
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
                              {/* The chosen counterparty, marked on its own row — reads "Selected"
                                  once picked, and upgrades to "Confirmed Intent" once intent is
                                  actually confirmed against them. */}
                              {chosenPartyName && m.name === chosenPartyName && (
                                <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                                  {dealTx.intent_confirmed_at ? "Confirmed Intent" : "Selected"}
                                </span>
                              )}
                            </div>

                            <ul className="mt-1.5 space-y-1">
                              {m.findings.map((f) => (
                                <li key={f.source} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
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
                                  {f.detail && (
                                    <p className="basis-full text-[11px] leading-snug text-foreground/75">
                                      {f.detail}
                                      {f.url && f.status !== "failed" && f.status !== "unavailable" && (
                                        <>
                                          {" "}
                                          <a
                                            href={f.url}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="text-blue-600 underline hover:text-blue-800"
                                          >
                                            Source
                                          </a>
                                        </>
                                      )}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                      </RadioGroup>
                    )}
                    {/* Continue sits under the last screened record, where the reading ends. */}
                    {mediaResultsOpen && !dbHasChosenParty && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          disabled={!mediaPick || finalizing}
                          onClick={() => mediaPick && finalizeChoice(mediaPick)}
                        >
                          {finalizing ? "Recording your choice…" : "Continue"}
                        </Button>
                      </div>
                    )}


                  </div>
                )}

                {/* Screening came back with nothing at all — say so, rather than leaving an empty
                    space where the choice controls would be. The search results above keep their
                    own selection controls in that case. */}
                {dealTx && mediaResults && mediaResults.length === 0 && (
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <p className="label-caps inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                      ONLINE SCANNING RESULTS
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Screening returned no records — pick a counterparty from the search results above to
                      continue.
                    </p>
                  </div>
                )}

                {/* AI+ moved earlier in the flow: it now analyses the whole search-result set (and
                    what was rejected) the moment results are in, inside the Search Results record
                    itself, before anyone picks — see CounterpartyRecord in DealCanvas.tsx. Nothing
                    runs here anymore; Confirm Intent is no longer gated by it. */}

                {/* Confirmed Intent, kept for the rest of the deal as a folded record. It no longer
                    depends on which step the workspace is asking about, so it stops disappearing
                    when the flow moves to sealing, compliance or execution. */}
                {step1Open && dealTx?.intent_confirmed_at && (
                  <div className="rounded-2xl border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => setConfirmedIntentOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
                      aria-expanded={confirmedIntentOpen}
                    >
                      <span className="min-w-0">
                        <span className="label-caps inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                          Confirmed Intent
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          Read the terms as they stand. Confirming does not seal them — that is the next step.
                        </span>
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
                )}

                {dealTx?.intent_confirmed_at && (
                  <button
                    type="button"
                    onClick={() => setStep2Open((v) => !v)}
                    aria-expanded={step2Open}
                    className={cn(
                      "mt-1.5 flex w-full items-center gap-2 rounded-full border-2 px-3 py-1.5 text-left text-xs font-semibold text-foreground",
                      grcDone ? "border-black bg-amber-400/35 hover:bg-amber-400/50" : "border-border bg-muted hover:bg-muted/70",
                    )}
                  >
                    {step2Open ? <Minus className="h-3.5 w-3.5 shrink-0" /> : <Plus className="h-3.5 w-3.5 shrink-0" />}
                    <span className="label-caps rounded-full bg-[var(--step-pill-bg)] px-2.5 py-0.5 text-[var(--step-pill-fg)]">
                      Step 2 · GRC
                    </span>
                    <ChevronDown className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", step2Open && "rotate-180")} />
                  </button>
                )}

                {/* Sealed intent reads the same way: a folded record whose certificate is
                    there when it's wanted, with the sealing sentence as subtext under the pill
                    rather than a second heading inside the frame. */}
                {step2Open && dealTx?.poi_sealed_at && (
                  <div className="rounded-2xl border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => setSealedPoiOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
                      aria-expanded={sealedPoiOpen}
                    >
                      <span className="min-w-0">
                        <span className="label-caps inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                          Seal Intent
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          Sealing writes the transaction state to an immutable record with a fingerprint.
                          Compliance, execution, finality and memory stay locked until it exists.
                        </span>
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", sealedPoiOpen && "rotate-180")}
                      />
                    </button>
                    {sealedPoiOpen && (
                      <div className="px-3.5 pb-3">
                        <InlineFrame
                          bare
                          tx={dealTx}
                          stage="trading"
                          step="poi"
                          reload={() => void reloadDeal()}
                          onClose={() => setStagePanel(null)}
                          onChangeParty={() => void reopenChoice()}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* The Offer gets its own frame here, above Without a Doubt — not nested inside
                    it. Open by default: it's current until it's approved, and stays available as
                    its own record (the full exchange, who said what) after. */}
                {step2Open && dealTx?.poi_sealed_at && (
                  <div className="rounded-2xl border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => setOfferFrameOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
                      aria-expanded={offerFrameOpen}
                    >
                      <span>
                        <span className="label-caps inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                          Offer
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          Accept, counter or reject the terms — a back-and-forth exchange between the
                          two of you until you reach agreement.
                        </span>
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", offerFrameOpen && "rotate-180")}
                      />
                    </button>
                    {offerFrameOpen && (
                      <div className="px-3.5 pb-3">
                        <MutualEngagementPanel transactionId={dealTx.id} offerOnly />
                      </div>
                    )}
                  </div>
                )}

                {/* Cleared WaD case — same folded-record treatment as Seal Intent above. Grouped
                    into Step 1 · Trading too, alongside Trade Summary below it. */}
                {step2Open && dealTx?.wad_completed_at && (
                  <div className="rounded-2xl border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => setSealedWadOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
                      aria-expanded={sealedWadOpen}
                    >
                      <span className="min-w-0">
                        <span className="label-caps inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                          Without a Doubt (WAD)
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          KYC, KYB, UBO, sanctions and PEP cleared.
                        </span>
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", sealedWadOpen && "rotate-180")}
                      />
                    </button>
                    {sealedWadOpen && (
                      <div className="px-3.5 pb-3">
                        <InlineFrame
                          bare
                          tx={dealTx}
                          stage="compliance"
                          step="wad"
                          reload={() => void reloadDeal()}
                          onClose={() => setStagePanel(null)}
                          onContinue={() => {
                            // Same collapse-on-advance behaviour every other folded record in
                            // this workspace gets — the frame you just finished with tucks away
                            // once you move on, rather than staying pinned open.
                            setSealedWadOpen(false);
                            setSealedPoiOpen(false);
                            setOfferFrameOpen(false);
                            // Clicking Continue is what actually sends the deal into execution:
                            // the moment is stamped on the transaction (which is what Legal
                            // Agreements' pulse is gated on), the step moves on, and the next
                            // frame opens by itself.
                            void continueFromWad();
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* The active step's own panel — skipped for intent and poi once those are
                    recorded, since the folded records above already hold them. */}
                {dealTx &&
                  stagePanel &&
                  (stagePanel === "intent" ? true : step2Open) &&
                  !(stagePanel === "business-docs" && grcDone) &&
                  !(stagePanel === "intent" && dealTx.intent_confirmed_at) &&
                  !(stagePanel === "poi" && dealTx.poi_sealed_at) &&
                  !(stagePanel === "wad" && dealTx.wad_completed_at) &&
                  // The Offer frame above has to be accepted first — Without a Doubt waits its
                  // turn instead of appearing alongside a still-open Offer.
                  !(stagePanel === "wad" && negotiationTurn !== "accepted") && (
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
                      // WadStep's own Continue button (shown once cleared) calls this — without it,
                      // clicking Continue only revealed the certificate locally and never actually
                      // stamped wad_continued_at, so the map kept the WaD tile pulsing forever
                      // instead of handing the pulse to Legal Agreements the way every other
                      // stage-to-stage transition in this workspace does.
                      onContinue={stagePanel === "wad" ? () => void continueFromWad() : undefined}
                    />
                  )}


                {/* Only once Step 2's own documents (Business Docs) are in — not the moment the
                    compliance checks clear. Collapsed by default: it's a record to check back on,
                    and Execution is what needs attention by then. */}
                {step2Open && dealTx?.wad_completed_at && stepOverrides["businessDocs"] === "done" && (
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

                {dealTx && grcDone && (
                  <button
                    type="button"
                    onClick={() => setStep3Open((v) => !v)}
                    aria-expanded={step3Open}
                    className="mt-1.5 flex w-full items-center gap-2 rounded-full border-2 border-border bg-muted px-3 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-muted/70"
                  >
                    {step3Open ? <Minus className="h-3.5 w-3.5 shrink-0" /> : <Plus className="h-3.5 w-3.5 shrink-0" />}
                    <span className="label-caps rounded-full bg-[var(--step-pill-bg)] px-2.5 py-0.5 text-[var(--step-pill-fg)]">
                      Step 3 · Execution
                    </span>
                    <ChevronDown className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", step3Open && "rotate-180")} />
                  </button>
                )}
                {dealTx && grcDone && step3Open && (
                  <InlineFrame
                    tx={dealTx}
                    stage="execution"
                    step="preparation"
                    reload={() => void reloadDeal()}
                    onClose={() => setStep3Open(false)}
                  />
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
