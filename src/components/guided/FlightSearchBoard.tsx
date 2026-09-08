import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Loader2,
  UploadCloud,
  FileCheck2,
  X,
  Plus,
  Check,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BidWizard } from "@/components/guided/BidWizard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { advance, fingerprintOf, money, recordEvent, when, type Transaction } from "@/lib/tx";
import { discoverCounterpartiesByQuery, classifyDocument, runAiProposal } from "@/lib/izenzo.functions";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

type Direction = "bid" | "offer";

type Result = {
  id: string;
  name: string;
  jurisdiction: string | null;
  sector: string | null;
  score: number | null;
  source: "registry" | "ai" | "ai_plus" | "manual";
};

type Phase = "search" | "results" | "media";

/** A thin animated ribbon shown whenever the board is doing background work, so there's always
 * visible activity on screen during a search or a review. */
function ProcessingRibbon({ label }: { label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/20">
      <div className="flex items-center gap-3 bg-primary/5 px-4 py-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        <p className="text-sm text-primary">{label}</p>
      </div>
      <div className="h-1.5 w-full animate-ribbon-sweep" />
    </div>
  );
}

/** Simple Mode's single search: fill in what you're trading and attach documents up front, hit
 * Submit, and AI + AI+ return ranked matches — like a flight search. The criteria then collapse
 * into a fixed header while results appear below. The user checks the candidates worth reviewing
 * (and can add their own party to the list), clicks Review to run the social/news media scan on
 * that set, then makes the final choice — after which the wizard picks up at Intent. */
