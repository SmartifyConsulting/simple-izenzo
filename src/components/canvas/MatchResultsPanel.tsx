import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RATING_LABEL: Record<string, string> = {
  trusted: "Verified",
  neutral: "Under review",
  flagged: "Flagged",
};

/** The web page a candidate was found on, when the search recorded one. */
function evidenceUrl(flags: unknown): string | null {
  if (!flags || typeof flags !== "object") return null;
  const evidence = (flags as { evidence?: unknown }).evidence;
  if (!Array.isArray(evidence)) return null;
  const first = evidence[0] as { url?: unknown } | undefined;
  return typeof first?.url === "string" ? first.url : null;
}


/** The full match list, opened from the homepage's "…" once the visitor is signed in. Same
 * Responder records the homepage previews, only unblurred and complete rather than the top five. */
export function MatchResultsPanel({ query, className }: { query?: string | undefined; className?: string | undefined }) {
  const q = (query ?? "").trim();

  const { data = [], isLoading } = useQuery({
    queryKey: ["all-matches", q],
    queryFn: async () => {
      let builder = supabase
        .from("counterparties")
        .select("id, name, sector, jurisdiction, rating_band, score, rationale, media_flags")
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
        <p className="label-caps text-foreground">All matches</p>
        <Badge variant="secondary" className="font-normal">
          {data.length}
        </Badge>
      </div>

      {q && (
        <div className="mt-2 rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            What you asked for
          </p>
          <p className="mt-1 text-sm text-foreground">{q}</p>
        </div>
      )}


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
            {/* What the search found about this match, plus the page it came from. */}
            {m.rationale && (
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">{m.rationale}</p>
            )}
            {evidenceUrl(m.media_flags) && (
              <a
                href={evidenceUrl(m.media_flags)!}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Where it was found
              </a>
            )}
          </li>

        ))}
      </ul>
    </div>
  );
}
