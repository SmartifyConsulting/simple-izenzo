import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, Eye, Paperclip, UploadCloud, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  CanvasStart,
  CounterpartyRecord,
  DealCanvas,
  InlineFrame,
  FLOWCHART_PREVIEW_TX,
  type RecordedActivity,
} from "@/components/canvas/DealCanvas";
import { TradeSummary } from "@/components/canvas/TradeSummary";

import { MahjongView } from "@/components/canvas/MahjongView";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { advance, fingerprintOf, recordEvent, type Transaction } from "@/lib/tx";
import { searchCounterparties } from "@/lib/izenzo.functions";
import { runBackgroundScreening, type ScreeningResult } from "@/lib/screening.functions";
import { runOnlineMediaChecks, type MediaCheckResult } from "@/lib/onlineMedia.functions";
import { pushRecentDeal } from "@/lib/recentDeals";

import { useViewMode, setViewMode } from "@/lib/viewMode";
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
  validateSearch: (search: Record<string, unknown>): { tx?: string } => {
    const value = search["tx"];
    return typeof value === "string" ? { tx: value } : {};
  },
  component: LiveDealEngine,
});

type Attachment = {
  name: string;
  kind: "ID front" | "ID back" | "Document";
  /** Location of the stored file in the private `documents` bucket, so it can be opened later. */
  path?: string | null;
};

/** Files bigger than this are rejected before upload — the bucket rejects them anyway, and a
 * clear message beats a raw storage error. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;
type FlowStep = "documents" | "searching" | "results";

// Keyed to the created transaction so a user who navigates away (or refreshes) lands back on the
// same bid/offer instead of starting over — the reference number lives here too, since it's
// generated client-side and has nowhere else to persist.
const ACTIVE_DEAL_KEY = "izenzo:active-deal";

/** A file picker that also accepts drag-and-drop, and lists the names of whatever's currently
 * selected. `multiple` collects any number of files; otherwise a new pick replaces the old one. */
function FileField({
  id,
  label,
  files,
  onChange,
  multiple,
}: {
  id: string;
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    const first = picked[0];
    if (!first) return;
    onChange(multiple ? [...files, ...picked] : [first]);
  }

  function removeAt(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/20",
          dragOver && "border-primary bg-primary/10",
        )}
      >
        <UploadCloud className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Drag a file here, or click to browse</span>
        <input
          id={id}
          type="file"
          multiple={multiple}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </label>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5 text-xs">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
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
}

/** The Live Deal Engine is the one screen users work from — the workflow canvas itself, never a
 * separate per-deal detail page. */