export function FlightSearchBoard() {
  const { org } = useAuth();
  const qc = useQueryClient();
  const classify = useServerFn(classifyDocument);
  const runMediaScan = useServerFn(runAiProposal);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [direction, setDirection] = useState<Direction>("bid");
  const [commodity, setCommodity] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("tonnes");
  const [price, setPrice] = useState("");
  const [country, setCountry] = useState("any");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const [phase, setPhase] = useState<Phase>("search");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualName, setManualName] = useState("");
  const [manualJurisdiction, setManualJurisdiction] = useState("");

  const [reviewing, setReviewing] = useState(false);
  const [mediaOutput, setMediaOutput] = useState("");
  const [reviewedResults, setReviewedResults] = useState<Result[]>([]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  const [openTxId, setOpenTxId] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  // Polls the transaction while the wizard is open so the sticky header can carry a live summary
  // (Proof of Intent sealed, now in WaD Case, etc.) without threading state through the wizard.
  const { data: liveTx } = useQuery({
    queryKey: ["board-tx", txId],
    enabled: !!txId,
    refetchInterval: openTxId ? 2000 : false,
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").eq("id", txId).maybeSingle();
      return data as Transaction | null;
    },
  });

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length) setStagedFiles((cur) => [...cur, ...list]);
  }

  function resetSearch() {
    setPhase("search");
    setResults([]);
    setSelected(new Set());
    setManualName("");
    setManualJurisdiction("");
    setMediaOutput("");
    setReviewedResults([]);
    setChosenId(null);
    setTxId(null);
  }

  async function submit() {
    if (!org) {
      toast.error("Add your organisation details first");
      return;
    }
    if (!commodity.trim()) {
      toast.error("Enter a commodity or asset");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create the transaction and record the bid.
      setStatusMessage("Opening your trade…");
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          org_id: org.id,
          stage: "trading",
          step: "bid-offer",
          title: commodity,
          commodity,
          quantity: quantity ? Number(quantity) : null,
          unit: unit || null,
          price: price ? Number(price) : null,
          currency: "USD",
        })
        .select()
        .single();
      if (txErr) throw txErr;
      setTxId(tx.id);

      await supabase.from("bid_offers").insert({
        transaction_id: tx.id,
        direction,
        price: price ? Number(price) : 0,
        quantity: quantity ? Number(quantity) : 0,
        unit: unit || "",
        currency: "USD",
        terms: "",
      });
      await recordEvent({
        transactionId: tx.id,
        stage: "trading",
        step: "bid-offer",
        action: direction === "bid" ? "bid_placed" : "offer_placed",
        summary: `${direction === "bid" ? "Bid" : "Offer"} placed: ${commodity}`,
        payload: { commodity, quantity, unit, price },
      });

      // 2. Upload any documents attached up front.
      if (stagedFiles.length > 0) {
        setStatusMessage("Uploading documents…");
        for (const file of stagedFiles) {
          const { docType } = await classify({ data: { filename: file.name } });
          const path = `deals/${tx.id}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
          const sha = await fingerprintOf({ name: file.name, size: file.size, at: Date.now() });
          await supabase.from("documents").insert({
            transaction_id: tx.id,
            name: file.name,
            doc_type: docType,
            notes: null,
            version: 1,
            sha256: sha,
            storage_path: upErr ? null : path,
          });
          await recordEvent({
            transactionId: tx.id,
            stage: "trading",
            step: "documents",
            action: "document_attached",
            summary: `${file.name} — classified as ${docType}`,
            payload: { name: file.name, doc_type: docType },
          });
        }
      }
      await advance(tx.id, "trading", "search");

      // 3. Run AI + AI+ and registry search.
      setStatusMessage("Searching with AI and AI+ for suitable matches…");
      const like = `%${commodity.trim()}%`;
      const [{ data: cps }, { data: rcs }, ai, aiPlus] = await Promise.all([
        supabase.from("counterparties").select("*").or(`name.ilike.${like},sector.ilike.${like}`).limit(15),
        supabase.from("registry_companies").select("*").or(`legal_name.ilike.${like},sector.ilike.${like}`).limit(15),
        discoverCounterpartiesByQuery({
          data: { query: commodity.trim(), role: direction === "bid" ? "buyer" : "seller", kind: "ai" },
        }).catch(() => ({ candidates: [] })),
        discoverCounterpartiesByQuery({
          data: { query: commodity.trim(), role: direction === "bid" ? "buyer" : "seller", kind: "ai_plus" },
        }).catch(() => ({ candidates: [] })),
      ]);

      const fromCp: Result[] = (cps ?? []).map((c) => ({
        id: `cp-${c.id}`, name: c.name, jurisdiction: c.jurisdiction, sector: c.sector, score: c.score, source: "registry",
      }));
      const fromRc: Result[] = (rcs ?? []).map((r) => ({
        id: `rc-${r.id}`, name: r.legal_name, jurisdiction: r.country, sector: r.sector, score: null, source: "registry",
      }));
      const fromAi: Result[] = ai.candidates.map((c, i) => ({
        id: `ai-${i}-${c.name}`, name: c.name, jurisdiction: c.jurisdiction ?? null, sector: c.sector ?? null, score: c.score ?? null, source: "ai",
      }));
      const fromAiPlus: Result[] = aiPlus.candidates.map((c, i) => ({
        id: `aiplus-${i}-${c.name}`, name: c.name, jurisdiction: c.jurisdiction ?? null, sector: c.sector ?? null, score: c.score ?? null, source: "ai_plus",
      }));

      let all = [...fromCp, ...fromRc, ...fromAi, ...fromAiPlus];
      if (country !== "any") {
        all = all.filter((r) => (r.jurisdiction ?? "").toLowerCase().includes(country.toLowerCase()));
      }
      all.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      setResults(all);
      setPhase("results");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
      setStatusMessage("");
    }
  }

  function toggleSelect(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addManualParty() {
    if (!manualName.trim()) {
      toast.error("Enter a name for the party");
      return;
    }
    const id = `manual-${Date.now()}`;
    setResults((cur) => [
      { id, name: manualName.trim(), jurisdiction: manualJurisdiction.trim() || null, sector: null, score: null, source: "manual" },
      ...cur,
    ]);
    setSelected((cur) => new Set(cur).add(id));
    setManualName("");
    setManualJurisdiction("");
  }

  async function runReview() {
    if (!txId) return;
    if (selected.size === 0) {
      toast.error("Check at least one party to review");
      return;
    }
    setReviewing(true);
    setStatusMessage("Recording your selection…");
    try {
      const picked = results.filter((r) => selected.has(r.id));
      for (const r of picked) {
        await supabase.from("counterparties").insert({
          transaction_id: txId,
          name: r.name,
          jurisdiction: r.jurisdiction,
          sector: r.sector,
          score: r.score,
          source: r.source,
          status: "reviewed",
        });
      }
      await recordEvent({
        transactionId: txId,
        stage: "trading",
        step: "counterparties",
        action: "counterparties_reviewed",
        summary: `${picked.length} candidate${picked.length === 1 ? "" : "s"} sent for review`,
        payload: { names: picked.map((r) => r.name) },
      });
      await advance(txId, "trading", "counterparties");

      setStatusMessage("Running social and news media scan…");
      const names = picked.map((r) => r.name).join(", ");
      const scan = await runMediaScan({
        data: {
          transactionId: txId,
          kind: "ai",
          question: `Act as an open-source media scan for these candidate counterparties: ${names}. List what a diligence officer should look for in news and social media about each party, this commodity, route and jurisdiction, and flag the risk themes worth checking. Be explicit that these are prompts for human checking, not findings.`,
        },
      })
        .then((res) => ({ output: res.output, ran: true }))
        .catch(() => ({
          output:
            "AI is not configured for this environment, so the automated scan could not run. Check news and social media for each party below yourself before choosing.",
          ran: false,
        }));
      setMediaOutput(scan.output);
      await recordEvent({
        transactionId: txId,
        stage: "trading",
        step: "media",
        action: "media_scanned",
        summary: scan.ran ? "Social and news media scan run on reviewed candidates" : "Media scan skipped — AI not configured",
        payload: { names: picked.map((r) => r.name), ran: scan.ran },
      });

      setReviewedResults(picked);
      setPhase("media");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReviewing(false);
      setStatusMessage("");
    }
  }

  async function confirmChoice() {
    if (!txId || !chosenId) return;
    const chosen = reviewedResults.find((r) => r.id === chosenId);
    if (!chosen) return;
    setChoosing(true);
    try {
      await supabase
        .from("counterparties")
        .update({ status: "chosen", chosen_at: new Date().toISOString() })
        .eq("transaction_id", txId)
        .eq("name", chosen.name);
      await recordEvent({
        transactionId: txId,
        stage: "trading",
        step: "choice",
        action: "counterparty_chosen",
        summary: `Chose ${chosen.name} from reviewed candidates`,
        payload: { name: chosen.name, source: chosen.source },
      });
      await advance(txId, "trading", "intent");
      void qc.invalidateQueries({ queryKey: ["my-trades"] });
      setOpenTxId(txId);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setChoosing(false);
    }
  }

  const searchSummary = [
    direction === "bid" ? "Buying" : "Selling",
    commodity || "—",
    [quantity, unit].filter(Boolean).join(" "),
    price ? money(Number(price)) : null,
    country !== "any" ? country : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // A running summary of everything settled so far, shown on the sticky header once Proof of
  // Intent seals so the deal's progress stays visible even while the wizard is closed.
  const progressSummary = liveTx?.poi_sealed_at
    ? [
        `Proof of Intent sealed ${when(liveTx.poi_sealed_at)}`,
        liveTx.wad_completed_at
          ? `WaD cleared ${when(liveTx.wad_completed_at)}`
          : liveTx.stage === "compliance"
            ? "now in WaD Case review"
            : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div>
      {phase !== "search" && (
        <div className="sticky top-0 z-10 -mx-1 mb-4 rounded-2xl border border-border bg-card/95 p-3 px-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              {direction === "bid" ? (
                <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <TrendingDown className="h-4 w-4 shrink-0 text-[var(--teal)]" />
              )}
              <span className="font-medium">{searchSummary}</span>
            </div>
            <div className="flex items-center gap-2">
              {txId && !openTxId && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpenTxId(txId)}>
                  Continue trade
                </Button>
              )}
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={resetSearch}>
                <ArrowLeft className="h-3.5 w-3.5" /> New search
              </Button>
            </div>
          </div>
          {progressSummary && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
              <Check className="h-3 w-3 shrink-0" /> {progressSummary}
            </p>
          )}
        </div>
      )}

      {phase === "search" && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-1 rounded-lg border border-border p-1 sm:grid-cols-2">
            {(["bid", "offer"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors",
                  direction === d
                    ? d === "bid"
                      ? "bg-primary/10 text-primary"
                      : "bg-[var(--teal)]/10 text-[var(--teal)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d === "bid" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {d === "bid" ? "Buying" : "Selling"}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-1.5">
            <Label>Commodity or asset</Label>
            <Input placeholder="e.g. Copper cathode" value={commodity} onChange={(e) => setCommodity(e.target.value)} />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Price (optional)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
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
            </div>
          </div>

          <div className="mt-3">
            <Label>Documents (optional)</Label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "mt-1.5 flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <UploadCloud className="h-5 w-5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop ID or deal documents, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {stagedFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {stagedFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
                    <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-success" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <button onClick={() => setStagedFiles((cur) => cur.filter((_, idx) => idx !== i))}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={submit} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Submit
            </Button>
          </div>
        </div>
      )}

      {submitting && statusMessage && phase === "search" && <ProcessingRibbon label={statusMessage} />}

      {phase === "results" && (
        <div>
          {results.length > 0 && (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {results.map((r) => (
                <label
                  key={r.id}
                  htmlFor={`res-${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer hover:bg-muted/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Checkbox
                      id={`res-${r.id}`}
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggleSelect(r.id)}
                    />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {r.name}
                        {(r.source === "ai" || r.source === "ai_plus") && (
                          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Sparkles className="h-2.5 w-2.5" /> {r.source === "ai" ? "AI" : "AI+"}
                          </span>
                        )}
                        {r.source === "manual" && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Added by you
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[r.jurisdiction, r.sector].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                  {r.score != null && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{r.score}% match</span>
                  )}
                </label>
              ))}
            </div>
          )}

          <div className={cn("rounded-2xl border border-border bg-card p-4", results.length > 0 && "mt-3")}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Add your own party</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="min-w-[10rem] flex-1 space-y-1.5">
                <Label>Name</Label>
                <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Company name" />
              </div>
              <div className="min-w-[8rem] flex-1 space-y-1.5">
                <Label>Jurisdiction</Label>
                <Input value={manualJurisdiction} onChange={(e) => setManualJurisdiction(e.target.value)} placeholder="Optional" />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addManualParty}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>

          {reviewing && statusMessage && <div className="mt-4"><ProcessingRibbon label={statusMessage} /></div>}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {selected.size} selected for review
            </p>
            <Button onClick={runReview} disabled={reviewing || selected.size === 0} className="gap-2">
              {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Review
            </Button>
          </div>
        </div>
      )}

      {phase === "media" && (
        <div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Social and news media scan
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Findings are recorded. They are never acted on automatically.
            </p>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{mediaOutput}</pre>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Make your choice
            </p>
            <ul className="mt-3 divide-y divide-border">
              {reviewedResults.map((r) => (
                <li key={r.id}>
                  <label
                    htmlFor={`choose-${r.id}`}
                    className="flex cursor-pointer items-center justify-between gap-3 py-3 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        id={`choose-${r.id}`}
                        type="radio"
                        name="chosen-counterparty"
                        className="h-4 w-4 accent-primary"
                        checked={chosenId === r.id}
                        onChange={() => setChosenId(r.id)}
                      />
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.jurisdiction ?? "—"}</p>
                      </div>
                    </div>
                    {chosenId === r.id && <Check className="h-4 w-4 shrink-0 text-success" />}
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button onClick={confirmChoice} disabled={choosing || !chosenId} className="gap-2">
                {choosing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirm choice
              </Button>
            </div>
          </div>
        </div>
      )}

      <BidWizard
        direction={null}
        openTxId={openTxId}
        onClose={() => setOpenTxId(null)}
        onCreated={() => void qc.invalidateQueries({ queryKey: ["my-trades"] })}
      />
    </div>
  );
}
