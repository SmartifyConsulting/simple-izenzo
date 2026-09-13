import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Coins, Download, Loader2, Sparkles, Lock } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { sealProofOfIntent, completeWad, runAiProposal, searchCounterparties } from "@/lib/izenzo.functions";
import { runBackgroundScreening, type ScreeningCheck } from "@/lib/screening.functions";
import { listIntentMessages, postIntentMessage } from "@/lib/intentChallenge.functions";
import { advance, fingerprintOf, money, recordEvent, shortHash, when, type Transaction, type TxEvent } from "@/lib/tx";
import { POI_COST, WAD_COST, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { routeIdentityVerification } from "@/lib/identityRouting";
import { VerificationPanel } from "@/components/verification/VerificationPanel";
import { AvatarWithPresence } from "@/components/PresenceDot";
import { CommoditySearch } from "@/components/CommoditySearch";
import { COUNTRIES } from "@/lib/countries";
import { UNITS } from "@/lib/units";

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
};

/* ---------- shared bits ---------- */

function Panel({
  title,
  description,
  children,
  footer,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "light" forces a white card with black text — used for Confirm Intent, which reads like a
   * document that's about to be signed rather than another in-app step panel. */
  tone?: "default" | "light";
}) {
  const light = tone === "light";
  return (
    // Typography matches the Bid Information frame on the Live Workspace: a small-caps section
    // label, small body copy, and compact list text — so Proof of Intent and every frame after it
    // read at the same size rather than a step larger.
    <div className={cn("rounded-md border", light ? "border-slate-200 bg-white text-slate-900" : "border-border")}>
      <div className={cn("border-b px-4 py-3", light ? "border-slate-200" : "border-border")}>
        {/* Same heading treatment as the Bid Registration frame: small caps, muted. */}
        {/* font-sans is explicit: headings otherwise inherit the display face, which made this
            read in a different font from the LIVE WORKSPACE / BID INFORMATION labels. */}
        <h2 className={cn("label-caps font-sans", light ? "text-slate-900" : "text-muted-foreground")}>
          {title}
        </h2>
        {description && (
          <p className={cn("mt-1 text-xs", light ? "text-slate-500" : "text-muted-foreground")}>{description}</p>
        )}
      </div>
      <div className="p-4 text-xs leading-relaxed">{children}</div>
      {footer && (
        <div className={cn("border-t px-4 py-3 text-xs", light ? "border-slate-200" : "border-border")}>{footer}</div>
      )}
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
        description="AI and AI+ scan for organisations matching this bid's commodity, price, incoterms and jurisdiction, as soon as this step opens. What was searched is part of the record."
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
                      {c.source ?? "manual"}
                    </Badge>
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[c.jurisdiction, c.sector].filter(Boolean).join(" · ")}
                </p>
                {c.rationale && <p className="mt-1 text-xs text-muted-foreground">{c.rationale}</p>}
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
        .eq("kind", kind)
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
        <p>Source: {c.source ?? "—"}</p>
        {c.rationale && <p>Rationale: {c.rationale}</p>}
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
                  {c.jurisdiction ?? "—"} · surfaced by {c.source ?? "search"}
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

function ChoiceStep({ tx, reload }: Props) {
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

/** Opens the intent-challenge thread dialog. Shown next to Confirm Intent so either side can raise
 * a question or objection on the terms before the bidder locks them in. */
function IntentChallengeButton({ tx }: { tx: Transaction }) {
  const [open, setOpen] = useState(false);
  const listIntentMessagesFn = useServerFn(listIntentMessages);
  const { data: messages = [] } = useQuery({
    queryKey: ["intent-messages", tx.id],
    queryFn: () => listIntentMessagesFn({ data: { transactionId: tx.id } }),
    refetchInterval: 8000,
  });
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} disabled={Boolean(tx.intent_confirmed_at)}>
        Challenge{messages.length > 0 ? ` (${messages.length})` : ""}
      </Button>
      <IntentChallengeDialog tx={tx} open={open} onOpenChange={setOpen} />
    </>
  );
}

