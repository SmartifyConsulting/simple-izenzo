import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Paperclip, UploadCloud, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  CanvasStart,
  CounterpartyRecord,
  DealCanvas,
  FLOWCHART_PREVIEW_TX,
  type RecordedActivity,
} from "@/components/canvas/DealCanvas";
import { MahjongView } from "@/components/canvas/MahjongView";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { advance, fingerprintOf, recordEvent, type Transaction } from "@/lib/tx";
import { searchCounterparties } from "@/lib/izenzo.functions";
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
  component: LiveDealEngine,
});

type Attachment = { name: string; kind: "ID front" | "ID back" | "Document" };
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

  const [idFront, setIdFront] = useState<File[]>([]);
  const [idBack, setIdBack] = useState<File[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const search = useServerFn(searchCounterparties);

  // Once something has been recorded, keep the split workspace open (and on the side it was
  // recorded for) even after the form resets — that's what the Live Workspace panel now shows.
  const side = direction ?? activity?.direction ?? null;

  // Resume whatever bid/offer this user last recorded, so a refresh or a later visit doesn't
  // lose their place.
  useEffect(() => {
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
          .select("name, notes")
          .eq("transaction_id", saved.txId)
          .order("created_at", { ascending: true });
        if (docs) {
          setAttachments(
            docs.map((d) => ({
              name: d.name,
              kind: (d.notes as Attachment["kind"] | null) ?? "Document",
            })),
          );
        }
      } catch {
        // Stale/corrupt entry — ignore and let the user start fresh.
      }
    })();
  }, []);

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
      await advance(txId, "trading", "counterparties");
      setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "counterparties" } : prev));
    } catch (err) {
      await minDuration;
      setSearchError((err as Error).message);
    } finally {
      setFlowStep("results");
    }
  }

  async function submitDocuments(e: React.FormEvent) {
    e.preventDefault();
    if (!dealTx) return;
    const collected: Attachment[] = [
      ...idFront.map((f) => ({ name: f.name, kind: "ID front" as const })),
      ...idBack.map((f) => ({ name: f.name, kind: "ID back" as const })),
      ...docFiles.map((f) => ({ name: f.name, kind: "Document" as const })),
    ];

    if (collected.length === 0) {
      toast.error("Attach at least one file");
      return;
    }

    setBusy(true);
    try {
      let version = 1;
      for (const file of collected) {
        const sha = await fingerprintOf({ name: file.name, kind: file.kind, at: Date.now() });
        await supabase.from("documents").insert({
          transaction_id: dealTx.id,
          name: file.name,
          doc_type: file.kind === "Document" ? "other" : "certificate",
          notes: file.kind,
          version: version++,
          sha256: sha,
        });
      }
      await recordEvent({
        transactionId: dealTx.id,
        stage: "trading",
        step: "documents",
        action: "document_attached",
        summary: `${collected.length} document${collected.length === 1 ? "" : "s"} attached`,
        payload: { files: collected },
      });
      await advance(dealTx.id, "trading", "search");
      setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "search" } : prev));
      setAttachments((prev) => [...prev, ...collected]);
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
      <AppShell
        wide
        actions={activity && <p className="text-sm font-bold text-white">{activity.reference}</p>}
      >
        <MahjongView
          tx={dealTx ?? FLOWCHART_PREVIEW_TX}
          reload={() => {}}
          readOnly={!dealTx}
          onRegister={(dir) => {
            setPendingDirection(dir);
            setViewMode("classic");
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      wide
      actions={
        activity && <p className="text-sm font-bold text-white">{activity.reference}</p>
      }
    >
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
            <p className="label-caps">Live workspace</p>

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
                        <span className="truncate">{a.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{a.kind}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(flowStep === "searching" || flowStep === "results") && dealTx && (
                  <div className="space-y-2">
                    {searchError && (
                      <p className="text-xs text-[#F97316]">Search failed: {searchError}</p>
                    )}
                    <CounterpartyRecord txId={dealTx.id} />
                  </div>
                )}
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
