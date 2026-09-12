import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  Eye,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Paperclip,
  Search,
  X as XIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  CanvasStart,
  CounterpartyRecord,
  InlineFrame,
  FLOWCHART_PREVIEW_TX,
  type RecordedActivity,
} from "@/components/canvas/DealCanvas";
import { TradeSummary } from "@/components/canvas/TradeSummary";

import { ClassicView } from "@/components/canvas/ClassicView";
import { DocumentUploadStep } from "@/components/guided/DocumentUploadStep";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { advance, fallbackReference, recordEvent, type Transaction } from "@/lib/tx";
import type { StageKey } from "@/lib/spine";
import { useAuth } from "@/lib/auth";
import { searchCounterparties } from "@/lib/izenzo.functions";
import { runBackgroundScreening, type ScreeningResult } from "@/lib/screening.functions";
import { runOnlineMediaChecks, type MediaCheckResult } from "@/lib/onlineMedia.functions";
import { listVerificationsForTx } from "@/lib/didit.functions";
import { pushRecentDeal } from "@/lib/recentDeals";
import { useDealWindows } from "@/lib/dealWindows";

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
  validateSearch: (search: Record<string, unknown>): { tx?: string; popout?: boolean } => ({
    ...(typeof search["tx"] === "string" ? { tx: search["tx"] as string } : {}),
    popout: search["popout"] === "1",
  }),
  component: LiveDealEngine,
});

// Picks out the facts a reader actually scans an AI summary for — amounts, quantities, dates and
// percentages — and renders them in green so they stand out from the surrounding prose.
const KEY_TERM_PATTERN =
  /(?:[$€£R]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|k|m|bn))?)|(?:\b(?:USD|EUR|GBP|ZAR|R)\s?\d[\d,]*(?:\.\d+)?\b)|(?:\b\d[\d,]*(?:\.\d+)?\s?(?:MT|kg|tonnes?|tons?|barrels?|units?|bbl|%)\b)|(?:\b\d{1,3}(?:\.\d+)?%\b)|(?:\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)|(?:\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b)/gi;

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
  kind: "ID" | "ID front" | "ID back" | "Document";
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

