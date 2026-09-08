import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Download, Loader2, Sparkles, Lock } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { sealProofOfIntent, completeWad, runAiProposal, searchCounterparties } from "@/lib/izenzo.functions";
import { advance, fingerprintOf, money, recordEvent, shortHash, when, type Transaction, type TxEvent } from "@/lib/tx";
import { stepDef, POI_COST, WAD_COST, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

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
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
      {footer && <div className="border-t border-border px-6 py-4">{footer}</div>}
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
  const def = stepDef(props.stage, props.step);
  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{def?.label ?? props.step}</h2>
        {def?.blurb && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{def.blurb}</p>}
      </header>
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
            <Input
              required
              value={form.commodity}
              onChange={(e) => setForm({ ...form, commodity: e.target.value })}
            />
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
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="Unit">
            <Input
              required
              placeholder="e.g. metric tonnes"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
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
      await advance(tx.id, "trading", "media");
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
      await advance(tx.id, "trading", "search");
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
  const [running, setRunning] = useState<"ai" | "ai_plus" | null>(null);

  const { data: candidates = [] } = useQuery({
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

  async function runSearch(kind: "ai" | "ai_plus") {
    setRunning(kind);
    try {
      await recordEvent({
        transactionId: tx.id,
        stage: "trading",
        step: "search",
        action: "search_run",
        summary: `${kind === "ai" ? "AI" : "AI+"} search: ${tx.commodity ?? "any"}${region ? ` in ${region}` : ""}`,
        payload: { region, kind },
      });
      const result = await search({ data: { transactionId: tx.id, kind, region: region || undefined } });
      await qc.invalidateQueries({ queryKey: ["counterparties", tx.id] });
      await advance(tx.id, "trading", "ai");
      reload();
      toast.success(`${result.candidates.length} candidate(s) found`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRunning(null);
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
        description="AI and AI+ scan for organisations matching this bid's commodity, price, incoterms and jurisdiction. What was searched is part of the record."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => runSearch("ai")}
              disabled={running !== null}
              className="gap-2"
            >
              {running === "ai" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Search with AI
            </Button>
            <Button
              size="sm"
              onClick={() => runSearch("ai_plus")}
              disabled={running !== null}
              className="gap-2"
            >
              {running === "ai_plus" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Search with AI+
            </Button>
          </div>
        }
      >
        <Field label="Preferred counterparty region (optional)">
          <Input placeholder="e.g. Southern Africa" value={region} onChange={(e) => setRegion(e.target.value)} />
        </Field>
      </Panel>

      <Panel title="Candidates surfaced">
        {candidates.length === 0 ? (
          <Empty text="No candidates yet. Run a search above." />
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
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.jurisdiction ?? "—"} · surfaced by {c.source ?? "search"}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
    await advance(tx.id, "trading", "intent");
    await qc.invalidateQueries({ queryKey: ["counterparties", tx.id] });
    reload();
    toast.success("Choice recorded");
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

function IntentStep({ tx, reload }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

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
        summary: "Intent to transact confirmed",
        payload: { price: tx.price, quantity: tx.quantity, currency: tx.currency },
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
      footer={
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(Boolean(v))} />I confirm
            these terms reflect our intent
          </label>
          <Button size="sm" onClick={confirm} disabled={!agreed || busy || Boolean(tx.intent_confirmed_at)}>
            {tx.intent_confirmed_at ? "Intent confirmed" : "Confirm intent"}
          </Button>
        </div>
      }
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="label-caps">Transaction</dt>
          <dd>{tx.title}</dd>
        </div>
        <div>
          <dt className="label-caps">Commodity</dt>
          <dd>{tx.commodity ?? "—"}</dd>
        </div>
        <div>
          <dt className="label-caps">Quantity</dt>
          <dd>
            {tx.quantity ?? "—"} {tx.unit ?? ""}
          </dd>
        </div>
        <div>
          <dt className="label-caps">Price</dt>
          <dd>{money(tx.price, tx.currency)}</dd>
        </div>
        <div>
          <dt className="label-caps">Incoterms</dt>
          <dd>{tx.incoterms ?? "—"}</dd>
        </div>
        <div>
          <dt className="label-caps">Jurisdiction</dt>
          <dd>{tx.jurisdiction ?? "—"}</dd>
        </div>
      </dl>
      {tx.intent_confirmed_at && (
        <p className="mt-4 text-xs text-muted-foreground">
          Confirmed {when(tx.intent_confirmed_at)}
        </p>
      )}
    </Panel>
  );
}

function PoiStep({ tx, reload }: Props) {
  const seal = useServerFn(sealProofOfIntent);
  const [busy, setBusy] = useState(false);

  async function doSeal() {
    setBusy(true);
    try {
      await seal({ data: { transactionId: tx.id } });
      reload();
      toast.success("Proof of Intent sealed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const body = [
      "IZENZO — PROOF OF INTENT",
      "",
      `Transaction: ${tx.title}`,
      `Commodity:   ${tx.commodity ?? "—"}`,
      `Quantity:    ${tx.quantity ?? "—"} ${tx.unit ?? ""}`,
      `Price:       ${tx.price ?? "—"} ${tx.currency}`,
      `Incoterms:   ${tx.incoterms ?? "—"}`,
      `Jurisdiction:${tx.jurisdiction ?? "—"}`,
      `Intent:      ${tx.intent_confirmed_at}`,
      `Sealed:      ${tx.poi_sealed_at}`,
      "",
      `Fingerprint: ${tx.poi_hash}`,
    ].join("\n");
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
        <div className="text-right">
          <Button size="sm" onClick={doSeal} disabled={busy || !tx.intent_confirmed_at}>
            {busy ? "Sealing…" : "Seal Proof of Intent"}
          </Button>
        </div>
      }
    >
      {tx.intent_confirmed_at ? (
        <p className="text-sm text-muted-foreground">
          Sealing writes the transaction state to an immutable record with a fingerprint. Compliance,
          execution, finality and memory stay locked until it exists.
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Confirm intent first.
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

function WadStep({ tx, reload }: Props) {
  const complete = useServerFn(completeWad);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const allChecked = WAD_CHECKS.every((c) => checks[c.key]);

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
      reload();
      toast.success(`WaD ${decision}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (tx.wad_completed_at) {
    return (
      <Panel title="WaD — cleared" description={`Cleared ${when(tx.wad_completed_at)}`}>
        <p className="text-sm text-muted-foreground">
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
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("referred")}>
            Refer
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("blocked")}>
            Block
          </Button>
          <Button size="sm" disabled={busy || !allChecked} onClick={() => decide("cleared")}>
            Clear WaD
          </Button>
        </div>
      }
    >
      <ul className="space-y-2.5">
        {WAD_CHECKS.map((c) => (
          <li key={c.key} className="flex items-center gap-2.5 text-sm">
            <Checkbox
              checked={Boolean(checks[c.key])}
              onCheckedChange={(v) => setChecks({ ...checks, [c.key]: Boolean(v) })}
            />
            {c.label}
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <Field label="Case notes">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
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
