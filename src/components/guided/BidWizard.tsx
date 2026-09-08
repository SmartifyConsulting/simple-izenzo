import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepScreen } from "@/components/steps/StepScreen";
import { DocumentUploadStep } from "@/components/guided/DocumentUploadStep";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { advance, recordEvent, type Transaction } from "@/lib/tx";
import { FLAT_STEPS, stepIndex } from "@/lib/spine";
import { cn } from "@/lib/utils";

const TRADING_STEPS = FLAT_STEPS.filter((s) => s.stage === "trading");
const TOTAL = TRADING_STEPS.length;

/** The Simple Mode bid wizard: a numbered modal that walks Bid/Offer -> Upload Docs -> Search ->
 * AI -> AI+ -> Counterparties -> Choice -> Social/News Media -> Intent -> Proof of Intent, all in
 * one place. Steps 3+ reuse StepScreen (the same panels the detailed Deal Canvas uses) so their
 * behaviour stays identical — only steps 1 and 2 are bespoke to this compact flow. */
export function BidWizard({
  direction,
  onClose,
  onCreated,
}: {
  direction: "bid" | "offer" | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { org } = useAuth();
  const qc = useQueryClient();
  const [txId, setTxId] = useState<string | null>(null);
  const [form, setForm] = useState({ commodity: "", quantity: "", unit: "tonnes", price: "", currency: "USD" });
  const [busy, setBusy] = useState(false);

  const { data: tx, refetch } = useQuery({
    queryKey: ["wizard-tx", txId],
    enabled: !!txId,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").eq("id", txId).single();
      if (error) throw error;
      return data as Transaction;
    },
  });

  const currentIndex = tx ? stepIndex("trading", tx.step) : -1;
  const currentDef = currentIndex >= 0 ? TRADING_STEPS[currentIndex] : null;

  function close() {
    setTxId(null);
    setForm({ commodity: "", quantity: "", unit: "tonnes", price: "", currency: "USD" });
    onClose();
  }

  async function createBid(e: React.FormEvent) {
    e.preventDefault();
    if (!org) {
      toast.error("Add your organisation details first");
      return;
    }
    if (!direction) return;
    setBusy(true);
    try {
      const { data: newTx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          org_id: org.id,
          stage: "trading",
          step: "bid-offer",
          title: form.commodity || (direction === "bid" ? "New buy bid" : "New sell offer"),
          commodity: form.commodity || null,
          quantity: form.quantity ? Number(form.quantity) : null,
          unit: form.unit || null,
          price: form.price ? Number(form.price) : null,
          currency: form.currency || "USD",
        })
        .select()
        .single();
      if (txErr) throw txErr;

      const { error: boErr } = await supabase.from("bid_offers").insert({
        transaction_id: newTx.id,
        direction,
        price: form.price ? Number(form.price) : 0,
        quantity: form.quantity ? Number(form.quantity) : 0,
        unit: form.unit || "",
        currency: form.currency || "USD",
        terms: "",
      });
      if (boErr) throw boErr;

      await recordEvent({
        transactionId: newTx.id,
        stage: "trading",
        step: "bid-offer",
        action: direction === "bid" ? "bid_placed" : "offer_placed",
        summary: `${direction === "bid" ? "Bid" : "Offer"} placed: ${form.commodity || newTx.title}`,
        payload: { ...form },
      });

      await advance(newTx.id, "trading", "documents");
      setTxId(newTx.id);
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stepNumber = txId ? currentIndex + 1 : 1;

  return (
    <Dialog open={direction !== null} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[85vh] w-[min(560px,94vw)] overflow-y-auto">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
            {stepNumber}
          </span>
          <DialogTitle className="text-base">
            Step {stepNumber} of {TOTAL} · {txId ? currentDef?.label : "Bid / Offer"}
          </DialogTitle>
        </div>
        <DialogDescription className="text-xs">
          {direction === "bid" ? "New Bid to Buy" : "New Bid to Sell"} — every step is recorded on
          the Trading Gateway.
        </DialogDescription>

        <div className="mt-1 flex gap-1">
          {TRADING_STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full",
                i < stepNumber ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="mt-4">
          {!txId ? (
            <form onSubmit={createBid} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="wiz-commodity">Commodity or asset</Label>
                <Input
                  id="wiz-commodity"
                  autoFocus
                  value={form.commodity}
                  onChange={(e) => setForm({ ...form, commodity: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wiz-qty">Quantity</Label>
                  <Input
                    id="wiz-qty"
                    type="number"
                    step="any"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wiz-unit">Unit</Label>
                  <Input id="wiz-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wiz-price">Price</Label>
                  <Input
                    id="wiz-price"
                    type="number"
                    step="any"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wiz-currency">Currency</Label>
                  <Input
                    id="wiz-currency"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={busy}
                className={cn("w-full", direction === "offer" && "bg-[var(--teal)] text-[var(--teal-foreground)] hover:opacity-90")}
              >
                Next
              </Button>
            </form>
          ) : currentDef?.key === "documents" ? (
            <DocumentUploadStep transactionId={txId} onNext={() => void refetch()} />
          ) : tx ? (
            <StepScreen tx={tx} stage="trading" step={tx.step} reload={() => void refetch()} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>

        {tx?.poi_sealed_at && (
          <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-center text-sm font-medium text-success">
            Proof of Intent sealed — this trade is now on the Compliance Gate.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