function OpenDealsPicker({ currentId }: { currentId: string | null }) {
  const { org } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: deals = [] } = useQuery({
    queryKey: ["open-deals", org?.id],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, reference, title, commodity, stage, created_at, bid_offers(direction, created_at)")
        .eq("org_id", org!.id)
        .neq("stage", "memory")
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
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {selected ? (
            <span className="min-w-0 truncate">
              <span className="font-mono font-semibold">{selected.reference}</span>
              {selected.name && <span className="text-muted-foreground"> — {selected.name}</span>}
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
  const { tx: txParam, popout } = Route.useSearch();
  const [picking, setPicking] = useState(false);
  const [direction, setDirection] = useState<"bid" | "offer" | null>(null);
  // Reserved for pre-selecting a bid/offer direction before the Workspace form opens; the
  // Engine Map's single "Create a bid or an offer" entry point always leaves this null and lets
  // the form's own picker ask.
  const [pendingDirection, setPendingDirection] = useState<"bid" | "offer" | null>(null);
  const [activity, setActivity] = useState<RecordedActivity | null>(null);
  const [dealTx, setDealTx] = useState<Transaction | null>(null);
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
  const [stagePanel, setStagePanel] = useState<"intent" | "poi" | "wad" | null>(null);
  /** Set when a Map node outside the Workspace's own step-specific UI is clicked — shows a
   * generic inline detail panel for that (stage, step) in the Workspace instead. */
  const [mapPanel, setMapPanel] = useState<{ stage: StageKey; step: string } | null>(null);
  // Coming back to a deal that is already mid-gate reopens the step it stopped on. A deal that
  // already has a chosen counterparty but no signed intent always reopens Intent, whatever step
  // happens to be stored on the row — that is what left users stranded on "Choice recorded".
  const [hasChosen, setHasChosen] = useState(false);
  useEffect(() => {
    if (!dealTx?.id) return;
    let live = true;
    (async () => {
      const { count } = await supabase
        .from("counterparties")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", dealTx.id)
        .eq("status", "chosen");
      if (live) setHasChosen((count ?? 0) > 0);
    })();
    return () => {
      live = false;
    };
  }, [dealTx?.id, dealTx?.step]);

  const resumedStep: "intent" | "poi" | "wad" | null = dealTx?.wad_completed_at
    ? null
    : dealTx?.poi_sealed_at
      ? "wad"
      : dealTx?.intent_confirmed_at
        ? "poi"
        : dealTx?.step === "intent" || dealTx?.step === "poi"
          ? dealTx.step
          : hasChosen
            ? "intent"
            : null;
  useEffect(() => {
    if (resumedStep) setStagePanel(resumedStep);
  }, [resumedStep]);



  const [screeningProgress, setScreeningProgress] = useState<
    { done: number; total: number; failed?: boolean } | null
  >(null);



  const [documentSummary, setDocumentSummary] = useState<string | null>(null);
  const search = useServerFn(searchCounterparties);
  const runScreening = useServerFn(runBackgroundScreening);
  const runMediaChecks = useServerFn(runOnlineMediaChecks);
  const listIdChecks = useServerFn(listVerificationsForTx);
  const queryClient = useQueryClient();

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
  const { data: workspaceDocs = [] } = useQuery({
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
      : mediaResults && !screeningResults
        ? "choice"
        : flowStep === "results" && !mediaResults && !screeningResults
          ? "counterparties"
          : null;

  /** Scans the open web (LinkedIn, Facebook, TikTok, marketplaces, news) for the counterparties
   * that were ticked, before any paid provider screening is opened. */
  async function startMediaChecks(counterpartyIds: string[]) {
    if (!dealTx || counterpartyIds.length === 0) return;
    const SOURCES_PER_COUNTERPARTY = 6;
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
    setMapPanel(null);
    setPendingDirection(null);
  }

  /** Clicking a node on the Engine Map that isn't already covered by the Workspace's own
   * step-specific UI (documents, search, choice, POI, WaD) — opens a generic inline detail panel
   * in the Workspace instead, so the Map never navigates away from this screen. */
  function openMapStep(stage: StageKey, step: string) {
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
    if (txParam) return;
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

  async function runSearch(txId: string) {
    setFlowStep("searching");
    setSearchError(null);
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
    }
  }

  /** The bucket is private, so a short-lived signed link is minted on demand rather than stored. */
  async function openAttachment(a: Attachment) {
    if (!a.path) return;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(a.path, 60);
    if (error || !data?.signedUrl) {
      toast.error(`Could not open ${a.name}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  /** Same signed-URL flow as opening it, but asks storage for a `Content-Disposition: attachment`
   * link so the browser saves the file instead of just previewing it inline. */
  async function downloadAttachment(a: Attachment) {
    if (!a.path) return;
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(a.path, 60, { download: a.name });
    if (error || !data?.signedUrl) {
      toast.error(`Could not download ${a.name}`);
      return;
    }
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = a.name;
    link.click();
  }

  // A deal that hasn't been created yet still needs a stable id so it can register as its own
  // taskbar entry rather than being lost the moment the user starts filling in a bid/offer.
  const windowId = dealTx?.id ?? "new";
  const windowLabel = dealTx
    ? dealTx.reference || activity?.reference || fallbackReference(dealTx.id, activity?.direction ?? "bid")
    : "New workspace";
  const { windows, register: registerWindow, setMode, move, close: closeWindow, isPoppedElsewhere } = useDealWindows();
  const win = windows.find((w) => w.id === windowId);
  const windowMode = popout ? "docked" : (win?.mode ?? "docked");
  const poppedElsewhere = !popout && isPoppedElsewhere(windowId);

  useEffect(() => {
    if (popout) return;
    registerWindow(windowId, windowLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId, windowLabel, popout]);

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

  if (!popout && windowMode === "minimized") {
    return (
      <AppShell wide>
        <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
          {windowLabel} is minimized — restore it from the taskbar below.
        </div>
      </AppShell>
    );
  }

  if (poppedElsewhere) {
    return (
      <AppShell wide>
        <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
          {windowLabel} is open in its own window — switch to it, or close it there to bring it back here.
        </div>
      </AppShell>
    );
  }

  const workspaceContent = (
    <>
      {!popout && (
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

      <div className="mb-3 flex items-center justify-end gap-3">
        <OpenDealsPicker currentId={dealTx?.id ?? null} />
      </div>

      {/* The whole two-panel pair reads as one floating card sitting above the page — a soft
          halo/backdrop layer behind it plus a strong shadow on the panels themselves — rather
          than panels flush with the page background. */}
      <div className="relative">
        <div aria-hidden className="absolute -inset-3 rounded-[2rem] bg-card/60 blur-xl" />
        <div className="relative grid grid-cols-1 items-stretch gap-4 rounded-3xl lg:grid-cols-2">
          {/* Engine Map — always visible on the left. Clicking a node opens that step inline in
              the Live Workspace beside it, instead of navigating away from this screen. Both
              panels share the same fixed viewport-relative height so the pair fits on screen
              without the page itself needing to scroll — the Map scales its diagram to fit, the
              Workspace scrolls its own content internally if it runs long. */}
          <div className="ink-grid flex h-[calc(100vh-190px)] w-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-2xl sm:p-5">
            <p className="label-caps shrink-0 text-foreground">Izenzo Engine Map</p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              <ClassicView
                tx={dealTx ?? FLOWCHART_PREVIEW_TX}
                reload={() => void reloadDeal()}
                readOnly={!dealTx}
                onRegister={startNewDeal}
                onOpenStep={openMapStep}
              />
            </div>
          </div>

          {/* Live Workspace — always visible on the right. Once a bid/offer exists, its header
              is the bid/offer ID on the left; the top right is either the real upload frame
              (before any document is attached) or a bulleted list of what's been classified from
              the documents already uploaded. */}
          <div className="ink-grid h-[calc(100vh-190px)] w-full overflow-y-auto rounded-3xl border border-border bg-card p-3 shadow-2xl sm:p-5">
            {dealTx ? (
              <div className="flex items-start justify-between gap-4">
                <p className="label-caps shrink-0 font-mono text-base font-bold uppercase tracking-wide text-foreground">
                  {dealTx.reference || activity?.reference || fallbackReference(dealTx.id, activity?.direction ?? "bid")}
                </p>
                <div className="w-1/2 max-w-[260px] shrink-0">
                  {workspaceDocs.length === 0 ? (
                    <DocumentUploadStep
                      transactionId={dealTx.id}
                      onNext={() => void runSearch(dealTx.id)}
                    />
                  ) : (
                    <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-3">
                      <p className="label-caps text-muted-foreground">AI findings</p>
                      <ul className="space-y-1 text-xs text-foreground">
                        {workspaceDocs.slice(0, 5).map((d) => (
                          <li key={d.id} className="truncate">
                            • {d.name} — {String(d.doc_type).replace(/_/g, " ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="label-caps text-foreground">Live workspace</p>
            )}

          {!activity && (
            <div className="mt-4">
              <CanvasStart
                initialDirection={pendingDirection}
                onCreated={(tx, recorded) => {
                  setPicking(false);
                  setDirection(null);
                  setPendingDirection(null);
                  setActivity(recorded);
                  setDealTx(tx);
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

          {activity && dealTx && flowStep === "searching" && (
            <div className="mt-3 overflow-hidden rounded-xl border border-warning/40">
              <div className="flex items-center gap-3 bg-warning/15 px-4 py-3">
                <p className="text-sm text-warning">Running AI and AI+ search for matching counterparties…</p>
              </div>
              <div className="h-1.5 w-full animate-ribbon-sweep" />
            </div>
          )}

          {activity && flowStep !== "documents" && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Bid Creation
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Submission of documents
              </div>
            </div>
          )}

          {mapPanel && dealTx && (
            <div className="mt-3">
              <InlineFrame
                tx={dealTx}
                stage={mapPanel.stage}
                step={mapPanel.step}
                reload={() => void reloadDeal()}
                onClose={() => setMapPanel(null)}
              />
            </div>
          )}

          {activity ? (
            <div className="mt-4 space-y-3">
              {documentSummary && (
                <div className="glass-node space-y-2 p-4">
                  <p className="label-caps text-muted-foreground">AI document summary</p>
                  <p className="text-sm leading-relaxed text-foreground">
                    {highlightKeyTerms(documentSummary)}
                  </p>
                </div>
              )}

                <div className="flex flex-wrap gap-1.5">
                  {activity.commodity && (
                    <span className="rounded-full border border-primary/40 bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      {activity.commodity}
                    </span>
                  )}
                  {activity.quantity && (
                    <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {activity.quantity} {activity.unit}
                    </span>
                  )}
                  {activity.price && (
                    <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {activity.currency} {activity.price}
                    </span>
                  )}
                </div>

                <div className="glass-node flex items-start gap-3 p-4">
                  <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {activity.direction === "bid" ? "Bid" : "Offer"} recorded — {activity.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(activity.time).toLocaleString()}
                    </p>
                  </div>
                </div>

                {attachments.length > 0 && (
                  <div className="glass-node space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="label-caps rounded-full border border-[#F59E0B] bg-[#F59E0B] px-2.5 py-0.5 text-white">
                        Attachments
                      </p>
                      {idCheck?.status === "passed" && (
                        <span
                          title={`Verified via Didit${idCheck.completed_at ? ` — ${new Date(idCheck.completed_at).toLocaleString()}` : ""}`}
                          className="flex shrink-0 items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success"
                        >
                          <BadgeCheck className="h-3 w-3" />
                          ID Verified
                        </span>
                      )}
                      {idCheck?.status === "in_progress" && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-info px-2 py-0.5 text-[10px] font-semibold text-white">
                          ID check pending
                        </span>
                      )}
                    </div>
                    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                    {attachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {a.path ? (
                          <button
                            type="button"
                            onClick={() => openAttachment(a)}
                            className="truncate text-left underline underline-offset-2 hover:text-primary"
                          >
                            {a.name}
                          </button>
                        ) : (
                          <span className="truncate">{a.name}</span>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground">{a.kind}</span>
                        {/* Both icons always show — greyed out for files recorded before uploads
                            were kept, so a row never looks half-built. */}
                        <span className="ml-auto flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={!a.path}
                            onClick={() => openAttachment(a)}
                            title={
                              a.path
                                ? `Preview ${a.name}`
                                : "No stored copy — this file was recorded before uploads were kept"
                            }
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </span>


                      </div>
                    ))}
                    </div>
                  </div>
                )}

                {/* Once a party is chosen the gate panel takes over the workspace — leaving the
                    match list open below it is what made the screen look stuck. */}
                {(flowStep === "searching" || flowStep === "results") && dealTx && !stagePanel && (
                  <div className="space-y-2">
                    {searchError && (
                      <p className="text-xs text-[#F59E0B]">Search failed: {searchError}</p>
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
                      onMediaContinue={startScreening}
                      onFinalize={finalizeChoice}
                      finalizing={finalizing}
                    />
                  </div>
                )}

                {dealTx && stagePanel && (
                  <InlineFrame
                    tx={dealTx}
                    stage={stagePanel === "wad" ? "compliance" : "trading"}
                    step={stagePanel}
                    reload={() => void reloadDeal()}
                    onClose={() => setStagePanel(null)}
                    onChangeParty={() => void reopenChoice()}

                  />
                )}

                {dealTx?.wad_completed_at && <TradeSummary tx={dealTx} />}
              </div>
            ) : null}
        </div>
        </div>
      </div>
    </>
  );

  if (popout) {
    return <div className="min-h-screen bg-background p-4">{workspaceContent}</div>;
  }

  if (windowMode === "maximized") {
    return (
      <AppShell wide>
        <div className="fixed inset-4 z-50 overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl">
          {workspaceContent}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <div
        className="fixed z-40 w-[min(1040px,calc(100vw-2rem))] rounded-2xl"
        style={{ left: posX, top: posY }}
      >
        {workspaceContent}
      </div>
    </AppShell>
  );
}
