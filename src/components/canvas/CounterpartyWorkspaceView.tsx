import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { respondAsCounterparty } from "@/lib/counterpartyClaim.functions";
import { InlineFrame } from "@/components/canvas/DealCanvas";
import { MapView } from "@/components/canvas/MapView";
import { MutualEngagementPanel } from "@/components/engagement/MutualEngagementPanel";
import { getEngagement } from "@/lib/engagement.functions";
import { readDocument } from "@/lib/documents.functions";
import { DocumentSummaryList } from "@/components/canvas/DocumentSummaryList";
import { Confetti } from "@/components/effects/Confetti";
import { hasSeenOfferCelebration, markOfferCelebrationSeen } from "@/lib/celebrationSeen";
import { money, tradeKindOf, when, type Transaction } from "@/lib/tx";
import { cn } from "@/lib/utils";

/**
 * What a linked counterparty organisation actually sees when it opens the same workspace URL a
 * bidder would: Bid Registration, Bid Information, and every frame from Proof of Intent onward —
 * read-only (InlineFrame's own `viewOnly`), the same components the bidder sees rendering the same
 * record, not a re-described summary of it. Search, AI/AI+, Choice and Online Media never appear
 * here — those are the bidder's own working steps, not shared transparency.
 */
/** A read-only frame in the counterparty's workspace column that folds away to just its heading —
 * the same collapsed-frame treatment the bidder's Live Workspace uses, so a past step stays on the
 * record without taking the room the Offer needs. */
function CollapsibleFrame({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
      >
        <span className="label-caps rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
          {label}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-3.5 pb-3">{children}</div>}
    </div>
  );
}

