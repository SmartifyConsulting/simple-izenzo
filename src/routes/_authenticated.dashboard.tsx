import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Paperclip } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  CanvasStart,
  CounterpartyRecord,
  DealCanvas,
  FLOWCHART_PREVIEW_TX,
  type RecordedActivity,
} from "@/components/canvas/DealCanvas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { advance, fingerprintOf, recordEvent, type Transaction } from "@/lib/tx";
import { searchCounterparties } from "@/lib/izenzo.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Izenzo" },
      { name: "description", content: "Your live deal canvas on the Izenzo Trading Gateway." },
      { property: "og:title", content: "Dashboard — Izenzo" },
      { property: "og:description", content: "Your live deal canvas on the Izenzo Trading Gateway." },
    ],
  }),
  component: Dashboard,
});

type Attachment = { name: string; kind: "ID front" | "ID back" | "Document" };
type FlowStep = "documents" | "searching" | "results";

/** The dashboard is the one screen users work from — the workflow canvas itself, never a
 * separate per-deal detail page. */
function Dashboard() {
  const [picking, setPicking] = useState(false);
  const [direction, setDirection] = useState<"bid" | "offer" | null>(null);
  const [activity, setActivity] = useState<RecordedActivity | null>(null);
  const [dealTx, setDealTx] = useState<Transaction | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("documents");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);
  const search = useServerFn(searchCounterparties);

  // Once something has been recorded, keep the split workspace open (and on the side it was
  // recorded for) even after the form resets — that's what the Live Workspace panel now shows.
  const side = direction ?? activity?.direction ?? null;

  async function runSearch(txId: string) {
    setFlowStep("searching");
    setSearchError(null);
    try {
      await search({ data: { transactionId: txId, kind: "ai" } });
      await advance(txId, "trading", "counterparties");
      setDealTx((prev) => (prev ? { ...prev, stage: "trading", step: "counterparties" } : prev));
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setFlowStep("results");
    }
  }

  async function submitDocuments(e: React.FormEvent) {
    e.preventDefault();
    if (!dealTx) return;
    const collected: Attachment[] = [];
    if (idFrontRef.current?.files?.[0]) collected.push({ name: idFrontRef.current.files[0].name, kind: "ID front" });
    if (idBackRef.current?.files?.[0]) collected.push({ name: idBackRef.current.files[0].name, kind: "ID back" });
    for (const f of Array.from(docsRef.current?.files ?? [])) collected.push({ name: f.name, kind: "Document" });

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
      setSuccessMessage("Success. Next step: Search for counterparties.");
      await runSearch(dealTx.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
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
              onCreated={(tx, recorded) => {
                setPicking(false);
                setDirection(null);
                setActivity(recorded);
                setDealTx(tx);
                setFlowStep("documents");
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
                <div className="space-y-1.5">
                  <Label htmlFor="id-front">ID upload — front</Label>
                  <input
                    id="id-front"
                    ref={idFrontRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted/40 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="id-back">ID upload — back</Label>
                  <input
                    id="id-back"
                    ref={idBackRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted/40 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="docs">Documents</Label>
                <input
                  id="docs"
                  ref={docsRef}
                  type="file"
                  multiple
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted/40 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Submitting…" : "Submit"}
              </Button>
            </form>
          )}

          {activity && dealTx && flowStep === "searching" && (
            <div className="mt-3 overflow-hidden rounded-xl border border-primary/20">
              <div className="flex items-center gap-3 bg-primary/5 px-4 py-3">
                <p className="text-sm text-primary">Searching · Matching Counterparties…</p>
              </div>
              <div className="h-1.5 w-full animate-ribbon-sweep" />
            </div>
          )}

          {successMessage && flowStep !== "documents" && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm text-primary">{successMessage}</p>
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
