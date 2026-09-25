import { hasSeenOfferCelebration, markOfferCelebrationSeen } from "@/lib/celebrationSeen";
import { GovernanceCard } from "@/components/steps/GovernanceCard";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronDown, Coins, Download, FileText, Loader2, Sparkles, Lock, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { sealProofOfIntent, completeWad, runAiProposal, searchCounterparties, extractMaterialTerms } from "@/lib/izenzo.functions";
import { notifyChosenCounterparty } from "@/lib/counterpartyOutreach.functions";
import { sourceLabel, userFacingText } from "@/lib/userFacingText";
import { type ScreeningCheck } from "@/lib/screening.functions";
import { emitAiPlusSpineEvent, type StageContext } from "@/lib/decisionPack.functions";
import { advance, fingerprintOf, money, recordEvent, shortHash, when, type Transaction, type TxEvent } from "@/lib/tx";
import { POI_COST, WAD_COST, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { VerificationPanel } from "@/components/verification/VerificationPanel";
import { Logo } from "@/components/Logo";
import { MutualEngagementPanel } from "@/components/engagement/MutualEngagementPanel";
import { attachLegalDocument, getEngagement, setDiligenceState, signDocument, type Side } from "@/lib/engagement.functions";
import { getPartyRegistrationInfo } from "@/lib/partyRegistration.functions";
import { generateConceptBrief } from "@/lib/conceptBrief.functions";
import { generateConceptQuestions } from "@/lib/conceptQuestions.functions";
import { DocumentSummaryList } from "@/components/canvas/DocumentSummaryList";
import { buildBrandedCertificatePdf } from "@/lib/certificatePdf";
import { Confetti } from "@/components/effects/Confetti";
import { CommoditySearch } from "@/components/CommoditySearch";
import { COUNTRIES } from "@/lib/countries";
import { UNITS } from "@/lib/units";

/**
 * Tells the protected AI+ service that a spine moment was recorded. Advisory only, and never
 * blocking: the moment itself is already written before this runs, and a switched-off, slow or
 * unreachable service simply produces nothing.
 */
function notifyAiPlus(transactionId: string, stageContext: StageContext) {
  void emitAiPlusSpineEvent({ data: { transactionId, stageContext } }).catch(() => {});
}


/** Server-side token gates (POI, WaD) throw "Not enough tokens…" when the org's balance is too
 * low. Surface that specific failure with a direct link to the Buy Tokens screen instead of a
 * plain error toast. */
function reportGateError(err: unknown, navigate: ReturnType<typeof useNavigate>, tx: Transaction) {
  const message = (err as Error).message;
  if (message.toLowerCase().includes("not enough tokens")) {
    const returnTo = `/tx/${tx.id}/${tx.stage}/${tx.step}`;
    toast.error(message, {
      action: {
        label: "Buy tokens",
        onClick: () => navigate({ to: "/credits", search: { returnTo } }),
      },
    });
  } else {
    toast.error(message);
  }
}

type Props = {
  tx: Transaction;
  stage: StageKey;
  step: string;
  reload: () => void;
  /** Releases the chosen counterparty and reopens the list — only meaningful on Intent/Seal
   * Intent, where it's still possible to change who this deal is with. */
  onChangeParty?: (() => void) | undefined;
  /** Moves the Live Workspace on to the next step's own panel — only meaningful where a step ends
   * in an explicit "Continue" rather than auto-advancing on its own. */
  onContinue?: (() => void) | undefined;
};

/* ---------- shared bits ---------- */

/** A cleared Proof of Intent or Without a Doubt reads as an actual issued certificate — the
 * Izenzo mark, a title, a double border and a seal number — rather than a plain monospace text
 * dump of the same facts. */
function CertificateBlock({
  heading,
  lines,
  sealId,
  draft,
}: {
  heading: string;
  lines: { label: string; value: string }[];
  /** The short fingerprint/hash printed as the certificate's own seal/serial number. */
  sealId: string | null;
  /** Shown as a plain draft, not yet a real certificate — a large grey diagonal "DRAFT" watermark
   * over the record, gone the moment it's actually confirmed/cleared. */
  draft?: boolean | undefined;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-double border-foreground/70 bg-gradient-to-b from-muted/40 to-transparent p-5">
      {/* Kept mounted (rather than removed outright) so the moment it stops being a draft, the
          watermark fades out instead of snapping away instantly. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] select-none whitespace-nowrap text-6xl font-black uppercase tracking-widest text-muted-foreground/25 transition-opacity duration-[1400ms] ease-out",
          draft ? "opacity-100" : "opacity-0",
        )}
      >
        Draft
      </span>
      <div className="relative flex items-center justify-between gap-3 pb-3">
        <Logo />
      </div>
      <p className="mt-4 text-center font-sans text-sm font-bold uppercase tracking-[0.14em] text-foreground">
        {heading}
      </p>
      <dl className="mx-auto mt-4 grid max-w-md gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {lines.map((l) => (
          <div key={l.label} className="contents">
            <dt className="text-muted-foreground">{l.label}</dt>
            <dd className="break-words font-medium text-foreground">{l.value}</dd>
          </div>
        ))}
      </dl>
      {sealId && (
        <p className="mt-4 truncate pt-2 text-center font-mono text-[10px] text-muted-foreground">
          Seal {sealId}
        </p>
      )}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
  footer,
  tone = "default",
  pill = false,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "light" forces a white card with black text — used for Confirm Intent, which reads like a
   * document that's about to be signed rather than another in-app step panel. */
  tone?: "default" | "light";
  /** Renders the title as the same grey/white rounded pill used for Live Workspace frame
   * headings, instead of the plain small-caps label — used for Confirm Intent. */
  pill?: boolean;
}) {
  const light = tone === "light";
  return (
    // Typography matches the Bid Information frame on the Live Workspace: a small-caps section
    // label, small body copy, and compact list text — so Proof of Intent and every frame after it
    // read at the same size rather than a step larger.
    <div className={cn("rounded-md border", light ? "border-slate-200 bg-white text-slate-900" : "border-border")}>
      {/* Both the header and the body used to render unconditionally — an empty bordered strip
          for a titleless Panel, and another for one with nothing to say in its body (e.g. Seal
          Intent once intent is already confirmed and tokens are sufficient) — reading as two
          blank frames stacked above the actual footer content. Both are skipped when there is
          nothing in them. */}
      {(title || description) && (
        <div className="px-4 py-3">
          {/* Same heading treatment as the Bid Registration frame: small caps, muted. */}
          {/* font-sans is explicit: headings otherwise inherit the display face, which made this
              read in a different font from the LIVE WORKSPACE / BID INFORMATION labels. */}
          {title ? (
            pill ? (
              <h2 className="label-caps inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 font-sans text-[var(--lw-pill-fg)]">
                {title}
              </h2>
            ) : (
              <h2 className={cn("label-caps font-sans font-bold", light ? "text-slate-900" : "text-muted-foreground")}>
                {title}
              </h2>
            )
          ) : null}

          {description && (
            <p className={cn("mt-1 text-xs", light ? "text-slate-500" : "text-muted-foreground")}>{description}</p>
          )}
        </div>
      )}
      {children != null && <div className="p-4 text-xs leading-relaxed">{children}</div>}
      {footer && <div className="px-4 py-3 text-xs">{footer}</div>}
    </div>
  );
}

/** Sits next to a token-gated action button: the org's current balance, a token icon, and a Buy
 * Tokens link straight to the pay gate (carrying `returnTo` so a purchase drops the user right
 * back here with the gate button already live). Used so it's never a mystery why a "Seal"/"Start
 * WaD" button is greyed out — the cost and the shortfall are both visible up front, not just
 * after a failed attempt. */
function TokenGateFooter({ cost }: { cost: number }) {
  const { org } = useAuth();
  const balance = org?.credits ?? 0;
  const short = balance < cost;
  const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;
  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Spelled out as a balance, never a bare number — a lone "3 tokens" beside a Seal button
          reads as the price of the action. */}
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold",
          short ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-muted/40 text-muted-foreground",
        )}
      >
        <Coins className="h-3.5 w-3.5" />
        Your balance: {balance} token{balance === 1 ? "" : "s"}
      </span>
      <span className="text-muted-foreground">
        Cost: {cost} token{cost === 1 ? "" : "s"}
      </span>
      {short && (
        <Link to="/credits" search={{ returnTo }}>
          <Button type="button" size="sm" variant="outline">
            Buy tokens
          </Button>
        </Link>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

/* ---------- entry ---------- */

export function StepScreen(props: Props) {
  return (
    <div className="space-y-8">
      <GovernanceCard stage={props.stage} step={props.step} />
      <Body {...props} />
    </div>
  );
}

function Body(props: Props) {
  const key = `${props.stage}/${props.step}`;
  switch (key) {
    case "trading/bid-offer":
      return <BidOffer {...props} />;
    case "trading/documents":
      return <Documents {...props} />;
    case "trading/media":
      return <MediaScan {...props} />;
    case "trading/search":
      return <SearchStep {...props} />;
    case "trading/ai":
      return <AiStep {...props} kind="ai" />;
    case "trading/ai-plus":
      return <AiStep {...props} kind="ai_plus" />;
    case "trading/counterparties":
      return <CounterpartyList {...props} />;
    case "trading/choice":
      return <ChoiceStep {...props} />;
    case "trading/intent":
      return <IntentStep {...props} />;
    case "trading/poi":
      return <PoiStep {...props} />;
    case "compliance/wad":
      return <WadStep {...props} />;
    case "execution/business-docs":
      return <BusinessDocsStep {...props} />;
    case "execution/stakeholders":
      return <StakeholderStep {...props} />;
    case "memory/ledger":
      return <MemoryLedger {...props} />;
    default:
      if (props.stage === "execution") return <ExecutionStep {...props} />;
      if (props.stage === "finality") return <FinalityStep {...props} />;
      return <Empty text="Nothing to record here." />;
  }
}

/* ---------- trading ---------- */

const INCOTERMS = ["EXW", "FOB", "CIF", "CFR", "DAP", "DDP", "FCA", "CPT"];

function BidOffer({ tx, reload }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    direction: "bid",
    commodity: tx.commodity ?? "",
    price: String(tx.price ?? ""),
    quantity: String(tx.quantity ?? ""),
    unit: tx.unit ?? "",
    incoterms: tx.incoterms ?? "",
    jurisdiction: tx.jurisdiction ?? "",
    paymentTerms: "",
    deliveryTerms: "",
  });
  const [busy, setBusy] = useState(false);

  const { data: bids = [] } = useQuery({
    queryKey: ["bids", tx.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bid_offers")
        .select("*")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const requiredFilled =
    form.commodity.trim() &&
    form.price &&
    form.quantity &&
    form.unit.trim() &&
    form.incoterms &&
    form.jurisdiction.trim() &&
    form.paymentTerms.trim() &&
    form.deliveryTerms.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requiredFilled) {
      toast.error("Every field is required before this bid or offer can be recorded.");
      return;
    }
    setBusy(true);
    try {
      const terms = `Payment: ${form.paymentTerms.trim()}. Delivery: ${form.deliveryTerms.trim()}.`;
      const { error } = await supabase.from("bid_offers").insert({
        transaction_id: tx.id,
        direction: form.direction,
        price: Number(form.price),
        quantity: Number(form.quantity),
        unit: form.unit.trim(),
        currency: tx.currency,
        terms,
      });
      if (error) throw error;
      await supabase
        .from("transactions")
        .update({
          commodity: form.commodity.trim(),
          incoterms: form.incoterms,
          jurisdiction: form.jurisdiction.trim(),
        })
        .eq("id", tx.id);
      await recordEvent({
        transactionId: tx.id,
        stage: "trading",
        step: "bid-offer",
        action: form.direction === "bid" ? "bid_placed" : "offer_placed",
        summary: `${form.direction === "bid" ? "Bid" : "Offer"} at ${form.price} ${tx.currency}`,
        payload: { ...form },
      });
      await advance(tx.id, "trading", "documents");
      await qc.invalidateQueries({ queryKey: ["bids", tx.id] });
      reload();
      toast.success("Recorded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Place a bid or an offer"
        description="Every field below is required. Each entry is new — nothing is overwritten."
        footer={
          <div className="text-right">
            <Button size="sm" form="bid-form" type="submit" disabled={busy}>
              Record
            </Button>
          </div>
        }
      >
        <form id="bid-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Direction">
            <Select
              value={form.direction}
              onValueChange={(v) => setForm({ ...form, direction: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bid">Bid</SelectItem>
                <SelectItem value="offer">Offer</SelectItem>
                <SelectItem value="counter">Counter</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Commodity">
            <CommoditySearch value={form.commodity} onChange={(v) => setForm({ ...form, commodity: v })} />
          </Field>
          <Field label={`Price (${tx.currency})`}>
            <Input
              required
              type="number"
              step="any"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </Field>
          <Field label="Quantity">
            <Input
              required
              type="number"
              step="any"
              min="0"
              className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="Unit">
            <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a unit" />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Incoterms">
            <Select
              value={form.incoterms}
              onValueChange={(v) => setForm({ ...form, incoterms: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {INCOTERMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Governing jurisdiction">
            <Input
              required
              placeholder="e.g. South Africa"
              value={form.jurisdiction}
              onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
            />
          </Field>
          <Field label="Payment terms">
            <Input
              required
              placeholder="e.g. 30% on signing, 70% against shipping docs"
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Delivery terms">
              <Input
                required
                placeholder="e.g. First shipment within 45 days, inspection by SGS at load port"
                value={form.deliveryTerms}
                onChange={(e) => setForm({ ...form, deliveryTerms: e.target.value })}
              />
            </Field>
          </div>
        </form>
      </Panel>

      <Panel title="History">
        {bids.length === 0 ? (
          <Empty text="No bids or offers recorded yet." />
        ) : (
          <ul className="divide-y divide-border">
            {bids.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <Badge variant="secondary" className="mr-2 font-normal capitalize">
                    {b.direction}
                  </Badge>
                  {money(b.price, b.currency)} · {b.quantity ?? "—"} {b.unit ?? ""}
                  {b.terms && <span className="block text-xs text-muted-foreground">{b.terms}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{when(b.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Documents({ tx, reload }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", doc_type: "other", notes: "" });
  const [busy, setBusy] = useState(false);

  const { data: docs = [] } = useQuery({
    queryKey: ["documents", tx.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const sha = await fingerprintOf({ ...form, at: Date.now() });
      const version = docs.filter((d) => d.name === form.name).length + 1;
      const { error } = await supabase.from("documents").insert({
        transaction_id: tx.id,
        name: form.name,
        doc_type: form.doc_type,
        notes: form.notes || null,
        version,
        sha256: sha,
      });
      if (error) throw error;
      await recordEvent({
        transactionId: tx.id,
        stage: "trading",
        step: "documents",
        action: "document_attached",
        summary: `${form.name} v${version}`,
        payload: { ...form, version, sha256: sha },
      });
      await advance(tx.id, "trading", "search");
      setForm({ name: "", doc_type: "other", notes: "" });
      await qc.invalidateQueries({ queryKey: ["documents", tx.id] });
      reload();
      toast.success("Document recorded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Attach a document"
        description="Each attachment is versioned and fingerprinted."
        footer={
          <div className="text-right">
            <Button size="sm" form="doc-form" type="submit" disabled={busy}>
              Record document
            </Button>
          </div>
        }
      >
        <form id="doc-form" onSubmit={add} className="grid gap-4 sm:grid-cols-2">
          <Field label="Document name">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="term_sheet">Term sheet</SelectItem>
                <SelectItem value="specification">Specification</SelectItem>
                <SelectItem value="certificate">Certificate</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
        </form>
      </Panel>

      <Panel title="Attached">
        {docs.length === 0 ? (
          <Empty text="No documents attached yet." />
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {d.name} <span className="text-muted-foreground">v{d.version}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{when(d.created_at)}</span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {shortHash(d.sha256)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function MediaScan({ tx, reload }: Props) {
  const run = useServerFn(runAiProposal);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");

  async function scan() {
    setBusy(true);
    try {
      const res = await run({
        data: {
          transactionId: tx.id,
          kind: "ai",
          question:
            "Act as an open-source media scan. List what a diligence officer should look for in news and social media about this commodity, route and jurisdiction, and flag the risk themes worth checking. Be explicit that these are prompts for human checking, not findings.",
        },
      });
      setOutput(res.output);
      await recordEvent({
        transactionId: tx.id,
        stage: "trading",
        step: "media",
        action: "media_scanned",
        summary: "Social and news media scan run",
        payload: {},
      });
      await advance(tx.id, "trading", "intent");
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Social and news media"
      description="Findings are recorded. They are never acted on automatically."
      footer={
        <div className="text-right">
          <Button size="sm" onClick={scan} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Run scan
          </Button>
        </div>
      }
    >
      {output ? (
        <pre className="whitespace-pre-wrap text-sm leading-relaxed">{output}</pre>
      ) : (
        <Empty text="Run the scan to surface the themes worth checking before you search for counterparties." />
      )}
    </Panel>
  );
}

function SearchStep({ tx, reload }: Props) {
  const qc = useQueryClient();
  const search = useServerFn(searchCounterparties);
  const [region, setRegion] = useState("");
  const [candidate, setCandidate] = useState({ name: "", jurisdiction: "", source: "manual" });
  const [running, setRunning] = useState(false);

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ["counterparties", tx.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("*")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [searchFailed, setSearchFailed] = useState(false);
  const autoRunFired = useRef(false);

  /** Fires once, automatically, the moment this step is reached — search is no longer a manual
   * click. Skips if candidates already exist (e.g. returning to this step after a page reload). */
  useEffect(() => {
    if (candidatesLoading || autoRunFired.current) return;
    autoRunFired.current = true;
    if (candidates.length === 0) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatesLoading]);

  async function runSearch() {
    setRunning(true);
    setSearchFailed(false);
    try {
      await recordEvent({
        transactionId: tx.id,
        stage: "trading",
        step: "search",
        action: "search_run",
        summary: `AI & AI+ search: ${tx.commodity ?? "any"}${region ? ` in ${region}` : ""}`,
        payload: { region },
      });
      const [aiResult, aiPlusResult] = await Promise.all([
        search({ data: { transactionId: tx.id, kind: "ai", region: region || undefined } }),
        search({ data: { transactionId: tx.id, kind: "ai_plus", region: region || undefined } }),
      ]);
      await qc.invalidateQueries({ queryKey: ["counterparties", tx.id] });
      await advance(tx.id, "trading", "ai");
      reload();
      const total = aiResult.candidates.length + aiPlusResult.candidates.length;
      toast.success(`${total} candidate(s) found`);
    } catch (err) {
      toast.error((err as Error).message);
      setSearchFailed(true);
    } finally {
      setRunning(false);
    }
  }

  async function addCandidate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { error } = await supabase.from("counterparties").insert({
        transaction_id: tx.id,
        name: candidate.name,
        jurisdiction: candidate.jurisdiction || null,
        source: candidate.source,
      });
      if (error) throw error;
      await recordEvent({
        transactionId: tx.id,
        stage: "trading",
        step: "search",
        action: "counterparty_surfaced",
        summary: candidate.name,
        payload: { ...candidate },
      });
      setCandidate({ name: "", jurisdiction: "", source: "manual" });
      await qc.invalidateQueries({ queryKey: ["counterparties", tx.id] });
      toast.success("Candidate surfaced");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Search for counterparties"
        description="AI scans for organisations matching this bid's commodity, price, incoterms and jurisdiction, as soon as this step opens. What was searched is part of the record."
        footer={
          running ? (
            <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          ) : searchFailed ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" onClick={runSearch} className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Search again
              </Button>
            </div>
          ) : null
        }
      >
        <Field label="Preferred counterparty region (optional) — used if you search again">
          <Select value={region || "any"} onValueChange={(v) => setRegion(v === "any" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Any country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any country</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Panel>

      <Panel title="Candidates surfaced">
        {candidates.length === 0 ? (
          <Empty text={running ? "Searching…" : "No candidates yet."} />
        ) : (
          <ul className="divide-y divide-border">
            {candidates.map((c) => (
              <li key={c.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <div className="flex items-center gap-2">
                    {c.score != null && (
                      <Badge variant="secondary" className="font-normal">
                        {c.score}/100
                      </Badge>
                    )}
                    <Badge variant="secondary" className="font-normal">
                      {sourceLabel(c.source)}
                    </Badge>
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[c.jurisdiction, c.sector].filter(Boolean).join(" · ")}
                </p>
                {userFacingText(c.rationale) && <p className="mt-1 text-xs text-muted-foreground">{userFacingText(c.rationale)}</p>}
                <EvidenceLink flags={c.media_flags} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Add a candidate manually"
        footer={
          <div className="text-right">
            <Button size="sm" form="cand-form" type="submit" variant="outline">
              Add candidate
            </Button>
          </div>
        }
      >
        <form id="cand-form" onSubmit={addCandidate} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input
              required
              value={candidate.name}
              onChange={(e) => setCandidate({ ...candidate, name: e.target.value })}
            />
          </Field>
          <Field label="Jurisdiction">
            <Input
              value={candidate.jurisdiction}
              onChange={(e) => setCandidate({ ...candidate, jurisdiction: e.target.value })}
            />
          </Field>
        </form>
      </Panel>
    </div>
  );
}

function AiStep({ tx, reload, kind }: Props & { kind: "ai" | "ai_plus" }) {
  const run = useServerFn(runAiProposal);
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: proposals = [] } = useQuery({
    queryKey: ["ai", tx.id, kind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_proposals")
        .select("*")
        .eq("transaction_id", tx.id)
        // AI+ advice is stored under either name: `ai_plus` from the hosted model and
        // `ai_plus_decision_pack` from the client's protected service.
        .in("kind", kind === "ai_plus" ? ["ai_plus", "ai_plus_decision_pack"] : ["ai"])

        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function ask() {
    setBusy(true);
    try {
      await run({ data: { transactionId: tx.id, kind, question: question || undefined } });
      await qc.invalidateQueries({ queryKey: ["ai", tx.id, kind] });
      setQuestion("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function adopt(id: string) {
    const { data: userData } = await supabase.auth.getUser();
    await supabase
      .from("ai_proposals")
      .update({ adopted_by: userData.user?.id ?? null, adopted_at: new Date().toISOString() })
      .eq("id", id);
    await recordEvent({
      transactionId: tx.id,
      stage: "trading",
      step: kind === "ai" ? "ai" : "ai-plus",
      action: "proposal_adopted",
      summary: "A person adopted an AI proposal",
      payload: { proposalId: id },
    });
    await advance(tx.id, "trading", kind === "ai" ? "ai-plus" : "counterparties");
    await qc.invalidateQueries({ queryKey: ["ai", tx.id, kind] });
    reload();
    toast.success("Adopted and recorded");
  }

  return (
    <div className="space-y-6">
      <Panel
        title={kind === "ai" ? "Ask AI" : "Ask AI+"}
        description="AI proposes. You adopt, and the adoption is written to the record."
        footer={
          <div className="text-right">
            <Button size="sm" onClick={ask} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Run
            </Button>
          </div>
        }
      >
        <Textarea
          rows={3}
          placeholder="Optional: ask something specific about this transaction."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </Panel>

      {proposals.length === 0 ? (
        <Empty text="No proposals yet." />
      ) : (
        proposals.map((p) => (
          <Panel
            key={p.id}
            title={p.adopted_at ? "Adopted proposal" : "Proposal"}
            description={`${p.model ?? ""} · ${when(p.created_at)}`}
            footer={
              p.adopted_at ? (
                <p className="flex items-center gap-2 text-xs text-success">
                  <Check className="h-3.5 w-3.5" /> Adopted {when(p.adopted_at)}
                </p>
              ) : (
                <div className="text-right">
                  <Button size="sm" variant="outline" onClick={() => adopt(p.id)}>
                    Adopt this proposal
                  </Button>
                </div>
              )
            }
          >
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">{p.output}</pre>
          </Panel>
        ))
      )}
    </div>
  );
}

function useCounterparties(txId: string) {
  return useQuery({
    queryKey: ["counterparties", txId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("*")
        .eq("transaction_id", txId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

const RATING_BADGE_CLASS: Record<string, string> = {
  trusted: "bg-success text-white",
  neutral: "bg-muted-foreground text-white",
  flagged: "bg-destructive text-white",
};

const RATING_DISCLAIMER =
  "This rating is informational only. It does not replace KYC, KYB, sanctions/PEP screening or any WaD gate.";

/** Shows the page a searched candidate was actually found on, so a name can be checked against
 * its source rather than taken on trust. */
function EvidenceLink({ flags }: { flags?: unknown }) {
  const evidence =
    flags && typeof flags === "object" && Array.isArray((flags as { evidence?: unknown }).evidence)
      ? ((flags as { evidence: { url?: unknown }[] }).evidence.find(
          (e) => typeof e?.url === "string",
        )?.url as string | undefined)
      : undefined;
  if (!evidence) return null;
  return (
    <a
      href={evidence}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-block text-xs text-muted-foreground underline hover:text-foreground"
    >
      View source
    </a>
  );
}

function RatingBadge({ c }: { c: { rating_band: string | null; rating_override: string | null } }) {
  const effective = c.rating_override ?? c.rating_band;
  if (!effective) return null;
  return (
    <Badge variant="outline" className={cn("font-normal border-transparent capitalize", RATING_BADGE_CLASS[effective])}>
      {effective}
      {c.rating_override && " (overridden)"}
    </Badge>
  );
}

function RatingDrawer({
  c,
}: {
  c: {
    id: string;
    score: number | null;
    rationale: string | null;
    source: string | null;
    rating_band: string | null;
    rating_version: string;
    rating_override: string | null;
    rating_override_reason: string | null;
  };
}) {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  async function override() {
    const value = window.prompt("Override rating (trusted / neutral / flagged):");
    if (!value || !["trusted", "neutral", "flagged"].includes(value)) {
      if (value) toast.error("Must be trusted, neutral or flagged");
      return;
    }
    const reason = window.prompt("Override reason (required):");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_override_counterparty_rating", {
      p_counterparty_id: c.id,
      p_override: value as "trusted" | "neutral" | "flagged",
      p_reason: reason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rating overridden");
    await qc.invalidateQueries({ queryKey: ["counterparties"] });
  }

  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Why this rating?
      </summary>
      <div className="mt-1.5 space-y-1 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
        <p>Score: {c.score ?? "—"}</p>
        <p>Found: {sourceLabel(c.source)}</p>
        {userFacingText(c.rationale) && <p>Why it fits: {userFacingText(c.rationale)}</p>}
        <p>Methodology: {c.rating_version}</p>
        {c.rating_override && (
          <p className="text-warning">
            Overridden to {c.rating_override}: {c.rating_override_reason}
          </p>
        )}
        <p className="pt-1 italic">{RATING_DISCLAIMER}</p>
        {isAdmin && (
          <Button size="sm" variant="outline" className="mt-1" onClick={override}>
            Override rating
          </Button>
        )}
      </div>
    </details>
  );
}

function CounterpartyList({ tx, reload }: Props) {
  const { data: cps = [] } = useCounterparties(tx.id);
  const qc = useQueryClient();

  async function review(id: string, status: string) {
    await supabase.from("counterparties").update({ status }).eq("id", id);
    await recordEvent({
      transactionId: tx.id,
      stage: "trading",
      step: "counterparties",
      action: `counterparty_${status}`,
      summary: `Counterparty ${status}`,
      payload: { id },
    });
    await advance(tx.id, "trading", "choice");
    await qc.invalidateQueries({ queryKey: ["counterparties", tx.id] });
    reload();
  }

  return (
    <Panel title="Counterparties surfaced" description="Review each one before any choice is made.">
      {cps.length === 0 ? (
        <Empty text="Nothing surfaced yet. Go back to Search to add candidates." />
      ) : (
        <ul className="divide-y divide-border">
          {cps.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.jurisdiction ?? "—"} · {sourceLabel(c.source)}
                </p>
                <RatingDrawer c={c} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <RatingBadge c={c} />
                <Badge variant="secondary" className="font-normal capitalize">
                  {c.status}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => review(c.id, "reviewed")}>
                  Mark reviewed
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ChoiceStep({ tx, reload, onContinue }: Props) {
  const { data: cps = [] } = useCounterparties(tx.id);
  const qc = useQueryClient();

  async function choose(id: string, name: string) {
    await supabase
      .from("counterparties")
      .update({ status: "chosen", chosen_at: new Date().toISOString() })
      .eq("id", id);
    await recordEvent({
      transactionId: tx.id,
      stage: "trading",
      step: "choice",
      action: "counterparty_chosen",
      summary: `Chose ${name}`,
      payload: { id, name },
    });
    // Choosing hands straight over to Intent sign-off — the same place the workflow screen goes.
    await advance(tx.id, "trading", "intent");
    await qc.invalidateQueries({ queryKey: ["counterparties", tx.id] });
    reload();
    onContinue?.();
    toast.success("Choice recorded — confirm the intent to continue");
  }

  const chosen = cps.find((c) => c.status === "chosen");

  return (
    <Panel
      title="Choose the counterparty"
      description="A person makes this choice. It is attributed and cannot be rewritten."
    >
      {chosen ? (
        <p className="text-sm">
          <Check className="mr-1 inline h-4 w-4 text-success" />
          {chosen.name} was chosen on {when(chosen.chosen_at)}.
        </p>
      ) : cps.length === 0 ? (
        <Empty text="No counterparties to choose from yet." />
      ) : (
        <ul className="divide-y divide-border">
          {cps.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.jurisdiction ?? "—"}</p>
              </div>
              <Button size="sm" onClick={() => choose(c.id, c.name)}>
                Choose
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}


function IntentStep({ tx, reload, onChangeParty }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Set the instant the confirm write succeeds, before `reload()`/`advance()` move the workflow
  // on — lets the certificate visibly lose its draft watermark first, rather than the whole panel
  // jumping to the next step before the user ever sees it become a real record.
  const [confirmedLocally, setConfirmedLocally] = useState(false);
  const qc = useQueryClient();
  const { profile } = useAuth();
  const signer = profile?.full_name ?? profile?.email ?? "—";

  // Every deal type carries different material terms (a services engagement has no "quantity" the
  // way a commodity trade does), so these are read off the actual record by AI rather than a fixed
  // field list that either sat blank or quietly misrepresented deals that don't fit it.
  const getMaterialTerms = useServerFn(extractMaterialTerms);
  const { data: termsData, isPending: termsPending } = useQuery({
    queryKey: ["material-terms", tx.id],
    queryFn: () => getMaterialTerms({ data: { transactionId: tx.id } }),
  });
  const materialTerms = termsData?.terms ?? [];

  // The party chosen after background screening — the intent is signed against them.
  const { data: chosenParty } = useQuery({
    queryKey: ["chosen-counterparty", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("counterparties")
        .select("id, name")
        .eq("transaction_id", tx.id)
        .eq("status", "chosen")
        .order("chosen_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { id: data.id as string, name: data.name as string } : null;
    },
  });

  async function fileIntentCertificate(confirmedAt: string) {
    const bytes = await buildBrandedCertificatePdf({
      heading: "Confirmation of Intent",
      lines: [
        ...materialTerms.map((t) => `${t.label}: ${t.value}`),
        "",
        `Counterparty: ${chosenParty?.name ?? "—"}`,
        `Signed by: ${signer}`,
        `Confirmed: ${confirmedAt}`,
      ],
    });
    const path = `deals/${tx.id}/${Date.now()}-confirmation-of-intent.pdf`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, bytes, { contentType: "application/pdf" });
    if (upErr) {
      toast.warning("Confirmed, but the certificate could not be filed against the deal.");
      return;
    }
    await supabase.from("documents").insert({
      transaction_id: tx.id,
      name: `Confirmation of Intent — ${tx.title}.pdf`,
      doc_type: "certificate",
      notes: "Certificate",
      storage_path: path,
    });
  }

  /** Files the terms that were put to the chosen counterparty alongside the other deal documents,
   * once intent against them is confirmed — the proposal they viewed before any counter offer. */
  async function fileProposal() {
    const bytes = await buildBrandedCertificatePdf({
      heading: "Proposal",
      lines: [...materialTerms.map((t) => `${t.label}: ${t.value}`), "", `Counterparty: ${chosenParty?.name ?? "—"}`],
    });
    const path = `deals/${tx.id}/${Date.now()}-proposal.pdf`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, bytes, { contentType: "application/pdf" });
    if (upErr) return;
    await supabase.from("documents").insert({
      transaction_id: tx.id,
      name: `Proposal — ${chosenParty?.name ?? tx.title}.pdf`,
      doc_type: "proposal",
      notes: "Proposal",
      storage_path: path,
    });
  }

  async function confirm() {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await supabase.from("transactions").update({ intent_confirmed_at: now }).eq("id", tx.id);
      await recordEvent({
        transactionId: tx.id,
        stage: "trading",
        step: "intent",
        action: "intent_confirmed",
        summary: `Intent to transact confirmed by ${signer}`,
        payload: {
          price: tx.price,
          quantity: tx.quantity,
          currency: tx.currency,
          counterparty: chosenParty?.name,
          signed_by: signer,
          signed_at: now,
        },

      });
      notifyAiPlus(tx.id, "intent_confirmed");
      await fileIntentCertificate(now);

      await fileProposal();
      // The certificate must show up in the deal's document list straight away, not on the next
      // refresh.
      await qc.invalidateQueries({ queryKey: ["documents", tx.id] });
      // Let the certificate visibly shed its draft watermark before moving on — advancing
      // immediately meant the panel changed before anyone actually saw it become a real record.
      setConfirmedLocally(true);
      toast.success("Intent confirmed");

      // The counterparty is emailed once intent is sealed (PoiStep's doSeal(), further down the
      // pipeline), not here — confirming intent is not yet the sealed, immutable commitment worth
      // reaching out to them on.

      await new Promise((resolve) => setTimeout(resolve, 1600));
      await advance(tx.id, "trading", "poi");
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const certificate = termsPending ? (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="mt-1.5 h-4 w-28 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  ) : (
    <CertificateBlock
      heading="Confirmation of Intent"
      lines={[
        ...materialTerms,
        { label: "Counterparty", value: chosenParty?.name ?? "—" },
        { label: "Signed by", value: signer },
      ]}
      sealId={tx.intent_confirmed_at || confirmedLocally ? shortHash(tx.id) : null}
    />
  );

  // Already confirmed: this sits inside the "Confirmed Intent" accordion, which already carries
  // the heading and its own explanatory subtext — expanding it now shows the actual certificate,
  // not just a one-line summary of what happened.
  if (tx.intent_confirmed_at) {
    return (
      <div className="text-xs leading-relaxed">
        <p className="text-muted-foreground">
          Confirmed with <span className="font-medium text-foreground">{chosenParty?.name ?? "the counterparty"}</span> —
          signed by {signer} on {when(tx.intent_confirmed_at)}.
        </p>
        <div className="mt-3">{certificate}</div>
      </div>
    );
  }

  return (
    <Panel
      description="Read the terms as they stand. Confirming does not seal them — that is the next step."

      footer={
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(Boolean(v))} />I confirm
            these terms reflect our intent
          </label>
          <div className="flex items-center gap-2">
            {onChangeParty && !tx.poi_sealed_at && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    Change Party
                  </Button>
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
                    <AlertDialogAction onClick={() => onChangeParty()}>Reopen the list</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button size="sm" onClick={confirm} disabled={!agreed || busy || Boolean(tx.intent_confirmed_at)}>
              {tx.intent_confirmed_at ? "Intent confirmed" : "Confirm Intent"}
            </Button>
          </div>
        </div>
      }
    >
      {certificate}
    </Panel>
  );
}

/** The sealed Proof of Intent, shown as a standalone document rather than folded into the step
 * panel — modelled on the paper trade-desk certificates this replaces. Auto-closes (with a fade)
 * the moment it's shown right after sealing; opened again by hand from "View certificate" it just
 * stays open until dismissed. */
function CertificateOfIntentDialog({
  open,
  closing,
  onOpenChange,
  tx,
  counterpartyName,
}: {
  open: boolean;
  closing?: boolean;
  onOpenChange: (open: boolean) => void;
  tx: Transaction;
  counterpartyName: string | null;
}) {
  const { data: evidence = [] } = useQuery({
    queryKey: ["documents", tx.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, sha256")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; name: string; sha256: string | null }[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md border-slate-200 bg-white p-0 text-slate-900 transition-opacity duration-300",
          closing ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="p-6">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
            Izenzo · Trade Desk
          </p>
          <DialogTitle className="mt-1 text-center text-xl font-bold tracking-tight text-slate-900">
            Certificate of Intent
          </DialogTitle>
          <DialogDescription className="text-center font-mono text-[11px] uppercase tracking-wide text-slate-400">
            Match · {shortHash(tx.id)} · WAD/A V1.2
          </DialogDescription>

          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Counterparty</p>
              <p className="font-semibold text-slate-900">{counterpartyName ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Commodity</p>
              <p className="font-semibold text-slate-900">{tx.commodity || tx.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Volume</p>
                <p className="font-semibold text-slate-900">
                  {tx.quantity ? `${tx.quantity} ${tx.unit ?? ""}`.trim() : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Price</p>
                <p className="font-semibold text-slate-900">{money(tx.price, tx.currency)}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Incoterms</p>
              <p className="font-semibold text-slate-900">{tx.incoterms || "—"}</p>
            </div>
          </div>

          {evidence.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Bound evidence · {evidence.length} file{evidence.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-2 space-y-1.5">
                {evidence.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-xs text-slate-700">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {(f.sha256 ?? f.id).slice(0, 8)}…
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tx.poi_hash && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Lock className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  SHA-256 hash-sealed record
                </p>
                <p className="truncate font-mono text-[11px] text-emerald-800">{tx.poi_hash}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PoiStep({ tx, reload, onChangeParty }: Props) {
  const seal = useServerFn(sealProofOfIntent);
  const notifyChosen = useServerFn(notifyChosenCounterparty);
  const navigate = useNavigate();
  const { org } = useAuth();
  const [busy, setBusy] = useState(false);
  const shortOnTokens = (org?.credits ?? 0) < POI_COST;
  const [certOpen, setCertOpen] = useState(false);
  const [certClosing, setCertClosing] = useState(false);
  const [sealedSnapshot, setSealedSnapshot] = useState<{ poi_sealed_at: string | null; poi_hash: string | null } | null>(null);

  // The id is what actually gets the counterparty emailed once intent is sealed (see doSeal()).
  const { data: chosenParty } = useQuery({
    queryKey: ["chosen-counterparty", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("counterparties")
        .select("id, name")
        .eq("transaction_id", tx.id)
        .eq("status", "chosen")
        .order("chosen_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { id: data.id as string, name: data.name as string } : null;
    },
  });
  const chosen = chosenParty?.name ?? null;

  // Screening is no longer gated here: Online Media Screening and Background Screening both run in
  // Step 1, before intent can be confirmed.



  /** The certificate's field lines — identical whether it is filed against the deal or
   * downloaded. */
  function certificateLines(sealedAt: string | null): string[] {
    return [
      `Transaction: ${tx.title}`,
      `Commodity: ${tx.commodity ?? "—"}`,
      `Quantity: ${tx.quantity ?? "—"} ${tx.unit ?? ""}`,
      `Price: ${tx.price ?? "—"} ${tx.currency}`,
      `Incoterms: ${tx.incoterms ?? "—"}`,
      `Jurisdiction: ${tx.jurisdiction ?? "—"}`,
      `Intent: ${tx.intent_confirmed_at}`,
      `Sealed: ${sealedAt}`,
    ];
  }

  async function doSeal() {
    setBusy(true);
    try {
      await seal({ data: { transactionId: tx.id } });
      notifyAiPlus(tx.id, "poi_sealed");

      // File the sealed certificate against the deal so it sits with the other attachments.

      const { data: sealedTx } = await supabase
        .from("transactions")
        .select("poi_sealed_at, poi_hash")
        .eq("id", tx.id)
        .maybeSingle();
      // tx itself won't reflect the seal until reload() runs — the certificate shown right after
      // sealing needs the just-written values, not the stale prop.
      setSealedSnapshot(sealedTx ?? null);
      const name = `Seal Intent — ${tx.title}.pdf`;
      const path = `deals/${tx.id}/${Date.now()}-proof-of-intent.pdf`;
      const bytes = await buildBrandedCertificatePdf({
        heading: "Proof of Intent",
        lines: certificateLines(sealedTx?.poi_sealed_at ?? null),
        fingerprint: sealedTx?.poi_hash ?? null,
      });
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, bytes, { contentType: "application/pdf" });
      if (!upErr) {
        await supabase.from("documents").insert({
          transaction_id: tx.id,
          name,
          doc_type: "certificate",
          notes: "Certificate",
          sha256: sealedTx?.poi_hash ?? null,
          storage_path: path,
        });
      } else {
        toast.warning("Sealed, but the certificate could not be filed against the deal.");
      }

      toast.success("Intent sealed");

      // The counterparty is only actually reached out to once intent is sealed — a confirmed
      // intent can still be walked back (a different party chosen, the seal never paid for), so
      // sealing is the point this is a real enough commitment to email them about. Best-effort
      // and never blocks the seal itself.
      if (chosenParty?.id) {
        notifyChosen({ data: { counterpartyId: chosenParty.id } })
          .then((res) => {
            if (res.method === "platform" || res.method === "web") {
              toast.success("The counterparty has been emailed about this deal.");
            } else if (res.method === "guessed") {
              toast.message(
                `No confirmed email for this counterparty — sent a best-effort outreach to ${res.guessed.length} likely address${res.guessed.length === 1 ? "" : "es"} instead. You've been emailed a copy.`,
              );
            } else if (res.method === "bidder-only") {
              toast.message("No contact details found for this counterparty — check your email, we've sent you what to do next.");
            } else if (res.reason === "email-not-connected") {
              toast.message("Sealed, but email isn't connected yet — reach out to the counterparty yourself for now.");
            }
          })
          .catch((err) => {
            toast.error(`Couldn't email the counterparty: ${(err as Error).message || "please try again shortly."}`);
          });
      }

      reload();
    } catch (err) {
      reportGateError(err, navigate, tx);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const bytes = await buildBrandedCertificatePdf({
      heading: "Proof of Intent",
      lines: certificateLines(tx.poi_sealed_at),
      fingerprint: tx.poi_hash,
    });
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `izenzo-poi-${tx.id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }


  const certTx = {
    ...tx,
    poi_sealed_at: sealedSnapshot?.poi_sealed_at ?? tx.poi_sealed_at,
    poi_hash: sealedSnapshot?.poi_hash ?? tx.poi_hash,
  };
  const certificateDialog = (
    <CertificateOfIntentDialog
      open={certOpen}
      closing={certClosing}
      onOpenChange={setCertOpen}
      tx={certTx}
      counterpartyName={chosen ?? null}
    />
  );

  if (tx.poi_sealed_at) {
    // No panel heading of its own: this sits inside the workspace's folded "Seal Intent"
    // frame, which already names it. Just the sealing line, the certificate, and its actions.
    return (
      <>
        <div className="text-xs leading-relaxed">
          <p className="text-muted-foreground">Sealed {when(tx.poi_sealed_at)}</p>
          <div className="mt-3">
            <CertificateBlock
              heading="Seal Intent"
              lines={[
                { label: "Transaction", value: tx.title },
                { label: "Quantity / Price", value: `${tx.quantity ?? "—"} ${tx.unit ?? ""} at ${tx.price ?? "—"} ${tx.currency}` },
                { label: "Sealed", value: String(tx.poi_sealed_at) },
              ]}
              sealId={tx.poi_hash ?? null}
            />
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setCertOpen(true)}>
              <FileText className="h-3.5 w-3.5" /> View certificate
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => void download()}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          </div>
        </div>
        {certificateDialog}
      </>
    );
  }


  return (
    <>
    <Panel
      // No title: the frame around this already reads "Seal Intent", and the sealing
      // sentence now sits as subtext under that heading.


      footer={
        <div className="flex items-center justify-between gap-3">
          <TokenGateFooter cost={POI_COST} />
          <div className="flex items-center gap-2">
            {onChangeParty && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    Change Party
                  </Button>
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
                    <AlertDialogAction onClick={() => onChangeParty()}>Reopen the list</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button size="sm" onClick={doSeal} disabled={busy || !tx.intent_confirmed_at || shortOnTokens}>
              {busy ? "Sealing…" : "Seal Intent"}
            </Button>
          </div>
        </div>
      }
    >
      {!tx.intent_confirmed_at ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Confirm intent first.
        </p>
      ) : shortOnTokens ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Not enough tokens — this needs {POI_COST} and the
          organisation has {org?.credits ?? 0}.
        </p>
      ) : null}
    </Panel>
    {certificateDialog}
    </>
  );
}

/* ---------- compliance ---------- */

const WAD_CHECKS = [
  { key: "kyc", label: "KYC — individuals identified" },
  { key: "kyb", label: "KYB, UBO, sanctions and PEP" },
];

const WAD_CHECK_SOURCE: Record<string, ScreeningCheck["kind"] | null> = {
  kyc: "id_document",
  kyb: "kyb",
};

const CHECK_TYPE_LABEL: Record<string, string> = {
  id_document: "Cursory KYC",
  kyb: "KYB",
  aml: "Sanctions / PEP",
};

const PRIOR_STATUS_LABEL: Record<string, string> = {
  passed: "Verified",
  failed: "Declined",
  review: "Needs review",
  in_progress: "In progress",
  pending: "Not started",
  expired: "Expired",
};

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function WadStep({ tx, reload, onContinue }: Props) {
  const complete = useServerFn(completeWad);
  const navigate = useNavigate();
  const { org, user } = useAuth();
  const shortOnTokens = (org?.credits ?? 0) < WAD_COST;
  const loadEngagement = useServerFn(getEngagement);
  // The offer has to be approved (see MutualEngagementPanel — "The Offer" section) before Without
  // a Doubt has anything to run KYC/KYB on: negotiating terms with a party you haven't committed
  // to yet isn't what WaD is for.
  const { data: engagement } = useQuery({
    queryKey: ["engagement", tx.id],
    queryFn: () => loadEngagement({ data: { transactionId: tx.id } }),
  });
  const offerApproved = engagement?.decided === "accepted";
  const loadPartyRegistration = useServerFn(getPartyRegistrationInfo);
  const { data: partyRegistration = [] } = useQuery({
    queryKey: ["party-registration", tx.id],
    queryFn: () => loadPartyRegistration({ data: { transactionId: tx.id } }),
    enabled: offerApproved,
  });
  const myRegistration = partyRegistration.find((p) => p.side === engagement?.side) ?? null;
  const otherRegistration = partyRegistration.find((p) => p.side !== engagement?.side) ?? null;
  // The real result of the two-way Didit checks — not a local checkbox — decides what happens
  // next: both sides cleared moves straight to completion, either one failing needs a person to
  // actually choose whether to continue or walk away, rather than either being decided silently.
  const diligenceFailed = (engagement?.diligence ?? []).some(
    (d) => d.kyc_state === "failed" || d.kyb_state === "failed",
  );
  const bothCleared = Boolean(engagement?.bothCleared);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [preScreenOpenOverride, setPreScreenOpenOverride] = useState<boolean | null>(null);
  const [revealCertificate, setRevealCertificate] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [skipBusy, setSkipBusy] = useState(false);
  const waiveDiligence = useServerFn(setDiligenceState);
  const { data: chosenCp } = useQuery({
    queryKey: ["chosen-counterparty-rating", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("counterparties")
        .select("id, name, rating_band, rating_override, media_flags")
        .eq("transaction_id", tx.id)
        .eq("status", "chosen")
        .maybeSingle();
      return data;
    },
  });
  const effectiveRating = chosenCp && (chosenCp.rating_override ?? chosenCp.rating_band);
  const flagged = effectiveRating === "flagged";
  const complianceFlags =
    (chosenCp?.media_flags as { compliance?: { flags?: { reason: string; url: string | null }[] } } | null)
      ?.compliance?.flags ?? [];

  // Nothing is screened again here — Step 1 already ran the background screening. This only
  // reads back what came in, so the same checks are never paid for or repeated twice.
  const { data: priorRows = [] } = useQuery({
    queryKey: ["wad-prior-screening", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("identity_verifications")
        .select("id, check_type, status, reason, completed_at, created_at, subject_user_id, subject_org_id, subject_label")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  /** Newest row per check type. */
  const priorByKind = new Map<string, (typeof priorRows)[number]>();
  for (const r of priorRows) {
    if (!priorByKind.has(r.check_type as string)) priorByKind.set(r.check_type as string, r);
  }
  const priorChecks = Array.from(priorByKind.values());

  function isMinePrior(r: (typeof priorRows)[number]): boolean {
    if (user?.id && r.subject_user_id === user.id) return true;
    if (org?.id && r.subject_org_id === org.id) return true;
    return false;
  }
  /** Same green/blue, other-party-left split as the KYC/KYB checks below — newest row per check
   * type, per distinct subject, rather than one row per check type regardless of whose it was. */
  const priorBySubject = new Map<string, (typeof priorRows)[number]>();
  for (const r of priorRows) {
    // KYB never belongs in Pre-Screening — Step 1's own background screening only ever covers
    // identity (id_document), never a full company KYB, so a kyb row here is always test/override
    // data rather than something that genuinely happened at Step 1.
    if (r.check_type === "kyb") continue;
    const key = `${r.check_type}:${r.subject_user_id ?? r.subject_org_id ?? r.subject_label ?? "unknown"}`;
    if (!priorBySubject.has(key)) priorBySubject.set(key, r);
  }
  const priorSubjectRows = Array.from(priorBySubject.values());
  const priorCheckTypes = Array.from(new Set(priorSubjectRows.map((r) => r.check_type as string)));

  // Anything already cleared in Step 1 ticks itself; everything else stays open for a person.
  useEffect(() => {
    if (priorChecks.length === 0) return;
    setChecks((prev) => {
      const next = { ...prev };
      for (const [key, kind] of Object.entries(WAD_CHECK_SOURCE)) {
        if (!kind) continue;
        if (priorByKind.get(kind)?.status === "passed") next[key] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorChecks.length, priorRows]);

  function statusFor(key: string) {
    const kind = WAD_CHECK_SOURCE[key];
    if (!kind) return null;
    const hit = priorByKind.get(kind);
    if (!hit) return null;
    const when = hit.completed_at ?? hit.created_at;
    const stamp = when ? ` (${new Date(when as string).toLocaleString()})` : "";
    if (hit.status === "passed")
      return { tone: "ok", text: `Cleared in Step 1 screening${stamp}` } as const;
    if (hit.status === "failed")
      return { tone: "warn", text: `Declined in Step 1 screening — ${hit.reason ?? "provider returned a negative result"}` } as const;
    if (hit.status === "review")
      return { tone: "warn", text: `Needs review — ${hit.reason ?? "a person must look at this result"}` } as const;
    return { tone: "muted", text: "Opened in Step 1 — no result yet" } as const;
  }

  /** The clearance certificate's field lines — identical whether filed against the deal or
   * downloaded, and hashed as plain text before being laid out as a PDF. */
  function certificateLines(clearedAt: string | null): string[] {
    return [
      `Transaction: ${tx.title}`,
      `Commodity: ${tx.commodity ?? "—"}`,
      `Quantity: ${tx.quantity ?? "—"} ${tx.unit ?? ""}`,
      `Price: ${tx.price ?? "—"} ${tx.currency}`,
      `Incoterms: ${tx.incoterms ?? "—"}`,
      `Jurisdiction: ${tx.jurisdiction ?? "—"}`,
      `Counterparty: ${chosenCp?.name ?? "—"}`,
      `Cleared: ${clearedAt}`,
      "",
      "Checks satisfied:",
      ...WAD_CHECKS.map((c) => {
        const s = statusFor(c.key);
        if (s && s.tone === "ok") return `  • ${c.label} — ${s.text}`;
        const detail = s ? `${s.text}; ` : "";
        return `  • ${c.label} — ${detail}cleared by reviewer override`;
      }),
      ...(notes ? ["", `Case notes: ${notes}`] : []),
    ];
  }

  async function fileCertificate() {
    const { data: fresh } = await supabase
      .from("transactions")
      .select("wad_completed_at")
      .eq("id", tx.id)
      .maybeSingle();
    const clearedAt = fresh?.wad_completed_at ?? new Date().toISOString();
    const lines = certificateLines(clearedAt);
    const hash = await sha256Hex(lines.join("\n"));
    const bytes = await buildBrandedCertificatePdf({
      heading: "Without a Doubt — Clearance",
      lines,
      fingerprint: hash,
    });
    const path = `deals/${tx.id}/${Date.now()}-without-a-doubt.pdf`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, bytes, { contentType: "application/pdf" });
    if (upErr) {
      toast.warning("Cleared, but the certificate could not be filed against the deal.");
      return;
    }
    await supabase.from("documents").insert({
      transaction_id: tx.id,
      name: `Without a Doubt — ${tx.title}.pdf`,
      doc_type: "certificate",
      notes: "Certificate",
      sha256: hash,
      storage_path: path,
    });
  }

  async function decide(decision: "cleared" | "referred" | "blocked", overrideChecks?: Record<string, boolean>) {
    setBusy(true);
    try {
      const effectiveChecks = overrideChecks ?? checks;
      await complete({
        data: {
          transactionId: tx.id,
          decision,
          checks: Object.fromEntries(
            WAD_CHECKS.map((c) => [c.key, { passed: Boolean(effectiveChecks[c.key]), notes }]),
          ),
        },
      });
      notifyAiPlus(tx.id, "wad_updated");
      if (decision === "cleared") await fileCertificate();
      reload();

      toast.success(
        decision === "cleared"
          ? "Both sides verified via Didit — Without a Doubt is cleared."
          : decision === "blocked"
            ? "Exited — Without a Doubt did not clear."
            : `WaD ${decision}`,
      );
    } catch (err) {
      reportGateError(err, navigate, tx);
    } finally {
      setBusy(false);
    }
  }

  // Skips KYC and KYB outright rather than waiting on either check — genuinely risky (this is the
  // one hard gate meant to catch a fraudulent or sanctioned counterparty), so it's behind its own
  // warning dialog and a mandatory written reason. Recorded exactly like any other diligence
  // override: setDiligenceState's own "waived" state writes a transaction_event with that reason,
  // so this leaves the same audit trail a real reviewer decision would.
  async function skipVerification() {
    if (skipReason.trim().length < 5) return;
    setSkipBusy(true);
    try {
      await waiveDiligence({ data: { transactionId: tx.id, check: "kyc", state: "waived", reason: skipReason.trim() } });
      await waiveDiligence({ data: { transactionId: tx.id, check: "kyb", state: "waived", reason: skipReason.trim() } });
      await decide("cleared", { kyc: true, kyb: true });
      setSkipDialogOpen(false);
      setSkipReason("");
      toast.warning("KYC/KYB skipped — recorded on the deal for audit purposes.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSkipBusy(false);
    }
  }

  // Once both sides' Didit checks have genuinely cleared, Without a Doubt completes itself —
  // there is no separate manual "Run Verification" step to fake past any more; the real result
  // is what decides it.
  const autoClearedRef = useRef(false);
  useEffect(() => {
    if (!bothCleared || tx.wad_completed_at || autoClearedRef.current || busy) return;
    autoClearedRef.current = true;
    void decide("cleared", { kyc: true, kyb: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothCleared, tx.wad_completed_at, busy]);

  // KYC/KYB success: confetti for whichever party opens this first, then both sides move straight
  // on to Legal Documents — no Continue button to wonder about.
  const [wadCelebrate, setWadCelebrate] = useState(false);
  const wadHandledRef = useRef(false);
  useEffect(() => {
    if (!tx.wad_completed_at || wadHandledRef.current) return;
    wadHandledRef.current = true;
    const key = `${tx.id}:wad`;
    if (!hasSeenOfferCelebration(key)) {
      markOfferCelebrationSeen(key);
      setWadCelebrate(true);
    }
    const t = setTimeout(() => onContinue?.(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.wad_completed_at]);
  const wadConfetti = wadCelebrate ? (
    <Confetti message="KYC and KYB passed on both sides — on to the legal documents." onDone={() => setWadCelebrate(false)} />
  ) : null;

  if (tx.wad_completed_at && revealCertificate) {
    // No outer Panel/title here — the frame this sits inside already reads "Without a Doubt", so
    // wrapping the certificate in a second "Without a Doubt" panel just nested the same heading
    // inside itself. The certificate (already filed in Bid Information, previewable and
    // downloadable from the Documents folder on the map) speaks for itself.
    return (
      <div className="space-y-3">
        {wadConfetti}
        <p className="text-xs text-muted-foreground">Cleared {when(tx.wad_completed_at)}</p>
        <CertificateBlock
          heading="Without a Doubt Clearance"
          lines={[
            { label: "Transaction", value: tx.title },
            { label: "Checks", value: "KYC · KYB · UBO · sanctions · PEP" },
            { label: "Cleared", value: String(tx.wad_completed_at) },
          ]}
          sealId={shortHash(tx.id)}
        />
      </div>
    );
  }

  const counterpartyRegistered = Boolean(tx.counterparty_org_id);

  // The Offer itself now has its own frame above this one (see live-deal-engine.tsx) — this step
  // has nothing to verify against a deal that isn't agreed yet, so it just waits.
  if (!offerApproved) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> Waiting on the counterparty to approve the offer above.
      </div>
    );
  }

  return (
    <div className="space-y-6">
    {/* The Offer frame collapses the moment it's approved — Without a Doubt is what's current
        from here on, not a boxed record of a decision that's already made. No title here — the
        outer frame this sits inside already carries the "Without a Doubt" heading, so repeating
        it as this panel's own title doubled it up. */}
    <Panel
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TokenGateFooter cost={WAD_COST} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={busy || shortOnTokens}
              onClick={() => setSkipDialogOpen(true)}
            >
              Skip Verification
            </Button>
            <Button size="sm" variant="outline" disabled={busy || shortOnTokens} onClick={() => setExitConfirmOpen(true)}>
              Exit
            </Button>
            {/* Both sides clear themselves (see the effect above), but moving on to Legal
                Agreements is still a person's own click — collapsing this frame and opening the
                next one isn't something that should happen out from under someone still reading
                the result. */}
            {tx.wad_completed_at && (
              <Button
                size="sm"
                onClick={() => {
                  setRevealCertificate(true);
                  onContinue?.();
                }}
              >
                Continue
              </Button>
            )}
            {/* Shown only once a check has actually come back unfavourable — proceeding past that
                is a person's own explicit choice, not something a passing check needs a button
                for (that clears itself, see the effect above). */}
            {diligenceFailed && (
              <Button
                size="sm"
                disabled={busy || shortOnTokens}
                onClick={() =>
                  decide("cleared", {
                    kyc: (engagement?.diligence ?? []).every((d) => d.kyc_state !== "failed"),
                    kyb: (engagement?.diligence ?? []).every((d) => d.kyb_state !== "failed"),
                  })
                }
              >
                Continue anyway
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* The outer frame this whole panel sits inside already carries the "Without a Doubt" grey
          pill heading — this copy is the next thing under it, not a second heading of its own. */}
      <p className="mb-1.5 text-xs text-muted-foreground">
        Complete your own identity (KYC) and company (KYB) verification, with both results posted
        to the deal so you each have the same independent assurance that the other party has been
        verified. “Without a Doubt” clears automatically once both parties are verified.
      </p>
      <div className="mb-4">
        <TokenGateFooter cost={WAD_COST} />
      </div>

      {!offerApproved && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Waiting on the counterparty to approve the offer above.
          Verification unlocks once they do.
        </div>
      )}
      {shortOnTokens && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Not enough tokens — this needs {WAD_COST} and the
          organisation has {org?.credits ?? 0}.
        </div>
      )}
      {offerApproved && !counterpartyRegistered && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> {chosenCp?.name ?? "The counterparty"} has not registered
          on Izenzo yet. Verification unlocks once they have.
        </div>
      )}
      {flagged && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <p>
            <strong>{chosenCp?.name}</strong> carries a Flagged counterparty rating. This requires
            admin review before WaD proceeds — the rating itself does not clear or block any
            compliance gate on its own.
          </p>
          {complianceFlags.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {complianceFlags.map((f, i) => (
                <li key={i}>
                  {f.reason}
                  {f.url && (
                    <>
                      {" "}
                      <a href={f.url} target="_blank" rel="noreferrer noopener" className="underline">
                        Source
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {diligenceFailed && !tx.wad_completed_at && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          A Didit check below did not come back favourable. Choose whether to continue anyway
          (recorded on the deal and on the clearance certificate as an override) or exit —
          nothing clears automatically while this is unresolved.
        </div>
      )}

      {/* What each side put on file at registration — same two-column, other-party-left-in-blue,
          you-right-in-green layout as the KYC/KYB checks below, so both frames read the same way.
          Never the checks themselves (that's what KYC/KYB verify) — just what each side already
          told the platform they are. */}
      {(myRegistration || otherRegistration) && (
        <div className="mb-4 rounded-lg border border-border p-3">
          <p className="label-caps font-sans">ID Number + AtA / Proof of Address</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 rounded-lg border border-[#4169e1]/25 bg-[#4169e1]/5 p-3 sm:border-r-2">
              {otherRegistration ? (
                <>
                  <Badge variant="secondary" className="bg-[#4169e1]/15 font-normal text-[#1c2f6b]">
                    {otherRegistration.fullName ?? "Counterparty"}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {otherRegistration.idNumberType === "passport" ? "Passport" : "ID"}:{" "}
                    {otherRegistration.idNumberMasked ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {otherRegistration.documentLabel}: {otherRegistration.documentName ?? "Not on file"}
                  </p>
                  {otherRegistration.identityVerified && (
                    <Badge variant="outline" className="border-success/40 bg-success/10 font-normal text-success">
                      Verified
                    </Badge>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Not on file yet for the other party.</p>
              )}
            </div>
            <div className="space-y-1.5 rounded-lg border border-emerald-600/25 bg-emerald-600/5 p-3">
              {myRegistration ? (
                <>
                  <Badge variant="secondary" className="bg-emerald-600/15 font-normal text-emerald-700">
                    You
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {myRegistration.idNumberType === "passport" ? "Passport" : "ID"}:{" "}
                    {myRegistration.idNumberMasked ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {myRegistration.documentLabel}: {myRegistration.documentName ?? "Not on file"}
                  </p>
                  {myRegistration.identityVerified && (
                    <Badge variant="outline" className="border-success/40 bg-success/10 font-normal text-success">
                      Verified
                    </Badge>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Not on file yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {priorSubjectRows.length > 0 && (() => {
        const preScreenAllPassed = priorSubjectRows.every((r) => r.status === "passed");
        const preScreenOpen = preScreenOpenOverride ?? !preScreenAllPassed;
        return (
          <div className="mb-4 rounded-lg border border-border p-3">
            <button
              type="button"
              onClick={() => setPreScreenOpenOverride(!preScreenOpen)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="flex items-center gap-2">
                <span className="label-caps font-sans">Pre-Screening</span>
                {preScreenAllPassed && (
                  <Badge variant="outline" className="border-emerald-600 bg-emerald-600 font-normal text-white">
                    Both verified
                  </Badge>
                )}
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", preScreenOpen && "rotate-180")} />
            </button>
            {preScreenOpen && (
              <>
                {/* Same green/blue, other-party-left split as the KYC/KYB checks below, one row per
                    check type per side, rather than a single flat list that didn't say whose result
                    was whose. */}
                <div className="mt-3 space-y-3">
                  {priorCheckTypes.map((type) => {
                    const rowsForType = priorSubjectRows.filter((r) => r.check_type === type);
                    const mine = rowsForType.find(isMinePrior) ?? null;
                    const others = rowsForType.filter((r) => !isMinePrior(r));
                    return (
                      <div key={type}>
                        <p className="label-caps font-sans">{CHECK_TYPE_LABEL[type] ?? type}</p>
                        <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-[#4169e1]/25 bg-[#4169e1]/5 p-2.5 sm:border-r-2">
                            {others.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No result yet for the other party.</p>
                            ) : (
                              others.map((r) => (
                                <div key={r.id} className="flex items-center justify-between gap-2">
                                  <Badge variant="secondary" className="bg-[#4169e1]/15 font-normal text-[#1c2f6b]">
                                    {r.subject_label ?? "Counterparty"}
                                  </Badge>
                                  <span
                                    className={cn(
                                      "shrink-0 text-xs",
                                      r.status === "passed"
                                        ? "text-emerald-500"
                                        : r.status === "failed" || r.status === "review"
                                          ? "text-[#F97316]"
                                          : "text-muted-foreground",
                                    )}
                                  >
                                    {PRIOR_STATUS_LABEL[r.status as string] ?? r.status}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="rounded-lg border border-emerald-600/25 bg-emerald-600/5 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="secondary" className="bg-emerald-600/15 font-normal text-emerald-700">
                                You
                              </Badge>
                              <span
                                className={cn(
                                  "shrink-0 text-xs",
                                  mine?.status === "passed"
                                    ? "text-emerald-500"
                                    : mine?.status === "failed" || mine?.status === "review"
                                      ? "text-[#F97316]"
                                      : "text-muted-foreground",
                                )}
                              >
                                {mine ? PRIOR_STATUS_LABEL[mine.status as string] ?? mine.status : "No result yet"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  These results carry through from the background screening conducted upon registration.
                </p>
              </>
            )}
          </div>
        );
      })()}

      <VerificationPanel
        bare
        hideHeader
        transactionId={tx.id}
        checks={["id_document", "kyb"]}
      />

    </Panel>

    <Dialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
      <DialogContent>
        <DialogTitle>Exit this trade?</DialogTitle>
        <DialogDescription>
          Are you sure you want to exit this trade? Without a Doubt will not clear, and this deal
          closes without proceeding — this can't be undone.
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setExitConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setExitConfirmOpen(false);
              void decide("blocked");
            }}
          >
            Exit trade
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={skipDialogOpen}
      onOpenChange={(v) => {
        setSkipDialogOpen(v);
        if (!v) setSkipReason("");
      }}
    >
      <DialogContent>
        <DialogTitle>Skip KYC and KYB?</DialogTitle>
        <DialogDescription>
          KYC and KYB verification allows the other party to independently confirm who you are and
          the company you represent. If you choose to skip verification, they will not have this
          assurance. Your decision to proceed without KYC and KYB will be recorded on this deal and
          its clearance certificate for audit purposes, together with the reason you provide below.
        </DialogDescription>
        <Textarea
          value={skipReason}
          onChange={(e) => setSkipReason(e.target.value)}
          rows={3}
          placeholder="Why are you skipping verification? (required)"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setSkipDialogOpen(false)}>
            Undo Skip
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={skipBusy || skipReason.trim().length < 5}
            onClick={() => void skipVerification()}
          >
            {skipBusy ? "Skipping…" : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}


/* ---------- execution ---------- */

const PREP_STAGES = ["Concept", "Pre-Feasibility", "Feasibility", "Bankability", "Implementation"];

/** Drag-and-drop (or browse) upload for the NDA, MOU and any other contracts a deal needs —
 * separate from the Trading Gate's own document upload, since these belong to Execution and
 * aren't part of what gets searched/matched on. Every file lands in the same `documents` table
 * (and the same "documents" storage bucket) as everything else on the deal, so it shows up
 * automatically in the Bid Information paperclip archive on the Live Workspace. */
function BusinessDocsStep({ tx, reload, onContinue }: Props) {
  const qc = useQueryClient();
  const { profile, org } = useAuth();
  const mySide: Side = org?.id === tx.org_id ? "bidder" : "counterparty";
  const attach = useServerFn(attachLegalDocument);
  const sign = useServerFn(signDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [signingId, setSigningId] = useState<string | null>(null);
  const allSignedHandled = useRef(false);

  const { data: docs = [] } = useQuery({
    queryKey: ["legal-agreements", tx.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("transaction_id", tx.id)
        .eq("notes", "Legal Agreement")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: signatures = [] } = useQuery({
    queryKey: ["legal-agreement-signatures", tx.id, docs.map((d) => d.id).join(",")],
    enabled: docs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_signatures")
        .select("document_id, signer_side, signer_name, signed_at")
        .in(
          "document_id",
          docs.map((d) => d.id),
        );
      if (error) throw error;
      return (data ?? []) as { document_id: string; signer_side: Side; signer_name: string; signed_at: string }[];
    },
  });

  const uploaderIds = Array.from(new Set(docs.map((d) => d.uploaded_by))).sort();
  const { data: uploaderNames = {} } = useQuery({
    queryKey: ["legal-agreement-uploaders", uploaderIds.join(",")],
    enabled: uploaderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", uploaderIds);
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.id] = p.full_name || p.email || "";
      return map;
    },
  });

  function pickFiles(files: FileList | File[]) {
    const list = Array.from(files);
    setPendingFiles((prev) => [...prev, ...list.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
  }

  async function addDocument() {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of pendingFiles) {
        const path = `deals/${tx.id}/business/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
        if (upErr) throw upErr;
        const sha = await fingerprintOf({ name: file.name, size: file.size, at: Date.now() });
        await attach({
          data: { transactionId: tx.id, name: file.name, storagePath: path, sha256: sha },
        });
        setPendingFiles((prev) => prev.filter((f) => f !== file));
      }
      await qc.invalidateQueries({ queryKey: ["legal-agreements", tx.id] });
      await qc.invalidateQueries({ queryKey: ["documents", tx.id] });
      reload();
      toast.success("Documents added — both parties need to sign them.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function signOne(documentId: string) {
    setSigningId(documentId);
    try {
      await sign({
        data: { documentId, transactionId: tx.id },
      });
      await qc.invalidateQueries({ queryKey: ["legal-agreement-signatures", tx.id] });
      await qc.invalidateQueries({ queryKey: ["legal-agreements", tx.id] });
      toast.success("Signed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSigningId(null);
    }
  }

  const sigsByDoc = new Map<string, typeof signatures>();
  for (const s of signatures) {
    const list = sigsByDoc.get(s.document_id) ?? [];
    list.push(s);
    sigsByDoc.set(s.document_id, list);
  }

  const allSigned = docs.length > 0 && docs.every((d) => Boolean((d as { fully_signed_at?: string | null }).fully_signed_at));

  // Once every legal agreement is signed by both parties, the deal is genuinely settled — straight
  // on to Execution's own first step (Concept). The celebration itself (confetti, Step 2 folding
  // gold, Step 3 opening) is handled one level up, in live-deal-engine.tsx: this panel and its own
  // local confetti close in the very same render that allSigned flips true, so a Confetti mounted
  // here never actually got to play.
  useEffect(() => {
    if (!allSigned || allSignedHandled.current) return;
    allSignedHandled.current = true;
    void (async () => {
      await advance(tx.id, "execution", "preparation");
      reload();
      onContinue?.();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSigned]);

  return (
    <div className="space-y-6">
      {/* No title/description here — the outer frame this sits inside already carries the
          "Legal Agreements" heading and this same copy as its subtext. */}
      <Panel>
        <div className="space-y-3">


          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length) pickFiles(e.dataTransfer.files);
            }}
            aria-label="Drop a file here or click to browse"
            className={cn(
              "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-6 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
            )}
          >
            <UploadCloud className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">
              Drop files here or click to browse
            </span>
            <span className="text-[11px] text-muted-foreground">You can add several at once.</span>
          </button>
          {pendingFiles.length > 0 && (
            <ul className="space-y-1">
              {pendingFiles.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setPendingFiles((prev) => prev.filter((x) => x !== f))}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${f.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) pickFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="flex justify-end">
            <Button size="sm" disabled={pendingFiles.length === 0 || uploading} onClick={() => void addDocument()}>
              {uploading ? "Uploading…" : pendingFiles.length > 1 ? `Upload ${pendingFiles.length} documents` : "Upload document"}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Document Register">
        {docs.length === 0 ? (
          <Empty text="No legal agreements attached yet." />
        ) : (
          <ul className="space-y-3">
            {docs.map((d) => {
              const sigs = sigsByDoc.get(d.id) ?? [];
              const bidderSig = sigs.find((s) => s.signer_side === "bidder");
              const counterpartySig = sigs.find((s) => s.signer_side === "counterparty");
              const fullySigned = Boolean((d as { fully_signed_at?: string | null }).fully_signed_at);
              const uploader =
                d.uploaded_by === profile?.id
                  ? "You"
                  : (uploaderNames[d.uploaded_by] ?? "the other party");
              return (
                <li key={d.id} className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Uploaded by {uploader} · {when(d.created_at)}
                      </p>
                    </div>
                    {fullySigned && (
                      <Badge variant="outline" className="shrink-0 border-success/40 bg-success/10 text-success">
                        signed by both
                      </Badge>
                    )}
                  </div>
                  {/* One labelled half per side, coloured to the same bidder=green /
                      counterparty=blue convention used everywhere else — the Sign action only
                      ever appears on whichever half is actually this viewer's own side. */}
                  <div className="grid grid-cols-2 divide-x divide-border text-xs">
                    {(
                      [
                        { side: "bidder" as const, sig: bidderSig, label: "Bidder", tone: "emerald" as const },
                        { side: "counterparty" as const, sig: counterpartySig, label: "Counterparty", tone: "blue" as const },
                      ]
                    ).map(({ side, sig, label, tone }) => (
                      <div
                        key={side}
                        className={cn(
                          "space-y-1.5 p-3",
                          tone === "emerald" ? "bg-emerald-600/5" : "bg-[#4169e1]/5",
                        )}
                      >
                        <p
                          className={cn(
                            "label-caps font-sans",
                            tone === "emerald" ? "text-emerald-600" : "text-[#4169e1]",
                          )}
                        >
                          {label}
                        </p>
                        {sig ? (
                          <div className="space-y-0.5">
                            <p
                              className="border-b border-foreground/40 pb-0.5 text-center text-2xl leading-tight text-foreground"
                              style={{ fontFamily: signatureFont(`${side}:${sig.signer_name}`) }}
                            >
                              {sig.signer_name}
                            </p>
                            <p className="text-center text-[11px] text-muted-foreground">
                              Digitally signed · {when(sig.signed_at)}
                            </p>
                          </div>
                        ) : mySide === side ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={signingId === d.id}
                            onClick={() => void signOne(d.id)}
                          >
                            {signingId === d.id ? "Signing…" : "Sign"}
                          </Button>
                        ) : (
                          <p className="text-muted-foreground">Not yet signed</p>
                        )}
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ExecutionStep({ tx, step, reload }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ prep_stage: PREP_STAGES[0]!, notes: "" });
  const [busy, setBusy] = useState(false);
  const genBrief = useServerFn(generateConceptBrief);
  const briefRequested = useRef(false);
  const genQuestions = useServerFn(generateConceptQuestions);
  const questionsRequested = useRef(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [savingAnswer, setSavingAnswer] = useState<number | null>(null);

  const { data: records = [] } = useQuery({
    queryKey: ["execution", tx.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execution_records")
        .select("*")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Concept is the first thing execution opens on, so its brief is generated the first time the
  // step is looked at rather than making someone ask for it. Guarded by a ref so a re-render or a
  // reload never fires a second paid call, and by the stored timestamp so it is generated once per
  // deal, not once per visit.
  useEffect(() => {
    if (step !== "preparation" || form.prep_stage !== "Concept") return;
    if (tx.concept_brief || tx.concept_brief_generated_at || briefRequested.current) return;
    briefRequested.current = true;
    void genBrief({ data: { transactionId: tx.id } })
      .then(() => reload())
      .catch(() => {
        // The reason is recorded on the deal by the server function itself — the panel below reads
        // it from there, so there is nothing to surface here.
        reload();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.prep_stage, tx.id, tx.concept_brief, tx.concept_brief_generated_at]);

  // Same one-time-per-deal pattern as the agreements brief above, for the planning questionnaire.
  useEffect(() => {
    if (step !== "preparation" || form.prep_stage !== "Concept") return;
    if (tx.concept_questions || tx.concept_questions_generated_at || questionsRequested.current) return;
    questionsRequested.current = true;
    void genQuestions({ data: { transactionId: tx.id } })
      .then(() => reload())
      .catch(() => reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.prep_stage, tx.id, tx.concept_questions, tx.concept_questions_generated_at]);

  async function saveAnswer(index: number) {
    const answer = (answerDrafts[index] ?? tx.concept_answers?.[index] ?? "").trim();
    setSavingAnswer(index);
    try {
      const next = { ...(tx.concept_answers ?? {}), [index]: answer };
      const { error } = await supabase.from("transactions").update({ concept_answers: next } as never).eq("id", tx.id);
      if (error) throw error;
      reload();
      toast.success("Saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingAnswer(null);
    }
  }

  async function record(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("execution_records").insert({
        transaction_id: tx.id,
        phase: step,
        prep_stage: step === "preparation" ? form.prep_stage : null,
        notes: form.notes || null,
      });
      if (error) throw error;
      await recordEvent({
        transactionId: tx.id,
        stage: "execution",
        step,
        action: "execution_recorded",
        summary: `${step} recorded`,
        payload: { ...form },
      });
      setForm({ ...form, notes: "" });
      await qc.invalidateQueries({ queryKey: ["execution", tx.id] });
      reload();
      toast.success("Recorded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isConceptStage = step === "preparation" && form.prep_stage === "Concept";

  return (
    <div className="space-y-6">
      {isConceptStage && (
        <Panel title="Bid / Offer summary" description="What was originally proposed, at a glance.">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {[
              ["Title", tx.title || "—"],
              ["Commodity", tx.commodity || "—"],
              ["Quantity", tx.quantity ? `${tx.quantity} ${tx.unit ?? ""}`.trim() : "—"],
              ["Price", tx.price ? money(tx.price, tx.currency) : "—"],
              ["Incoterms", tx.incoterms || "—"],
              ["Jurisdiction", tx.jurisdiction || "—"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 truncate font-medium" title={value}>{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      {isConceptStage && (
        <Panel
          title="Concept questionnaire"
          description="A handful of planning questions tailored to this deal — answer what's useful now; you can come back and add more later."
        >
          {tx.concept_questions && tx.concept_questions.length > 0 ? (
            <ul className="space-y-4">
              {tx.concept_questions.map((question, i) => {
                const saved = tx.concept_answers?.[i] ?? "";
                const draft = answerDrafts[i] ?? saved;
                const changed = draft !== saved;
                return (
                  <li key={i} className="space-y-1.5">
                    <p className="text-sm font-medium">{question}</p>
                    <Textarea
                      rows={2}
                      value={draft}
                      onChange={(e) => setAnswerDrafts((d) => ({ ...d, [i]: e.target.value }))}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!changed || savingAnswer === i}
                        onClick={() => void saveAnswer(i)}
                      >
                        {savingAnswer === i ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : tx.concept_questions_error ? (
            <p className="text-xs text-muted-foreground">{userFacingText(tx.concept_questions_error)}</p>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Tailoring questions to this deal…
            </p>
          )}
        </Panel>
      )}

      {/* Concept also shows the AI's reading of the signed agreements, so both parties start from
          the same understanding of what each is expected to do, the terms and the dates. Advisory
          only — the agreements themselves remain the authority. */}
      {isConceptStage && (
        <Panel
          title="What the agreements say"
          description="The AI's interpretation of the signed legal agreements — what each party is expected to do, the terms, and the dates. Read it against the agreements themselves; it is a reading, not advice."
        >
          {tx.concept_brief ? (
            <>
              <DocumentSummaryList summary={tx.concept_brief} />
              {tx.concept_brief_generated_at && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Read from the agreements {when(tx.concept_brief_generated_at)}
                </p>
              )}
            </>
          ) : tx.concept_brief_error ? (
            <p className="text-xs text-muted-foreground">{userFacingText(tx.concept_brief_error)}</p>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the agreements…
            </p>
          )}
          <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-3">
            <p className="text-[11px] text-muted-foreground">
              Phase 1 ends here — Execution continues in Phase 2.
            </p>
            <Button size="sm" disabled>
              Continue
            </Button>
          </div>
        </Panel>
      )}

      {!isConceptStage && (
      <Panel
        title="Record this step"
        footer={
          <div className="text-right">
            <Button size="sm" form="exec-form" type="submit" disabled={busy}>
              Record
            </Button>
          </div>
        }
      >
        <form id="exec-form" onSubmit={record} className="space-y-4">
          {step === "preparation" && (
            <Field label="Preparation stage">
              <Select
                value={form.prep_stage}
                onValueChange={(v) => setForm({ ...form, prep_stage: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREP_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Notes">
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </form>
      </Panel>
      )}

      <Panel title="Execution record">
        {records.length === 0 ? (
          <Empty text="Nothing recorded yet." />
        ) : (
          <ul className="divide-y divide-border">
            {records.map((r) => (
              <li key={r.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">
                    {r.phase}
                    {r.prep_stage ? ` · ${r.prep_stage}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{when(r.created_at)}</span>
                </div>
                {r.notes && <p className="mt-1 text-muted-foreground">{r.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function StakeholderStep({ tx, reload }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ event_type: "entry", party_name: "", role: "", notes: "" });

  const { data: events = [] } = useQuery({
    queryKey: ["stakeholders", tx.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stakeholder_events")
        .select("*")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { error } = await supabase.from("stakeholder_events").insert({
        transaction_id: tx.id,
        event_type: form.event_type,
        party_name: form.party_name,
        role: form.role || null,
        notes: form.notes || null,
      });
      if (error) throw error;
      await recordEvent({
        transactionId: tx.id,
        stage: "execution",
        step: "stakeholders",
        action: `stakeholder_${form.event_type}`,
        summary: `${form.party_name} ${form.event_type === "entry" ? "entered" : "exited"}`,
        payload: { ...form },
      });
      setForm({ event_type: "entry", party_name: "", role: "", notes: "" });
      await qc.invalidateQueries({ queryKey: ["stakeholders", tx.id] });
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Stakeholder entry or exit"
        footer={
          <div className="text-right">
            <Button size="sm" form="stake-form" type="submit">
              Record
            </Button>
          </div>
        }
      >
        <form id="stake-form" onSubmit={add} className="grid gap-4 sm:grid-cols-2">
          <Field label="Event">
            <Select
              value={form.event_type}
              onValueChange={(v) => setForm({ ...form, event_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">Entry</SelectItem>
                <SelectItem value="exit">Exit</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Party">
            <Input
              required
              value={form.party_name}
              onChange={(e) => setForm({ ...form, party_name: e.target.value })}
            />
          </Field>
          <Field label="Role">
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </form>
      </Panel>

      <Panel title="Stakeholders">
        {events.length === 0 ? (
          <Empty text="No stakeholder movements recorded." />
        ) : (
          <ul className="divide-y divide-border">
            {events.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <Badge variant="secondary" className="mr-2 font-normal capitalize">
                    {s.event_type}
                  </Badge>
                  {s.party_name} {s.role ? `· ${s.role}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">{when(s.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ---------- finality ---------- */

const FINALITY_FIELD: Record<string, { field: string; label: string; options?: string[] }> = {
  type: { field: "finality_type", label: "Finality type", options: ["Completion", "Termination", "Novation", "Lapse"] },
  evidence: { field: "evidence", label: "Evidence" },
  change: { field: "change_event", label: "Change or value event" },
  validation: { field: "validation", label: "Validation and acceptance" },
};

function FinalityStep({ tx, step, reload }: Props) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: record } = useQuery({
    queryKey: ["finality", tx.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finality_records")
        .select("*")
        .eq("transaction_id", tx.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function ensureRecord() {
    if (record) return record;
    const { data, error } = await supabase
      .from("finality_records")
      .insert({ transaction_id: tx.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function save() {
    setBusy(true);
    try {
      const rec = await ensureRecord();
      if (step === "entry") {
        await recordEvent({
          transactionId: tx.id,
          stage: "finality",
          step,
          action: "finality_opened",
          summary: "Finality opened",
        });
      } else if (step === "record") {
        const hash = await fingerprintOf({ tx: tx.id, rec, at: Date.now() });
        const now = new Date().toISOString();
        await supabase
          .from("finality_records")
          .update({ status: "sealed", hash, sealed_at: now })
          .eq("id", rec.id);
        await supabase
          .from("transactions")
          .update({ finality_sealed_at: now, status: "final", stage: "memory", step: "ledger" })
          .eq("id", tx.id);
        await recordEvent({
          transactionId: tx.id,
          stage: "finality",
          step,
          action: "finality_sealed",
          summary: "Finality record sealed",
          payload: { hash },
        });
        notifyAiPlus(tx.id, "finality_recorded");
      } else {

        const cfg = FINALITY_FIELD[step]!;
        await supabase
          .from("finality_records")
          .update({ [cfg.field]: value } as never)
          .eq("id", rec.id);
        await recordEvent({
          transactionId: tx.id,
          stage: "finality",
          step,
          action: "finality_updated",
          summary: `${cfg.label} recorded`,
          payload: { [cfg.field]: value },
        });
      }
      await qc.invalidateQueries({ queryKey: ["finality", tx.id] });
      reload();
      toast.success("Recorded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "record") {
    return (
      <Panel
        title="Finality record"
        description="Sealing finality closes the transaction and opens the memory ledger."
        footer={
          <div className="text-right">
            <Button size="sm" onClick={save} disabled={busy || Boolean(tx.finality_sealed_at)}>
              {tx.finality_sealed_at ? "Sealed" : "Seal finality"}
            </Button>
          </div>
        }
      >
        {record ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="label-caps">Type</dt>
              <dd>{record.finality_type ?? "—"}</dd>
            </div>
            <div>
              <dt className="label-caps">Status</dt>
              <dd className="capitalize">{record.status}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="label-caps">Evidence</dt>
              <dd>{record.evidence ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="label-caps">Change or value event</dt>
              <dd>{record.change_event ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="label-caps">Validation</dt>
              <dd>{record.validation ?? "—"}</dd>
            </div>
            {record.hash && (
              <div className="sm:col-span-2">
                <dt className="label-caps">Fingerprint</dt>
                <dd className="seal-block mt-1">{record.hash}</dd>
              </div>
            )}
          </dl>
        ) : (
          <Empty text="Nothing recorded for finality yet." />
        )}
      </Panel>
    );
  }

  if (step === "entry") {
    return (
      <Panel
        title="Open finality"
        footer={
          <div className="text-right">
            <Button size="sm" onClick={save} disabled={busy}>
              Open finality
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Opening finality begins the closing record for this transaction.
        </p>
      </Panel>
    );
  }

  const cfg = FINALITY_FIELD[step];
  if (!cfg) return <Empty text="Nothing to record here." />;

  return (
    <Panel
      title={cfg.label}
      footer={
        <div className="text-right">
          <Button size="sm" onClick={save} disabled={busy || !value}>
            Record
          </Button>
        </div>
      }
    >
      {cfg.options ? (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {cfg.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Textarea rows={4} value={value} onChange={(e) => setValue(e.target.value)} />
      )}
    </Panel>
  );
}

/* ---------- memory ---------- */

function MemoryLedger({ tx }: Props) {
  const [reverse, setReverse] = useState(false);
  const { data: events = [] } = useQuery({
    queryKey: ["events", tx.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_events")
        .select("*")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TxEvent[];
    },
  });

  const ordered = reverse ? [...events].reverse() : events;

  return (
    <Panel
      title="Memory ledger"
      description={
        tx.finality_sealed_at
          ? `Sealed ${when(tx.finality_sealed_at)}. Read it either way.`
          : "Read the transaction forward, or backward from where it stands."
      }
      footer={
        <div className="text-right">
          <Button size="sm" variant="outline" onClick={() => setReverse((r) => !r)}>
            Read {reverse ? "forward" : "backward"}
          </Button>
        </div>
      }
    >
      {ordered.length === 0 ? (
        <Empty text="Nothing has been written yet." />
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-5">
          {ordered.map((e) => (
            <li key={e.id}>
              <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-border" />
              <p className="text-sm font-medium">{e.summary ?? e.action}</p>
              <p className="text-xs text-muted-foreground">
                {e.stage} · {e.step} · {e.actor_name ?? "—"} · {when(e.created_at)}
              </p>
              {e.fingerprint && (
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {shortHash(e.fingerprint)}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/** Ten script styles; the bidder draws from the even slots and the counterparty from the odd
 * ones, so the two parties never share a style. Chosen automatically from the signer's name. */
const SIGNATURE_FONTS = [
  "Great Vibes", "Caveat", "Dancing Script", "Alex Brush", "Sacramento",
  "Allura", "Pacifico", "Cedarville Cursive", "Marck Script", "Parisienne",
];
function signatureFont(key: string) {
  const [side, ...rest] = key.split(":");
  let h = 0;
  for (const c of rest.join(":")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const idx = (h % 5) * 2 + (side === "counterparty" ? 1 : 0);
  return `"${SIGNATURE_FONTS[idx]}", cursive`;
}
