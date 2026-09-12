import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RATING_LABEL: Record<string, string> = {
  trusted: "Verified",
  neutral: "Under review",
  flagged: "Flagged",
};

/** The full match list, opened from the homepage's "…" once the visitor is signed in. Same
 * Responder records the homepage previews, only unblurred and complete rather than the top five. */
export function MatchResultsPanel({ query, className }: { query?: string | undefined; className?: string | undefined }) {
  const q = (query ?? "").trim();

  const { data = [], isLoading } = useQuery({
    queryKey: ["all-matches", q],
    queryFn: async () => {
      let builder = supabase
        .from("counterparties")
        .select("id, name, sector, jurisdiction, rating_band, score")
        .order("rating_computed_at", { ascending: false })
        .limit(50);
      if (q) builder = builder.or(`name.ilike.%${q}%,sector.ilike.%${q}%`);
      const { data: rows, error } = await builder;
      if (error) throw error;
      return rows ?? [];
    },
  });

  return (
    <div className={cn("rounded-2xl border border-border bg-card/60 p-3 sm:p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="label-caps text-foreground">All matches{q ? ` for “${q}”` : ""}</p>
        <Badge variant="secondary" className="font-normal">
          {data.length}
        </Badge>
      </div>

      {isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading matches…</p>}

      {!isLoading && data.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No Responders on file for this search yet.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {data.map((m) => (
          <li key={m.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                {m.rating_band ? RATING_LABEL[m.rating_band] : "Unrated"}
                {m.sector ? ` · ${m.sector}` : ""}
              </p>
              {m.rating_band === "flagged" && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{m.name}</p>
            <p className="text-xs text-muted-foreground">
              {m.jurisdiction ?? "Jurisdiction pending"}
              {m.score != null ? ` · Score: ${m.score}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
