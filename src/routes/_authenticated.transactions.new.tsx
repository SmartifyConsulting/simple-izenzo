import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { recordEvent } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/transactions/new")({
  head: () => ({
    meta: [
      { title: "New transaction — Izenzo" },
      { name: "description", content: "Open a new transaction at the head of the Izenzo spine." },
      { property: "og:title", content: "New transaction — Izenzo" },
      { property: "og:description", content: "Open a new transaction on the Izenzo spine." },
    ],
  }),
  component: NewTransaction,
});

function NewTransaction() {
  const { org } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    commodity: "",
    quantity: "",
    unit: "",
    price: "",
    currency: "USD",
    incoterms: "",
    jurisdiction: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) {
      toast.error("Add your organisation details first");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          org_id: org.id,
          title: form.title,
          commodity: form.commodity || null,
          quantity: form.quantity ? Number(form.quantity) : null,
          unit: form.unit || null,
          price: form.price ? Number(form.price) : null,
          currency: form.currency || "USD",
          incoterms: form.incoterms || null,
          jurisdiction: form.jurisdiction || null,
        })
        .select()
        .single();
      if (error) throw error;
      await recordEvent({
        transactionId: data.id,
        stage: "trading",
        step: "bid-offer",
        action: "transaction_opened",
        summary: `Transaction opened: ${form.title}`,
        payload: { ...form },
      });
      navigate({
        to: "/tx/$id/$stage/$step",
        params: { id: data.id, stage: "trading", step: "bid-offer" },
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="New transaction" description="The head of the spine">
      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <div className="rounded-md border border-border">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">What is being traded</h2>
            <p className="text-xs text-muted-foreground">
              These terms are the first written state of the transaction.
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="title">Transaction title</Label>
              <Input
                id="title"
                required
                placeholder="e.g. Copper cathode, Q3 delivery"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="commodity">Commodity or asset</Label>
              <Input
                id="commodity"
                value={form.commodity}
                onChange={(e) => setForm({ ...form, commodity: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jurisdiction">Jurisdiction</Label>
              <Input
                id="jurisdiction"
                value={form.jurisdiction}
                onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="tonnes"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Indicative price</Label>
              <Input
                id="price"
                type="number"
                step="any"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="incoterms">Incoterms</Label>
              <Input
                id="incoterms"
                placeholder="e.g. CIF Rotterdam"
                value={form.incoterms}
                onChange={(e) => setForm({ ...form, incoterms: e.target.value })}
              />
            </div>
          </div>
          <div className="border-t border-border px-5 py-3 text-right">
            <Button type="submit" size="sm" disabled={busy}>
              Open transaction
            </Button>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