function LiveDealEngine() {
  const { tx: txParam } = Route.useSearch();
  const [picking, setPicking] = useState(false);
  const [direction, setDirection] = useState<"bid" | "offer" | null>(null);
  // Set when "Register Bid/Offer" is clicked from the Mahjong diagram — switches to Classic view
  // with the form already open on that side, instead of leaving the user to pick again.
  const [pendingDirection, setPendingDirection] = useState<"bid" | "offer" | null>(null);
  const [activity, setActivity] = useState<RecordedActivity | null>(null);
  const [dealTx, setDealTx] = useState<Transaction | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("documents");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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



  const [idFront, setIdFront] = useState<File[]>([]);
  const [idBack, setIdBack] = useState<File[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const search = useServerFn(searchCounterparties);
  const runScreening = useServerFn(runBackgroundScreening);
  const runMediaChecks = useServerFn(runOnlineMediaChecks);
  const queryClient = useQueryClient();

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
      toast.success("Online media checks complete");
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
      const { error: cpError } = await supabase
        .from("counterparties")
        .update({ status: "screened", chosen_at: null })
        .eq("transaction_id", dealTx.id)
        .eq("status", "chosen");
      if (cpError) throw cpError;
      const { error: txError } = await supabase
        .from("transactions")
        .update({ intent_confirmed_at: null })
        .eq("id", dealTx.id);
      if (txError) throw txError;
      await recordEvent({
        transactionId: dealTx.id,
        stage: "trading",
        step: "media",
        action: "counterparty_choice_reopened",
        summary: "Reopened the counterparty choice",
      });
      await advance(dealTx.id, "trading", "media");
      setDealTx((prev) =>
        prev ? { ...prev, stage: "trading", step: "media", intent_confirmed_at: null } : prev,
      );
      setHasChosen(false);
      setStagePanel(null);

      setFlowStep("results");
      toast.success("Choice reopened — pick the party you want to trade with");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }



  // Once something has been recorded, keep the split workspace open (and on the side it was
  // recorded for) even after the form resets — that's what the Live Workspace panel now shows.
  const side = direction ?? activity?.direction ?? pendingDirection ?? null;

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

  async function submitDocuments(e: React.FormEvent) {
    e.preventDefault();
    if (!dealTx) return;
    const collected: { file: File; kind: Attachment["kind"] }[] = [
      ...idFront.map((f) => ({ file: f, kind: "ID front" as const })),
      ...idBack.map((f) => ({ file: f, kind: "ID back" as const })),
      ...docFiles.map((f) => ({ file: f, kind: "Document" as const })),
    ];

    if (collected.length === 0) {
      toast.error("Attach at least one file");
      return;
    }

    const tooBig = collected.find(({ file }) => file.size > MAX_FILE_BYTES);
    if (tooBig) {
      toast.error(`${tooBig.file.name} is larger than 20 MB — please attach a smaller file`);
      return;
    }
    const empty = collected.find(({ file }) => file.size === 0);
    if (empty) {
      toast.error(`${empty.file.name} is empty — please attach the actual file`);
      return;
    }

    setBusy(true);
    try {
      let version = 1;
      const saved: Attachment[] = [];
      // Upload first, insert second: the row is only worth writing once the file itself is
      // safely stored against this bid/offer.
      for (const { file, kind } of collected) {
        const path = `deals/${dealTx.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
        if (upErr) throw new Error(`Could not upload ${file.name}: ${upErr.message}`);

        const sha = await fingerprintOf({ name: file.name, size: file.size, at: Date.now() });
        const { error: insErr } = await supabase.from("documents").insert({
          transaction_id: dealTx.id,
          name: file.name,
          doc_type: kind === "Document" ? "other" : "certificate",
          notes: kind,
          version: version++,
          sha256: sha,
          storage_path: path,
        });
        if (insErr) throw new Error(`Could not save ${file.name}: ${insErr.message}`);
        saved.push({ name: file.name, kind, path });
      }
      await recordEvent({
        transactionId: dealTx.id,
        stage: "trading",
        step: "documents",
        action: "document_attached",
        summary: `${saved.length} document${saved.length === 1 ? "" : "s"} attached`,
        payload: { files: saved },
      });
      await advance(dealTx.id, "trading", "search");
      setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "search" } : prev));
      setAttachments((prev) => [...prev, ...saved]);
      await runSearch(dealTx.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const viewMode = useViewMode();

  if (viewMode === "mahjong") {
    return (
      <AppShell wide>
        <MahjongView
          tx={dealTx ?? FLOWCHART_PREVIEW_TX}
          reload={() => {}}
          readOnly={!dealTx}
          onRegister={(dir) => {
            setPendingDirection(dir);
            setViewMode("classic");
          }}
          // Clicking anything on the map hands over to the Classic detailed sequence, which is
          // where the work actually happens.
          onOpenClassic={() => setViewMode("classic")}
        />
      </AppShell>
    );
  }

  return (
    <AppShell wide>

      <div className={cn(side && "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-stretch")}>
        <div
          className={cn(
            // Once a direction is picked, the form and its next steps merge into one bordered,
            // gridded frame — matched in width and height by the Live Workspace frame beside it.
            side && "ink-grid w-full rounded-3xl border border-border p-3 sm:p-5",
            side === "offer" && "sm:order-2",
          )}
        >
          {!activity && (
            <CanvasStart
              initialDirection={pendingDirection}
              onCreated={(tx, recorded) => {
                setPicking(false);
                setDirection(null);
                setPendingDirection(null);
                setActivity(recorded);
                setDealTx(tx);
                setFlowStep("documents");
                try {
                  localStorage.setItem(ACTIVE_DEAL_KEY, JSON.stringify({ txId: tx.id, activity: recorded }));
                } catch {
                  // Best-effort — resuming later just won't work if storage is unavailable.
                }
              }}
              onPickingChange={setPicking}
              onDirectionChange={setDirection}
            />
          )}

          {activity && (
            <p className="label-caps">
              Live deal engine for {activity.direction === "bid" ? "The Bid" : "Responder"}
            </p>
          )}

          {activity && dealTx && flowStep === "documents" && (
            <form onSubmit={submitDocuments} className="glass-node animate-node-rise mt-3 space-y-4 p-5 sm:p-6">
              <p className="text-base font-semibold tracking-tight">Upload ID and documents</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FileField id="id-front" label="ID upload — front" files={idFront} onChange={setIdFront} />
                <FileField id="id-back" label="ID upload — back" files={idBack} onChange={setIdBack} />
              </div>
              <FileField id="docs" label="Documents" files={docFiles} onChange={setDocFiles} multiple />
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Submitting…" : "Submit"}
              </Button>
            </form>
          )}

          {activity && dealTx && flowStep === "searching" && (
            <div className="mt-3 overflow-hidden rounded-xl border border-primary/20">
              <div className="flex items-center gap-3 bg-primary/5 px-4 py-3">
                <p className="text-sm text-primary">Running AI and AI+ search for matching counterparties…</p>
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

          <div className={side ? "mt-3" : "mt-4"}>
            <DealCanvas
              tx={dealTx ?? FLOWCHART_PREVIEW_TX}
              reload={() => {}}
              readOnly
              hideBidOfferGroups={picking || Boolean(activity)}
              focusSide={side}
              forceRevealAll
              hideMatchingRibbon
              openProofOfIntent={
                !dealTx?.poi_sealed_at && (flowStep === "searching" || flowStep === "results")
              }

              throbStep={throbStep}
              screeningProgress={screeningProgress}
              mediaProgress={mediaProgress}
              matchProgress={
                flowStep === "searching" || flowStep === "results"
                  ? { searching: flowStep === "searching", error: searchError }
                  : null
              }
            />
          </div>

        </div>

        {side && (
          <div
            className={cn(
              "ink-grid w-full rounded-3xl border border-border p-3 sm:p-5",
              side === "offer" && "sm:order-1",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="label-caps">Live workspace</p>
              {(dealTx?.reference ?? activity?.reference) && (
                <span className="shrink-0 rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">
                  {dealTx?.reference ?? activity?.reference}
                </span>
              )}
            </div>


            {activity ? (
              <div className="mt-4 space-y-3">
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
                    <p className="label-caps text-muted-foreground">Attachments</p>
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
                )}

                {/* Once a party is chosen the gate panel takes over the workspace — leaving the
                    match list open below it is what made the screen look stuck. */}
                {(flowStep === "searching" || flowStep === "results") && dealTx && !stagePanel && (
                  <div className="space-y-2">
                    {searchError && (
                      <p className="text-xs text-[#F97316]">Search failed: {searchError}</p>
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
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">Nothing recorded yet.</p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
