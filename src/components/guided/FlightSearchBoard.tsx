import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Sparkles, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BidWizard } from "@/components/guided/BidWizard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { advance, recordEvent } from "@/lib/tx";
import { discoverCounterpartiesByQuery } from "@/lib/izenzo.functions";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

type Direction = "bid" | "offer";

type Result = {
  id: string;
  name: string;
  jurisdiction: string | null;
  sector: string | null;
  score: number | null;
  source: "registry" | "ai" | "ai_plus";
};

/** Flight-booking-style search: fill in what you're trading, hit Search, and results come back
 * ranked by match score with a country filter — like a flight results list. Picking a result
 * creates the transaction, attaches that counterparty as chosen, and opens the wizard already
 * past Search/AI/AI+/Counterparties/Choice, straight into Documents. */
export function FlightSearchBoard() {
  const { org } = useAuth();
  const qc = useQueryClient();
  const [direction, setDirection] = useState<Direction>("bid");
  const [commodity, setCommodity] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("tonnes");
  const [price, setPrice] = useState("");
  const [country, setCountry] = useState("any");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [openTxId, setOpenTxId] = useState<string | null>(null);

  async function runSearch() {
    if (!commodity.trim()) {
      toast.error("Enter a commodity or asset to search for");
      return;
    }
    setSearching(true);
    setResults(null);
    try {
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
        id: `cp-${c.id}`,
        name: c.name,
        jurisdiction: c.jurisdiction,
        sector: c.sector,
        score: c.score,
        source: "registry",
      }));
      const fromRc: Result[] = (rcs ?? []).map((r) => ({
        id: `rc-${r.id}`,
        name: r.legal_name,
        jurisdiction: r.country,
        sector: r.sector,
        score: null,
        source: "registry",
      }));
      const fromAi: Result[] = ai.candidates.map((c, i) => ({
        id: `ai-${i}-${c.name}`,
        name: c.name,
        jurisdiction: c.jurisdiction ?? null,
        sector: c.sector ?? null,
        score: c.score ?? null,
        source: "ai",
      }));
      const fromAiPlus: Result[] = aiPlus.candidates.map((c, i) => ({
        id: `aiplus-${i}-${c.name}`,
        name: c.name,
        jurisdiction: c.jurisdiction ?? null,
        sector: c.sector ?? null,
        score: c.score ?? null,
        source: "ai_plus",
      }));

      let all = [...fromCp, ...fromRc, ...fromAi, ...fromAiPlus];
      if (country !== "any") {
        all = all.filter((r) => (r.jurisdiction ?? "").toLowerCase().includes(country.toLowerCase()));
      }
      all.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      setResults(all);
    } catch (err) {
      toast.error((err as Error).message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function selectResult(r: Result) {
    if (!org) {
      toast.error("Add your organisation details first");
      return;
    }
    setSelecting(r.id);
    try {
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
          jurisdiction: r.jurisdiction,
        })
        .select()
        .single();
      if (txErr) throw txErr;

      await supabase.from("bid_offers").insert({
        transaction_id: tx.id,
        direction,
        price: price ? Number(price) : 0,
        quantity: quantity ? Number(quantity) : 0,
        unit: unit || "",
        currency: "USD",
        terms: "",
      });

      await supabase.from("counterparties").insert({
        transaction_id: tx.id,
        name: r.name,
        jurisdiction: r.jurisdiction,
        sector: r.sector,
        score: r.score,
        source: r.source,
        status: "chosen",
        chosen_at: new Date().toISOString(),
      });

      await recordEvent({
        transactionId: tx.id,
        stage: "trading",
        step: "bid-offer",
        action: direction === "bid" ? "bid_placed" : "offer_placed",
        summary: `${direction === "bid" ? "Bid" : "Offer"} placed: ${commodity}`,
        payload: { commodity, quantity, unit, price },
      });
      await recordEvent({
        transactionId: tx.id,
        stage: "trading",
        step: "choice",
        action: "counterparty_chosen",
        summary: `Chose ${r.name} from search results`,
        payload: { name: r.name, source: r.source },
      });

      await advance(tx.id, "trading", "documents");
      void qc.invalidateQueries({ queryKey: ["my-trades"] });
      setOpenTxId(tx.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div>
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

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Commodity or asset</Label>
            <Input
              placeholder="e.g. Copper cathode"
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
          </div>
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
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-1.5">
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
          <Button onClick={runSearch} disabled={searching} className="gap-2">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
      </div>

      {results !== null && (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {results.length} match{results.length === 1 ? "" : "es"}, ranked by fit
          </p>
          <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {results.length === 0 && !searching && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No matches yet — try a different commodity or country.
              </p>
            )}
            {results.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {r.name}
                    {(r.source === "ai" || r.source === "ai_plus") && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Sparkles className="h-2.5 w-2.5" /> {r.source === "ai" ? "AI" : "AI+"}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[r.jurisdiction, r.sector].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {r.score != null && (
                    <span className="text-sm font-semibold tabular-nums">{r.score}% match</span>
                  )}
                  <Button size="sm" onClick={() => selectResult(r)} disabled={selecting !== null}>
                    {selecting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Select"}
                  </Button>
                </div>
              </div>
            ))}
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
