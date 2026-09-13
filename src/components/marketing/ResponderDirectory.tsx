import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, ExternalLink, ShieldCheck, Globe } from "lucide-react";
import { SubmitBidButton } from "@/components/marketing/SubmitBidButton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "verified", "registered", "unclaimed"] as const;

const FILTER_LABEL: Record<string, string> = {
  verified: "Verified",
  registered: "On Izenzo",
  unclaimed: "Unclaimed",
};

type Listing = {
  id: string;
  org_id: string | null;
  name: string;
  sector: string | null;
  jurisdiction: string | null;
  summary: string | null;
  source: string;
  source_url: string | null;
  verified_at: string | null;
  is_example: boolean;
};

/** Which of the three audiences a listing belongs to. Verified is only ever earned from a passed
 * identity check, never assumed. */
function bandOf(l: Listing): "verified" | "registered" | "unclaimed" {
  if (l.verified_at) return "verified";
  return l.org_id ? "registered" : "unclaimed";
}

const BAND_ORDER = { verified: 0, registered: 1, unclaimed: 2 } as const;

/** Distinct real sector/jurisdiction values on file, for building "browse by" links without
 * fabricating combinations that don't exist in the data. */
export function useResponderFacets() {
  return useQuery({
    queryKey: ["alpha-bravo-responder-facets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responder_listings")
        .select("sector, jurisdiction")
        .eq("published", true);
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
        .from("responder_listings")
        .select(
          "id, org_id, name, sector, jurisdiction, summary, source, source_url, verified_at, is_example",
        )
        .eq("published", true)
        .eq("is_example", false)
        .order("created_at", { ascending: false })
        .limit(60);
      if (sector) query = query.ilike("sector", sector);
      if (jurisdiction) query = query.ilike("jurisdiction", jurisdiction);
      const { data, error } = await query;
      if (error) throw error;
      return data as Listing[];
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
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const visible = (data ?? [])
    .filter((l) => filter === "All" || bandOf(l) === filter)
    .sort((a, b) => BAND_ORDER[bandOf(a)] - BAND_ORDER[bandOf(b)]);

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setFilter(r)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === r
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {r === "All" ? "All" : FILTER_LABEL[r]}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-10 text-sm text-muted-foreground">Loading Responders…</p>}

      {!isLoading && visible.length === 0 && (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-foreground">
            No Responders listed here yet
            {sector ? ` in ${sector}` : ""}
            {jurisdiction ? ` in ${jurisdiction}` : ""}.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Businesses appear here as they join Izenzo, or as they are found while searching for a
            live bid.
          </p>
          <Link
            to="/auth"
            search={{ mode: "signup", next: undefined }}
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            List your business
          </Link>
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((l) => {
          const band = bandOf(l);
          return (
            <div key={l.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                  {FILTER_LABEL[band]}
                  {l.sector ? ` · ${l.sector}` : ""}
                </p>
                {band === "verified" ? (
                  <BadgeCheck
                    className="h-3.5 w-3.5 shrink-0 text-success"
                    aria-label="Verified through Izenzo"
                  />
                ) : band === "registered" ? (
                  <ShieldCheck
                    className="h-3.5 w-3.5 shrink-0 text-primary"
                    aria-label="Registered on Izenzo"
                  />
                ) : (
                  <Globe
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-label="Found on the web, not yet on Izenzo"
                  />
                )}
              </div>
              <h3 className="mt-2 text-base font-medium tracking-tight text-foreground">
                {l.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {l.jurisdiction ?? "Location not stated"}
              </p>
              {l.summary && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{l.summary}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                {l.source_url && (
                  <a
                    href={l.source_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" /> Where this was found
                  </a>
                )}
                {band === "unclaimed" && (
                  <Link
                    to="/auth"
                    search={{ mode: "signup", next: undefined }}
                    className="font-medium text-primary hover:underline"
                  >
                    This is my business
                  </Link>
                )}
              </div>
            </div>
          );
        })}
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
