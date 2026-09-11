import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alpha-bravo/responders")({
  head: () => ({
    meta: [{ title: "Responders — Izenzo Alpha-Bravo" }],
  }),
  component: Responders,
});

const RATING_BANDS = ["All", "trusted", "neutral", "flagged"] as const;

const RATING_LABEL: Record<string, string> = {
  trusted: "Verified",
  neutral: "Under review",
  flagged: "Flagged",
};

function useResponders() {
  return useQuery({
    queryKey: ["alpha-bravo-responders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, name, sector, jurisdiction, status, rating_band, score, rationale")
        .order("rating_computed_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });
}

function Responders() {
  const { data, isLoading } = useResponders();
  const [ratingFilter, setRatingFilter] = useState<(typeof RATING_BANDS)[number]>("All");

  const visible = (data ?? []).filter(
    (c) => ratingFilter === "All" || c.rating_band === ratingFilter,
  );

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Responders
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-foreground sm:text-5xl">
          Verified Responders in our network.
        </h1>
        <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
          Browse Responders that have cleared Izenzo's compliance screening — every record here
          is live from our database, not a static list.
        </p>

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

        {isLoading && (
          <p className="mt-10 text-sm text-muted-foreground">Loading live Responders…</p>
        )}

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
              <h3 className="mt-2 text-base font-medium tracking-tight text-foreground">
                {c.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.jurisdiction ?? "Jurisdiction pending"}
                {c.score != null ? ` · Score: ${c.score}` : ""}
              </p>
              {c.rationale && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {c.rationale}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-medium tracking-tight text-foreground">
            Not listed yet?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Post an opportunity and we'll screen your counterparties automatically.
          </p>
          <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-5 inline-block">
            <Button className="rounded-full">Post an Opportunity</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
