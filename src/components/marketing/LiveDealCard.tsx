import { useQuery } from "@tanstack/react-query";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/tx";

/** Pulls one real, live transaction from Supabase and renders it as a "Certificate of Intent"
 * card — proof the Trade Desk is wired to real data, not a static mock. */
export function LiveDealCard() {
  const { data: tx, isLoading } = useQuery({
    queryKey: ["marketing-live-deal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .not("commodity", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_20px_50px_-24px_hsl(220_30%_20%/0.18)]">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wide text-primary">
          Izenzo · Trade Desk
        </p>
        <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
          <ShieldCheck className="h-3 w-3" /> Live from database
        </span>
      </div>
      <h3 className="mt-2 text-base font-semibold tracking-tight">Certificate of Intent</h3>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading a live deal…</p>}

      {!isLoading && !tx && (
        <p className="mt-4 text-sm text-muted-foreground">
          No transactions to display yet — open one on the Trading Gateway.
        </p>
      )}

      {tx && (
        <div className="mt-4 space-y-3 text-sm">
          <Field label="Commodity">{tx.commodity ?? tx.title}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Volume">
              {tx.quantity ? `${tx.quantity} ${tx.unit ?? ""}` : "—"}
            </Field>
            <Field label="Price">{money(tx.price, tx.currency)}</Field>
          </div>
          <Field label="Incoterms">{tx.incoterms || "—"}</Field>
          <div className="flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <FileCheck2 className="h-3.5 w-3.5" />
            <span className="font-mono">{tx.poi_hash ? tx.poi_hash.slice(0, 24) + "…" : "Awaiting Proof of Intent seal"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-medium text-foreground">{children}</p>
    </div>
  );
}
