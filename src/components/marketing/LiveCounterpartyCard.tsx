import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Pulls one real counterparty record from Supabase and renders it as a KYB-style card —
 * proof the Compliance Engine's matching/screening is wired to real data. */
export function LiveCounterpartyCard() {
  const { data: cp, isLoading } = useQuery({
    queryKey: ["marketing-live-counterparty"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("*")
        .order("rating_computed_at", { ascending: false })
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
          Izenzo · Compliance Engine
        </p>
        <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
          <ShieldCheck className="h-3 w-3" /> Live from database
        </span>
      </div>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading a live counterparty…</p>}

      {!isLoading && !cp && (
        <p className="mt-4 text-sm text-muted-foreground">No counterparties on file yet.</p>
      )}

      {cp && (
        <>
          <h3 className="mt-2 text-base font-semibold tracking-tight">{cp.name}</h3>
          <p className="text-xs text-muted-foreground">
            {cp.jurisdiction} · {cp.sector}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <RatingBand label="Status" value={cp.status} />
            <RatingBand label="Rating" value={cp.rating_band ?? "—"} />
            <RatingBand label="Score" value={cp.score != null ? String(cp.score) : "—"} />
          </div>
          {cp.rationale && (
            <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              {cp.rationale}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function RatingBand({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-2 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold capitalize text-foreground">{value}</p>
    </div>
  );
}
