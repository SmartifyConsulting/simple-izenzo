import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BAND_LABEL = {
  verified: "Verified",
  registered: "On Izenzo",
  unclaimed: "Unclaimed",
} as const;

function bandOf(l: { verified_at: string | null; org_id: string | null }) {
  if (l.verified_at) return "verified" as const;
  return l.org_id ? ("registered" as const) : ("unclaimed" as const);
}

/** The full match list, opened from the homepage's "See more" once the visitor is signed in. Reads
 * the exact same public `responder_listings` table the homepage's preview card queries (and the
 * Responder Directory), narrowed by the same typed-word matching, so "See more" shows the same
 * top-5-and-beyond results the visitor already saw — not a different, unrelated dataset. */
export function MatchResultsPanel({ query, className }: { query?: string | undefined; className?: string | undefined }) {
  const q = (query ?? "").trim();
  const terms = q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 3)
    .slice(0, 6);

  const { data = [], isLoading } = useQuery({
    queryKey: ["all-matches", terms.join(",")],
    queryFn: async () => {
      let builder = supabase
        .from("responder_listings")
        .select("id, org_id, name, sector, jurisdiction, source, is_example, verified_at, summary, source_url")
        .eq("published", true);
      if (terms.length > 0) {
        builder = builder.or(
          terms.flatMap((t) => [`name.ilike.%${t}%`, `sector.ilike.%${t}%`, `jurisdiction.ilike.%${t}%`]).join(","),
        );
      }
      const { data: rows, error } = await builder.order("created_at", { ascending: false }).limit(50);
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
              {BAND_LABEL[bandOf(m)]}
              {m.sector ? ` · ${m.sector}` : ""}
              {m.is_example ? " · Example" : ""}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{m.name}</p>
            <p className="text-xs text-muted-foreground">
              {m.jurisdiction ?? "Jurisdiction pending"}
              {m.source === "web_search" ? " · Found on the web" : ""}
            </p>
            {m.summary && (
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">{m.summary}</p>
            )}
            {m.source_url && (
              <a
                href={m.source_url}
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
