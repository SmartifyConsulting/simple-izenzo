import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { SubmitBidButton } from "@/components/marketing/SubmitBidButton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const RATING_BANDS = ["All", "trusted", "neutral", "flagged"] as const;

const RATING_LABEL: Record<string, string> = {
  trusted: "Verified",
  neutral: "Under review",
  flagged: "Flagged",
};

/** Distinct real sector/jurisdiction values on file, for building "browse by" links without
 * fabricating combinations that don't exist in the data. */
export function useResponderFacets() {
  return useQuery({
    queryKey: ["alpha-bravo-responder-facets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("counterparties").select("sector, jurisdiction");
      if (error) throw error;
      const sectors = Array.from(new Set(data.map((c) => c.sector).filter(Boolean))).sort();
      const jurisdictions = Array.from(
        new Set(data.map((c) => c.jurisdiction).filter(Boolean)),
      ).sort();
      return { sectors, jurisdictions } as { sectors: string[]; jurisdictions: string[] };
    },
  });
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function useResponders({
  sector,
  jurisdiction,
}: {
  sector?: string | undefined;
  jurisdiction?: string | undefined;
}) {
  return useQuery({
    queryKey: ["alpha-bravo-responders", sector ?? null, jurisdiction ?? null],
    queryFn: async () => {
      let query = supabase
        .from("counterparties")
        .select("id, name, sector, jurisdiction, status, rating_band, score, rationale")
        .order("rating_computed_at", { ascending: false })
        .limit(60);
      if (sector) query = query.ilike("sector", sector);
      if (jurisdiction) query = query.ilike("jurisdiction", jurisdiction);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/** The live, filterable Responder grid — shared by the main directory and its sector/location
 * variants so all three stay backed by the same query shape and never drift apart. */
export function ResponderDirectory({
  sector,
  jurisdiction,
}: {
  sector?: string;
  jurisdiction?: string;
}) {
  const { data, isLoading } = useResponders({ sector, jurisdiction });
  const [ratingFilter, setRatingFilter] = useState<(typeof RATING_BANDS)[number]>("All");

  const visible = (data ?? []).filter(
    (c) => ratingFilter === "All" || c.rating_band === ratingFilter,
  );

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2">
        {RATING_BANDS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRatingFilter(r)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
              ratingFilter === r
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {r === "All" ? "All" : RATING_LABEL[r]}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-10 text-sm text-muted-foreground">Loading live Responders…</p>}

      {!isLoading && visible.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">
          No Responders on file yet for this filter.
        </p>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                {c.rating_band ? RATING_LABEL[c.rating_band] : "Unrated"}
                {c.sector ? ` · ${c.sector}` : ""}
              </p>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
            </div>
            <h3 className="mt-2 text-base font-medium tracking-tight text-foreground">{c.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.jurisdiction ?? "Jurisdiction pending"}
              {c.score != null ? ` · Score: ${c.score}` : ""}
            </p>
            {c.rationale && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.rationale}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="text-xl font-medium tracking-tight text-foreground">Not listed yet?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Post an opportunity and we'll screen your counterparties automatically.
        </p>
        <div className="mt-5 inline-block">
          <SubmitBidButton />
        </div>
      </div>
    </>
  );
}

/** "Browse by sector / location" links, built only from values actually present on file. */
export function ResponderFacetLinks() {
  const { data } = useResponderFacets();
  if (!data) return null;

  return (
    <div className="mt-6 space-y-3">
      {data.sectors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Browse by sector:</span>
          {data.sectors.map((s) => (
            <Link
              key={s}
              to="/alpha-bravo/responders/sector/$sector"
              params={{ sector: slugify(s) }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {s}
            </Link>
          ))}
        </div>
      )}
      {data.jurisdictions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Browse by location:</span>
          {data.jurisdictions.map((j) => (
            <Link
              key={j}
              to="/alpha-bravo/responders/location/$jurisdiction"
              params={{ jurisdiction: slugify(j) }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {j}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