function IntentChallengeDialog({
  tx,
  open,
  onOpenChange,
}: {
  tx: Transaction;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listIntentMessages);
  const postFn = useServerFn(postIntentMessage);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: messages = [] } = useQuery({
    queryKey: ["intent-messages", tx.id],
    enabled: open,
    refetchInterval: open ? 5000 : false,
    queryFn: () => listFn({ data: { transactionId: tx.id } }),
  });

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await postFn({ data: { transactionId: tx.id, body: body.trim() } });
      setBody("");
      void qc.invalidateQueries({ queryKey: ["intent-messages", tx.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Challenge on this deal's terms</DialogTitle>
        <DialogDescription>
          Goes back and forth between the bidder and the chosen counterparty, and is kept in this
          deal's Logs. Closes once intent is confirmed.
        </DialogDescription>
        <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-border p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing raised yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex items-start gap-2">
                <AvatarWithPresence
                  name={m.sender_name ?? "Someone"}
                  lastAccessedAt={m.sender_last_accessed_at}
                  size={24}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    {m.sender_name ?? "Someone"}{" "}
                    <span className="font-normal text-muted-foreground">{when(m.created_at)}</span>
                  </p>
                  <p className="text-sm">{m.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
        {!tx.intent_confirmed_at ? (
          <div className="flex items-end gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Raise a question or objection on the terms…"
              className="min-h-16"
            />
            <Button size="sm" onClick={send} disabled={busy || !body.trim()}>
              Send
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Intent is confirmed — this thread is closed.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IntentStep({ tx, reload }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const { profile } = useAuth();
  const signer = profile?.full_name ?? profile?.email ?? "—";

  // The party chosen after background screening — the intent is signed against them.
  const { data: chosen } = useQuery({
    queryKey: ["chosen-counterparty", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("counterparties")
        .select("name")
        .eq("transaction_id", tx.id)
        .eq("status", "chosen")
        .order("chosen_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.name ?? null;
    },
  });

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
          counterparty: chosen,
          signed_by: signer,
          signed_at: now,
        },

      });
      await advance(tx.id, "trading", "poi");
      reload();
      toast.success("Intent confirmed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Confirm intent"
      description="Read the terms as they stand. Confirming does not seal them — that is the next step."
      tone="light"
      footer={
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-900">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(Boolean(v))} />I confirm
            these terms reflect our intent
          </label>
          <div className="flex items-center gap-2">
            <IntentChallengeButton tx={tx} />
            <Button size="sm" onClick={confirm} disabled={!agreed || busy || Boolean(tx.intent_confirmed_at)}>
              {tx.intent_confirmed_at ? "Intent confirmed" : "Confirm intent"}
            </Button>
          </div>
        </div>
      }
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Transaction</dt>
          <dd className="text-slate-900">{tx.title}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Commodity</dt>
          <dd className="text-slate-900">{tx.commodity ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Quantity</dt>
          <dd className="text-slate-900">
            {tx.quantity ?? "—"} {tx.unit ?? ""}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Price</dt>
          <dd className="text-slate-900">{money(tx.price, tx.currency)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Incoterms</dt>
          <dd className="text-slate-900">{tx.incoterms ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Jurisdiction</dt>
          <dd className="text-slate-900">{tx.jurisdiction ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Counterparty</dt>
          <dd className="text-slate-900">{chosen ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Signed by</dt>
          <dd className="text-slate-900">{signer}</dd>
        </div>
      </dl>
      {tx.intent_confirmed_at && (
        <p className="mt-4 text-xs text-slate-500">
          Signed by {signer} · {when(tx.intent_confirmed_at)}
        </p>
      )}

    </Panel>
  );
}

function PoiStep({ tx, reload }: Props) {
  const seal = useServerFn(sealProofOfIntent);
  const navigate = useNavigate();
  const { org } = useAuth();
  const [busy, setBusy] = useState(false);
  const shortOnTokens = (org?.credits ?? 0) < POI_COST;

  // Screening is no longer gated here: Online Media Screening and Background Screening both run in
  // Step 1, before intent can be confirmed.



  /** The certificate text — identical whether it is filed against the deal or downloaded. */
  function certificateBody(sealedAt: string | null, hash: string | null) {
    return [
      "IZENZO — PROOF OF INTENT",
      "",
      `Transaction: ${tx.title}`,
      `Commodity:   ${tx.commodity ?? "—"}`,
      `Quantity:    ${tx.quantity ?? "—"} ${tx.unit ?? ""}`,
      `Price:       ${tx.price ?? "—"} ${tx.currency}`,
      `Incoterms:   ${tx.incoterms ?? "—"}`,
      `Jurisdiction:${tx.jurisdiction ?? "—"}`,
      `Intent:      ${tx.intent_confirmed_at}`,
      `Sealed:      ${sealedAt}`,
      "",
      `Fingerprint: ${hash}`,
    ].join("\n");
  }

  async function doSeal() {
    setBusy(true);
    try {
      await seal({ data: { transactionId: tx.id } });

      // File the sealed certificate against the deal so it sits with the other attachments.
      const { data: sealedTx } = await supabase
        .from("transactions")
        .select("poi_sealed_at, poi_hash")
        .eq("id", tx.id)
        .maybeSingle();
      const name = `Proof of Intent — ${tx.title}.txt`;
      const path = `deals/${tx.id}/${Date.now()}-proof-of-intent.txt`;
      const body = certificateBody(sealedTx?.poi_sealed_at ?? null, sealedTx?.poi_hash ?? null);
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, new Blob([body], { type: "text/plain" }));
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

      reload();
      toast.success("Proof of Intent sealed");
    } catch (err) {
      reportGateError(err, navigate, tx);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const body = certificateBody(tx.poi_sealed_at, tx.poi_hash);
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `izenzo-poi-${tx.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }


  if (tx.poi_sealed_at) {
    return (
      <Panel
        title="Proof of Intent — sealed"
        description={`Sealed ${when(tx.poi_sealed_at)}`}
        footer={
          <div className="text-right">
            <Button size="sm" variant="outline" className="gap-2" onClick={download}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          </div>
        }
      >
        <div className="seal-block">
          IZENZO PROOF OF INTENT
          <br />
          {tx.title}
          <br />
          {tx.quantity ?? "—"} {tx.unit ?? ""} at {tx.price ?? "—"} {tx.currency}
          <br />
          sealed {tx.poi_sealed_at}
          <br />
          sha256 {tx.poi_hash}
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Seal the Proof of Intent"
      description={`This is a hard gate. It costs ${POI_COST} token (USD 10) and cannot be undone.`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <TokenGateFooter cost={POI_COST} />
          <Button size="sm" onClick={doSeal} disabled={busy || !tx.intent_confirmed_at || shortOnTokens}>
            {busy ? "Sealing…" : "Seal Proof of Intent"}
          </Button>
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
      ) : (
        <p className="text-sm text-muted-foreground">
          Sealing writes the transaction state to an immutable record with a fingerprint. Compliance,
          execution, finality and memory stay locked until it exists.
        </p>
      )}
    </Panel>
  );
}

/* ---------- compliance ---------- */

const WAD_CHECKS = [
  { key: "kyc", label: "KYC — individuals identified" },
  { key: "kyb", label: "KYB — entity verified" },
  { key: "ubo", label: "UBO — beneficial owners established" },
  { key: "sanctions", label: "Sanctions screening clear" },
  { key: "pep", label: "PEP screening reviewed" },
  { key: "authority", label: "Authority to act confirmed" },
];

/** Providers wired in the WaD checks above are not yet live integrations. Per the stub-provider
 * labelling rules, they must never appear to client-facing users, never claim a real result, and
 * any "run" is an admin/dev Test-Mode simulation only, audited as stub_not_live. */
const STUB_PROVIDERS = [
  { name: "CIPC", feeds: "kyb", note: "Company registry lookup" },
  { name: "Onfido", feeds: "kyc", note: "Identity verification" },
  { name: "Dow Jones", feeds: "sanctions", note: "Sanctions & adverse media" },
  { name: "Refinitiv", feeds: "pep", note: "PEP screening" },
];

function StubProviderPanel({ tx }: { tx: Transaction }) {
  const { roles } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  if (!roles.includes("admin")) return null;

  async function simulate(provider: string) {
    setBusy(provider);
    try {
      await recordEvent({
        transactionId: tx.id,
        stage: "compliance",
        step: "wad",
        action: "stub_provider_simulated",
        summary: `${provider} — stub_not_live`,
        payload: { provider, status: "stub_not_live" },
      });
      setResults((r) => ({ ...r, [provider]: "stub_not_live" }));
      toast.success(`${provider}: stub_not_live (test mode, audited)`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 rounded-md border border-dashed border-border bg-muted/30 p-4">
      <p className="label-caps text-warning">Admin / developer only</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Not live yet — no external provider check is performed.
      </p>
      <ul className="mt-3 space-y-2">
        {STUB_PROVIDERS.map((p) => (
          <li key={p.name} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{p.name}</span> — {p.note}
              {results[p.name] && (
                <Badge variant="secondary" className="ml-2 font-normal">
                  {results[p.name]}
                </Badge>
              )}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy === p.name}
              onClick={() => simulate(p.name)}
            >
              Simulate (Test Mode)
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Which provider check satisfies each WaD item. UBO and Authority have no provider behind
 * them, so they stay manual confirmations rather than pretending to a screened result. */
const WAD_CHECK_SOURCE: Record<string, ScreeningCheck["kind"] | null> = {
  kyc: "id_document",
  kyb: "kyb",
  ubo: null,
  sanctions: "aml",
  pep: "aml",
  authority: null,
};

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function WadStep({ tx, reload }: Props) {
  const complete = useServerFn(completeWad);
  const runScreening = useServerFn(runBackgroundScreening);
  const navigate = useNavigate();
  const { org } = useAuth();
  const shortOnTokens = (org?.credits ?? 0) < WAD_COST;
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [screening, setScreening] = useState(false);
  const [screened, setScreened] = useState<ScreeningCheck[] | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const { data: chosenCp } = useQuery({
    queryKey: ["chosen-counterparty-rating", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("counterparties")
        .select("id, name, rating_band, rating_override")
        .eq("transaction_id", tx.id)
        .eq("status", "chosen")
        .maybeSingle();
      return data;
    },
  });
  const flagged = chosenCp && (chosenCp.rating_override ?? chosenCp.rating_band) === "flagged";

  // Screening runs on its own as soon as the gate opens, against the counterparty that was
  // chosen. Nothing about the gate, its cost or its decision changes — this only fills in what
  // the providers already know.
  useEffect(() => {
    if (tx.wad_completed_at || !chosenCp?.id || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      setScreening(true);
      setScreenError(null);
      try {
        const results = await runScreening({
          data: {
            transactionId: tx.id,
            counterpartyIds: [chosenCp.id as string],
            ...(typeof window !== "undefined" ? { origin: window.location.origin } : {}),
          },
        });
        const found = results[0]?.checks ?? [];
        setScreened(found);
        // Anything that came back clear ticks itself; anything else stays open.
        setChecks((prev) => {
          const next = { ...prev };
          for (const [key, kind] of Object.entries(WAD_CHECK_SOURCE)) {
            if (!kind) continue;
            const hit = found.find((c) => c.kind === kind);
            if (hit?.status === "matched") next[key] = true;
          }
          // KYB only ticks itself when the company register also confirms the entity.
          const registry = found.find((c) => c.kind === "registry");
          if (registry?.status !== "matched") next["kyb"] = false;
          return next;
        });
      } catch (err) {
        setScreenError((err as Error).message);
      } finally {
        setScreening(false);
      }
    })();
  }, [tx.id, tx.wad_completed_at, chosenCp?.id, runScreening]);

  const settled = (screened ?? []).filter((c) =>
    ["matched", "no_match", "unavailable", "failed"].includes(c.status),
  ).length;
  const totalChecks = 4;

  function statusFor(key: string) {
    const kind = WAD_CHECK_SOURCE[key];
    if (!kind) return null;
    if (screening && !screened) return { tone: "muted", text: "Screening…" } as const;
    const hit = (screened ?? []).find((c) => c.kind === kind);
    if (!hit) return null;
    if (hit.status === "matched") return { tone: "ok", text: `Matched — ${hit.detail}` } as const;
    if (hit.status === "started") return { tone: "muted", text: `Screening — ${hit.detail}` } as const;
    if (hit.status === "unavailable") return { tone: "warn", text: `Could not run — ${hit.detail}` } as const;
    return { tone: "warn", text: `Needs review — ${hit.detail}` } as const;
  }

  const allChecked = WAD_CHECKS.every((c) => checks[c.key]);

  /** The clearance certificate text — identical whether filed against the deal or downloaded. */
  function certificateBody(clearedAt: string | null, hash: string | null) {
    return [
      "IZENZO — WITHOUT A DOUBT CLEARANCE",
      "",
      `Transaction:  ${tx.title}`,
      `Commodity:    ${tx.commodity ?? "—"}`,
      `Quantity:     ${tx.quantity ?? "—"} ${tx.unit ?? ""}`,
      `Price:        ${tx.price ?? "—"} ${tx.currency}`,
      `Incoterms:    ${tx.incoterms ?? "—"}`,
      `Jurisdiction: ${tx.jurisdiction ?? "—"}`,
      `Counterparty: ${chosenCp?.name ?? "—"}`,
      `Cleared:      ${clearedAt}`,
      "",
      "Checks satisfied:",
      ...WAD_CHECKS.map((c) => {
        const s = statusFor(c.key);
        return `  • ${c.label} — ${s?.text ?? "Confirmed by the compliance reviewer"}`;
      }),
      "",
      notes ? `Case notes: ${notes}` : "",
      `Fingerprint: ${hash ?? "—"}`,
    ]
      .filter((l) => l !== "")
      .join("\n");
  }

  async function fileCertificate() {
    const { data: fresh } = await supabase
      .from("transactions")
      .select("wad_completed_at")
      .eq("id", tx.id)
      .maybeSingle();
    const clearedAt = fresh?.wad_completed_at ?? new Date().toISOString();
    const unhashed = certificateBody(clearedAt, null);
    const hash = await sha256Hex(unhashed);
    const body = certificateBody(clearedAt, hash);
    const path = `deals/${tx.id}/${Date.now()}-without-a-doubt.txt`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, new Blob([body], { type: "text/plain" }));
    if (upErr) {
      toast.warning("Cleared, but the certificate could not be filed against the deal.");
      return;
    }
    await supabase.from("documents").insert({
      transaction_id: tx.id,
      name: `Without a Doubt — ${tx.title}.txt`,
      doc_type: "certificate",
      notes: "Certificate",
      sha256: hash,
      storage_path: path,
    });
  }

  async function downloadCleared() {
    const { data: doc } = await supabase
      .from("documents")
      .select("storage_path, name")
      .eq("transaction_id", tx.id)
      .eq("doc_type", "certificate")
      .ilike("name", "Without a Doubt%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!doc?.storage_path) {
      toast.error("The clearance certificate is not on file for this deal.");
      return;
    }
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 120, { download: doc.name });
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  }

  async function decide(decision: "cleared" | "referred" | "blocked") {
    setBusy(true);
    try {
      await complete({
        data: {
          transactionId: tx.id,
          decision,
          checks: Object.fromEntries(
            WAD_CHECKS.map((c) => [c.key, { passed: Boolean(checks[c.key]), notes }]),
          ),
        },
      });
      if (decision === "cleared") await fileCertificate();
      reload();
      toast.success(`WaD ${decision}`);
    } catch (err) {
      reportGateError(err, navigate, tx);
    } finally {
      setBusy(false);
    }
  }

  if (tx.wad_completed_at) {
    return (
      <Panel
        title="WaD — cleared"
        description={`Cleared ${when(tx.wad_completed_at)}`}
        footer={
          <div className="text-right">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => void downloadCleared()}>
              <Download className="h-3.5 w-3.5" /> Download certificate
            </Button>
          </div>
        }
      >
        <div className="seal-block">
          IZENZO WITHOUT A DOUBT CLEARANCE
          <br />
          {tx.title}
          <br />
          KYC · KYB · UBO · sanctions · PEP · authority to act
          <br />
          cleared {tx.wad_completed_at}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Without a Doubt has cleared. Execution is open.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Without a Doubt"
      description={`KYC, KYB, UBO, sanctions and PEP. Costs ${WAD_COST} tokens (USD 30) on decision.`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TokenGateFooter cost={WAD_COST} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" disabled={busy || shortOnTokens} onClick={() => decide("referred")}>
              Refer
            </Button>
            <Button size="sm" variant="outline" disabled={busy || shortOnTokens} onClick={() => decide("blocked")}>
              Block
            </Button>
            <Button size="sm" disabled={busy || !allChecked || shortOnTokens} onClick={() => decide("cleared")}>
              Clear WaD
            </Button>
          </div>
        </div>
      }
    >
      {shortOnTokens && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Not enough tokens — this needs {WAD_COST} and the
          organisation has {org?.credits ?? 0}.
        </div>
      )}
      {flagged && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <strong>{chosenCp?.name}</strong> carries a Flagged counterparty rating. This requires
          admin review before WaD proceeds — the rating itself does not clear or block any
          compliance gate on its own.
        </div>
      )}

      {(screening || screened || screenError) && (
        <div className="mb-4 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                screenError ? "w-full bg-destructive" : screening ? "w-1/2 animate-ribbon-sweep bg-primary" : "bg-emerald-500",
              )}
              style={!screening && !screenError ? { width: `${Math.round((settled / totalChecks) * 100)}%` } : undefined}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {screenError
              ? `Screening could not finish: ${screenError}`
              : screening
                ? `Screening ${chosenCp?.name ?? "the counterparty"}…`
                : `${settled} of ${totalChecks} checks returned`}
          </p>
        </div>
      )}

      <ul className="space-y-2.5">
        {WAD_CHECKS.map((c) => {
          const route = c.key === "kyc" ? routeIdentityVerification(tx.jurisdiction) : null;
          const status = statusFor(c.key);
          return (
            <li key={c.key} className="text-sm">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  checked={Boolean(checks[c.key])}
                  onCheckedChange={(v) => setChecks({ ...checks, [c.key]: Boolean(v) })}
                />
                {c.label}
                {!WAD_CHECK_SOURCE[c.key] && (
                  <Badge variant="secondary" className="font-normal">
                    manual
                  </Badge>
                )}
              </div>
              {status && (
                <p
                  className={cn(
                    "ml-6 mt-1 whitespace-pre-line text-xs",
                    status.tone === "ok"
                      ? "text-emerald-500"
                      : status.tone === "warn"
                        ? "text-[#F97316]"
                        : "text-muted-foreground",
                  )}
                >
                  {status.text}
                </p>
              )}
              {route && (
                <p className="ml-6 mt-1 text-xs text-muted-foreground">
                  Identity verification route: <span className="font-medium">{route.provider}</span>
                  {" — "}
                  {route.note}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-5">
        <Field label="Case notes">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="mt-5">
        <VerificationPanel
          transactionId={tx.id}
          checks={["id_document", "kyb", "aml"]}
          title="Identity verification"
          description="Run the live checks against the chosen counterparty. Results are recorded on the deal as they land; they inform the WaD decision but never make it."
        />
      </div>
      <StubProviderPanel tx={tx} />
    </Panel>
  );
}


/* ---------- execution ---------- */

const PREP_STAGES = ["Concept", "Pre-Feasibility", "Feasibility", "Bankability", "Implementation"];

function ExecutionStep({ tx, step, reload }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ prep_stage: PREP_STAGES[0]!, notes: "" });
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="space-y-6">
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
