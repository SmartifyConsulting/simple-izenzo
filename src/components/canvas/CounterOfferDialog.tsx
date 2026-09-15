import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { listCounterOffers, sendCounterOffer } from "@/lib/counterOffer.functions";

/** The negotiation window for one counterparty: the whole back-and-forth so far, plus the form to
 * put the next set of terms to them. Sending records the offer, raises an in-app notice and emails
 * the counterparty when an address is on file. */
export function CounterOfferDialog({
  open,
  onOpenChange,
  txId,
  counterpartyId,
  counterpartyName,
  onProceed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  txId: string;
  counterpartyId: string;
  counterpartyName: string;
  /** Agreement reached — carry on to Online Media Screening with this counterparty. */
  onProceed?: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCounterOffers);
  const sendFn = useServerFn(sendCounterOffer);
  const [terms, setTerms] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["counter-offers", txId, counterpartyId],
    enabled: open && !!txId,
    refetchInterval: open ? 15000 : false,
    queryFn: () => listFn({ data: { transactionId: txId } }),
  });
  const thread = (data?.offers ?? []).filter((o) => o.counterparty_id === counterpartyId);

  async function send() {
    if (terms.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await sendFn({
        data: {
          transactionId: txId,
          counterpartyId,
          terms: terms.trim(),
          price: price ? Number(price) : null,
          quantity: quantity ? Number(quantity) : null,
          unit: unit.trim() || null,
          currency: currency.trim() || null,
        },
      });
      setTerms("");
      toast.success(res.emailed ? `Counter offer sent to ${counterpartyName}.` : "Counter offer recorded.");
      if (res.emailNote) toast.message(res.emailNote);
      await qc.invalidateQueries({ queryKey: ["counter-offers", txId, counterpartyId] });
      await qc.invalidateQueries({ queryKey: ["counter-offers-open", txId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Counter offer — {counterpartyName}</DialogTitle>
        <DialogDescription>
          Put your terms to them. They are notified in the app and by email where we have an address.
        </DialogDescription>

        {thread.length > 0 && (
          <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
            {thread.map((o) => (
              <li
                key={o.id}
                className={cn(
                  "rounded-md p-2 text-xs",
                  o.direction === "from_bidder" ? "bg-muted" : "bg-primary/10",
                )}
              >
                <p className="font-semibold">
                  {o.direction === "from_bidder" ? "You" : counterpartyName}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{o.terms}</p>
                {(o.price != null || o.quantity != null) && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {[
                      o.price != null ? `${o.currency ?? ""} ${o.price}`.trim() : null,
                      o.quantity != null ? `${o.quantity} ${o.unit ?? ""}`.trim() : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="co-price">Price</Label>
            <Input id="co-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="co-currency">Currency</Label>
            <Input id="co-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="co-qty">Quantity</Label>
            <Input id="co-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="co-unit">Unit</Label>
            <Input id="co-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="tonnes" />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="co-terms">Terms</Label>
          <Textarea
            id="co-terms"
            rows={4}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Delivery, payment, inspection, timelines…"
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onProceed && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onProceed();
              }}
            >
              Proceed with this bid
            </Button>
          )}
          <Button type="button" disabled={busy || terms.trim().length < 3} onClick={() => void send()}>
            {busy ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