export function CounterpartyWorkspaceView({ tx, reload }: { tx: Transaction; reload: () => void }) {
  const qc = useQueryClient();
  const respond = useServerFn(respondAsCounterparty);
  const [responding, setResponding] = useState<"accepted" | "declined" | null>(null);
  const [openFrame, setOpenFrame] = useState<string | null>(null);

  const { data: chosenCp } = useQuery({
    queryKey: ["counterparty-self", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("counterparties")
        .select("id, name, counterparty_response, counterparty_responded_at")
        .eq("transaction_id", tx.id)
        .eq("status", "chosen")
        .maybeSingle();
      return data as {
        id: string;
        name: string;
        counterparty_response: "accepted" | "declined" | null;
        counterparty_responded_at: string | null;
      } | null;
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["counterparty-view-documents", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, name, doc_type, notes, storage_path, created_at")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  // The counterparty gets the same document folder the bidder sees on the map — every file filed
  // against this deal, previewable and downloadable — just never the bidder's own working steps
  // (Search, AI/AI+, Choice, Online Media) or anything from the Decision Pack, none of which render
  // in this view at all.
  const mapDocuments = docs
    .filter((d) => Boolean(d.storage_path))
    .map((d) => ({ name: d.name, kind: (d.notes as string | null) ?? d.doc_type ?? "Document", path: d.storage_path }));

  const readDoc = useServerFn(readDocument);
  async function loadDocBlob(d: { name: string; path?: string | null }): Promise<Blob | null> {
    if (!d.path) return null;
    try {
      const { base64, contentType } = await readDoc({ data: { path: d.path } });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: contentType });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not read ${d.name}`);
      return null;
    }
  }
  async function openDoc(d: { name: string; path?: string | null }) {
    const tab = window.open("", "_blank");
    if (tab) {
      tab.document.title = d.name;
      tab.document.body.innerText = "Opening document…";
    }
    const blob = await loadDocBlob(d);
    if (!blob) {
      tab?.close();
      return;
    }
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = d.name;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  async function downloadDoc(d: { name: string; path?: string | null }) {
    const blob = await loadDocBlob(d);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = d.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const loadEngagement = useServerFn(getEngagement);
  const { data: engagement } = useQuery({
    queryKey: ["engagement", tx.id],
    queryFn: () => loadEngagement({ data: { transactionId: tx.id } }),
    enabled: Boolean(tx.poi_sealed_at),
  });
  const offerApproved = engagement?.decided === "accepted";

  // Same single-phase mutual exclusion as the bidder's own Live Workspace map (see
  // live-deal-engine.tsx) — Offer, Counter Offer and Without a Doubt all share the same
  // stage/step, so MapView's default per-node state read more than one of them as "active" at
  // once here, since this view never passed overrideStates at all. Computed the same way: whose
  // turn it is is the only thing that can be "active"; everything else is "open" (or, once WaD is
  // done, "active" itself, its own separate step).
  const responses = engagement?.responses ?? [];
  const lastResponse = responses[responses.length - 1];
  const negotiationTurn = !lastResponse
    ? ("counterparty" as const)
    : lastResponse.response === "challenged"
      ? lastResponse.responder_side === "counterparty"
        ? ("counteroffer" as const)
        : ("offer" as const)
      : lastResponse.response === "accepted"
        ? ("accepted" as const)
        : ("opted_out" as const);
  const phase: "counterOffer" | "offer" | "wad" | "none" = tx.wad_completed_at
    ? "none"
    : negotiationTurn === "accepted"
      ? "wad"
      : negotiationTurn === "counteroffer"
        ? "offer"
        : negotiationTurn === "counterparty" || negotiationTurn === "offer"
          ? "counterOffer"
          : "none";
  const mapOverrides = {
    offer: phase === "offer" ? "active" : "open",
    counterOffer: phase === "counterOffer" ? "active" : "open",
    wad: !tx.wad_completed_at ? (phase === "wad" ? "active" : "open") : "active",
  } as const;

  // Same one-time confetti moment as the bidder's Live Workspace — fires the first time this
  // browser sees the offer as approved, whether that's live or the next time the counterparty
  // opens this screen having been away when the bidder approved it.
  const [celebrateApproval, setCelebrateApproval] = useState(false);
  useEffect(() => {
    if (!offerApproved) return;
    if (hasSeenOfferCelebration(tx.id)) return;
    markOfferCelebrationSeen(tx.id);
    setCelebrateApproval(true);
  }, [offerApproved, tx.id]);

  // The Offer stays visible as its own record after approval too — same collapsed-frame treatment
  // as the bidder's own Live Workspace — rather than vanishing the moment it's decided.
  const [offerFrameOpen, setOfferFrameOpen] = useState(true);
  const offerFrameAutoCollapsed = useRef(false);
  useEffect(() => {
    if (!offerApproved || offerFrameAutoCollapsed.current) return;
    offerFrameAutoCollapsed.current = true;
    setOfferFrameOpen(false);
  }, [offerApproved]);

  // Bid Information is only useful reading before the negotiation gets going — once a counter has
  // gone back and forth, or the offer's been accepted or rejected, it's just noise sitting above
  // the Offer thread that actually matters now. Collapses itself the first time that happens, but
  // stays a normal toggle afterward (re-opening it by hand doesn't get fought back closed).
  const negotiationStarted = (engagement?.responses.length ?? 0) > 0;
  const [bidInfoOpen, setBidInfoOpen] = useState(true);
  const autoCollapsedBidInfo = useRef(false);
  useEffect(() => {
    if (!negotiationStarted || autoCollapsedBidInfo.current) return;
    autoCollapsedBidInfo.current = true;
    setBidInfoOpen(false);
  }, [negotiationStarted]);

  async function respondTo(response: "accepted" | "declined") {
    setResponding(response);
    try {
      await respond({ data: { transactionId: tx.id, response } });
      toast.success(response === "accepted" ? "You've accepted this deal." : "You've opted out of this deal.");
      await qc.invalidateQueries({ queryKey: ["counterparty-self", tx.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResponding(null);
    }
  }

  const kind = tradeKindOf(tx.reference);
  const kindWord = kind === "offer" ? "Offer" : "Bid";
  const canRespond = !tx.intent_confirmed_at && !tx.poi_sealed_at;
  const responded = chosenCp?.counterparty_response ?? null;

  const toggleFrame = (key: string) => setOpenFrame((prev) => (prev === key ? null : key));

  return (
    <AppShell wide title={tx.title} description={`You're viewing this deal as its counterparty — read-only, shared for transparency.`}>
      {celebrateApproval && (
        <Confetti message="The offer has been approved." onDone={() => setCelebrateApproval(false)} />
      )}
      <div className="mx-auto max-w-6xl space-y-4">
        {/* The registration line spans both columns — who this deal is, and its BID/OFF number. */}
        <div className="glass-node space-y-1.5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={
                "label-caps rounded-full px-2.5 py-1 " +
                (kind === "offer" ? "bg-[#4169e1] text-white" : "bg-emerald-600 text-white")
              }
            >
              {kindWord} Registration
            </span>
            <span className="font-mono text-base font-bold tracking-wide text-foreground">{tx.reference}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Registered {when(tx.created_at)} · {money(tx.price, tx.currency)}
            {Number(tx.quantity) > 0 ? ` · ${tx.quantity} ${tx.unit ?? ""}` : ""}
          </p>
        </div>

        {/* The same split the bidder gets: the workflow map on the left, the Live Workspace on the
            right. Only the shared record appears here — Search, AI/AI+, Choice and Online Media are
            the bidder's own working steps and never render in this view. */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="glass-node p-4" style={{ "--throb-accent": "#4169e1" } as CSSProperties}>
            <div className="relative w-full" style={{ aspectRatio: "960 / 1050" }}>
              <MapView
                tx={tx}
                reload={reload}
                readOnly
                reference={tx.reference}
                overrideStates={mapOverrides}
                documents={mapDocuments}
                onOpenDocument={(d) => void openDoc(d)}
                onDownloadDocument={(d) => void downloadDoc(d)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="label-caps text-muted-foreground">Live Workspace</p>

            {/* Same "settled record" gold look as the bidder's own Step 1 accordion — plain grey
                until the offer is actually approved (and the confetti above has fired), gold once
                it is. Look-alike only here: the counterparty's record beneath it isn't collapsed
                behind this the way the bidder's Step 1 bundles everything, since this view is
                already a short, flat list. */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border-2 px-3 py-1.5",
                offerApproved ? "border-black bg-amber-400/35" : "border-border bg-muted",
              )}
            >
              <span className="label-caps rounded-full bg-[var(--step-pill-bg)] px-2.5 py-0.5 text-[var(--step-pill-fg)]">
                Step 1 · Trading
              </span>
              <span className="ml-auto shrink-0 font-mono text-sm font-bold tracking-wide text-foreground">
                {tx.reference}
              </span>
            </div>

            {/* The documents this deal is running on — the counterparty reads them, but the bidder's
                own Choice and AI+ recommendation output are never part of this view. */}
            <CollapsibleFrame label={`${kindWord} Information`} open={bidInfoOpen} onToggle={() => setBidInfoOpen((v) => !v)}>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Commodity:</span> {tx.commodity ?? "—"}</p>
                <p><span className="text-muted-foreground">Jurisdiction:</span> {tx.jurisdiction ?? "—"}</p>
                <p><span className="text-muted-foreground">Incoterms:</span> {tx.incoterms ?? "—"}</p>
              </div>
              {/* Same scannable, section-headed formatting the bidder's own Bid Information gets —
                  not a plain paragraph dump of the AI summary. */}
              {(tx as unknown as { document_summary?: string | null }).document_summary && (
                <div className="mt-2">
                  <DocumentSummaryList
                    summary={(tx as unknown as { document_summary: string }).document_summary}
                  />
                </div>
              )}
              {docs.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {docs.map((d) => (
                    <li key={d.id}>{d.name}</li>
                  ))}
                </ul>
              )}
            </CollapsibleFrame>

            {/* The steps leading up to the negotiation stay on the record, folded away — they come
                before the Offer, so they read in the order the deal actually ran. */}
            {tx.intent_confirmed_at && (
              <CollapsibleFrame
                label="Confirmed Intent"
                open={openFrame === "intent"}
                onToggle={() => toggleFrame("intent")}
              >
                <InlineFrame bare viewOnly tx={tx} stage="trading" step="intent" reload={reload} onClose={() => {}} />
              </CollapsibleFrame>
            )}

            {tx.poi_sealed_at && (
              <CollapsibleFrame
                label="Seal Intent"
                open={openFrame === "poi"}
                onToggle={() => toggleFrame("poi")}
              >
                <InlineFrame bare viewOnly tx={tx} stage="trading" step="poi" reload={reload} onClose={() => {}} />
              </CollapsibleFrame>
            )}

            {/* The Offer sits after Seal Intent — it only exists once the intent is sealed. Stays
                visible as its own record after approval too (same folded-frame treatment the
                bidder's Live Workspace uses) rather than vanishing the moment it's decided —
                collapses itself the first time it's approved, but can still be reopened by hand. */}
            {tx.poi_sealed_at && (
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
                      Accept, counter or reject the terms — a back-and-forth exchange between the two
                      of you until you reach agreement.
                    </span>
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", offerFrameOpen && "rotate-180")}
                  />
                </button>
                {offerFrameOpen && (
                  <div className="px-3.5 pb-3">
                    <MutualEngagementPanel transactionId={tx.id} offerOnly />
                  </div>
                )}
              </div>
            )}

            {offerApproved && !tx.wad_completed_at && (
              <div className="glass-node p-4">
                <span className="label-caps mb-2 inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
                  Without a Doubt
                </span>
                <InlineFrame bare viewOnly tx={tx} stage="compliance" step="wad" reload={reload} onClose={() => {}} />
              </div>
            )}

            {canRespond && (
              <div className="glass-node space-y-2 p-4">
                <p className="text-sm font-medium">Your response</p>
                <p className="text-xs text-muted-foreground">
                  You can accept or opt out of this deal at any point before it's binding — opting out
                  is always available up until Proof of Intent is sealed.
                </p>
                {responded ? (
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {responded === "accepted" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    You {responded} this deal
                    {chosenCp?.counterparty_responded_at ? ` — ${when(chosenCp.counterparty_responded_at)}` : ""}.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={responding !== null} onClick={() => void respondTo("accepted")}>
                      {responding === "accepted" ? "Accepting…" : "Accept"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      disabled={responding !== null}
                      onClick={() => void respondTo("declined")}
                    >
                      {responding === "declined" ? "Opting out…" : "Opt out"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {tx.wad_completed_at && (
              <CollapsibleFrame
                label="Without a Doubt"
                open={openFrame === "wad"}
                onToggle={() => toggleFrame("wad")}
              >
                <InlineFrame bare viewOnly tx={tx} stage="compliance" step="wad" reload={reload} onClose={() => {}} />
              </CollapsibleFrame>
            )}

            {tx.finality_sealed_at && (
              <CollapsibleFrame
                label="Finality"
                open={openFrame === "finality"}
                onToggle={() => toggleFrame("finality")}
              >
                <InlineFrame bare viewOnly tx={tx} stage="finality" step="record" reload={reload} onClose={() => {}} />
              </CollapsibleFrame>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
