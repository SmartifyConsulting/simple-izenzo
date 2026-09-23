import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { dedupeOrgs } from "@/lib/dedupeOrgs";
import { userFacingText } from "@/lib/userFacingText";
import { keepForBid, loadBidRelevance } from "@/lib/bidRelevance";
import { stripBidTerms } from "@/lib/bidTerms";

const BAND_LABEL = {
  verified: "Verified",
  registered: "On Izenzo",
  unclaimed: "Unclaimed",
} as const;

function bandOf(l: { verified_at: string | null; org_id: string | null }) {
  if (l.verified_at) return "verified" as const;
  return l.org_id ? ("registered" as const) : ("unclaimed" as const);
}

type Row = {
  id: string;
  name: string;
  sector: string | null;
  jurisdiction: string | null;
  summary: string | null;
  source_url: string | null;
  org_id: string | null;
  verified_at: string | null;
  source: string | null;
  score?: number | null;
  /** Every page this organisation was found on, after duplicate rows were merged. */
  sourceUrls?: string[];
};

type Scoring = { total?: number; components?: { label?: string; note?: string }[] };

/** Same organisation found on more than one page reads as one result — the same rule the shortlist
 * in the workflow uses. */
function dedupe(rows: Row[]): Row[] {
  return dedupeOrgs(rows, (r) => r.source_url);
}

/** The full match list. For a bid it shows that bid's own results — the organisations the live web
 * search actually found and scored — with the page each one came from. Without a bid it falls back
 * to the public `responder_listings` directory (the same table the homepage card reads). */
export function MatchResultsPanel({
  query,
  transactionId,
  className,
}: {
  query?: string | undefined;
  transactionId?: string | undefined;
  className?: string | undefined;
}) {
  const q = (query ?? "").trim();
  const terms = q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 3)
    .slice(0, 6);

  const bidMatches = useQuery({
    queryKey: ["bid-matches", transactionId],
    enabled: Boolean(transactionId),
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, name, sector, jurisdiction, media_flags")
        .eq("transaction_id", transactionId!);
      if (error) throw error;
      const relevance = await loadBidRelevance(transactionId!);
      const rows = (data ?? [])
        .map((c) => {
          const flags = (c.media_flags ?? {}) as {
            scoring?: Scoring;
            evidence?: { url?: string }[];
          };
          const reason = stripBidTerms(
            userFacingText(
              flags.scoring?.components?.find(
                (k) => k.label === "Fit with your request" || k.label === "Izenzo AI read",
              )?.note ?? null,
            ),
            relevance.bidTokens,
          ) ?? null;
          return {
            id: c.id as string,
            name: c.name as string,
            sector: (c.sector as string | null) ?? null,
            jurisdiction: (c.jurisdiction as string | null) ?? null,
            summary: reason,
            source_url: flags.evidence?.[0]?.url ?? null,
            org_id: null,
            verified_at: null,
            source: "web_search",
            score: flags.scoring?.total ?? null,
          } satisfies Row;
        });
      return dedupe(
        rows.filter((r) =>
          keepForBid(relevance, { name: r.name, sector: r.sector, jurisdiction: r.jurisdiction, rationale: r.summary }),
        ),
      );
    },
  });

  /** What the last search found but did not keep, and why — recorded on the search's own event, so
   * an empty or short result list can be explained instead of leaving the person guessing. */
  const notKept = useQuery({
    queryKey: ["search-not-kept", transactionId],
    enabled: Boolean(transactionId),
    queryFn: async (): Promise<{ name: string; reason: string }[]> => {
      const { data, error } = await supabase
        .from("transaction_events")
        .select("payload")
        .eq("transaction_id", transactionId!)
        .eq("action", "counterparty_search_completed")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const payload = (data?.[0]?.payload ?? {}) as { notKept?: { name?: string; reason?: string }[] };
      return (payload.notKept ?? [])
        .map((r) => ({ name: String(r.name ?? "").trim(), reason: String(r.reason ?? "").trim() }))
        .filter((r) => r.name.length > 0);
    },
  });

  const directory = useQuery({
    queryKey: ["all-matches", terms.join(",")],
    enabled: !transactionId,
    queryFn: async (): Promise<Row[]> => {
      let builder = supabase
        .from("responder_listings")
        .select("id, org_id, name, sector, jurisdiction, source, verified_at, summary, source_url")
        .eq("published", true)
        .eq("is_example", false);
      if (terms.length > 0) {
        builder = builder.or(
          terms.flatMap((t) => [`name.ilike.%${t}%`, `sector.ilike.%${t}%`, `jurisdiction.ilike.%${t}%`]).join(","),
        );
      }
      const { data: rows, error } = await builder.order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (rows ?? []) as Row[];
    },
  });

  const isLoading = transactionId ? bidMatches.isLoading : directory.isLoading;
  const data: Row[] = (transactionId ? bidMatches.data : directory.data) ?? [];

  // Narrows what's already been fetched — refining within these results is instant, without
  // re-running the original search each keystroke.
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const visible = f
    ? data.filter((m) =>
        [m.name, m.sector, m.jurisdiction].some((v) => (v ?? "").toLowerCase().includes(f)),
      )
    : data;

  return (
    <div className={cn("rounded-2xl border border-border bg-card/60 p-3 sm:p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="label-caps text-foreground">
          {transactionId ? "Matches found for this bid" : "All matches"}
        </p>
        <Badge variant="secondary" className="font-normal">
          {visible.length}
        </Badge>
      </div>

      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search these matches by name, sector, or jurisdiction…"
          className="pl-9"
        />
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
          {transactionId
            ? "No matches recorded for this bid yet — counterparty search runs automatically once documents are in."
            : "No Responders on file for this search yet."}
        </p>
      )}

      {!isLoading && data.length > 0 && visible.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No matches for "{filter}".</p>
      )}

      <ul className="mt-3 space-y-2">
        {visible.map((m) => (
          <li key={m.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                {transactionId ? "Found on the web" : BAND_LABEL[bandOf(m)]}
                {m.sector ? ` · ${m.sector}` : ""}
              </p>
              {typeof m.score === "number" && (
                <span className="shrink-0 rounded-full border border-foreground bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
                  {m.score}% match
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{m.name}</p>
            <p className="text-xs text-muted-foreground">
              {m.jurisdiction ?? "Jurisdiction pending"}
              {!transactionId && m.source === "web_search" ? " · Found on the web" : ""}
            </p>
            {m.summary && (
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">{m.summary}</p>
            )}
            {/* One organisation, however many pages it turned up on. */}
            {(m.sourceUrls?.length ?? 0) > 1 ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-[11px] text-muted-foreground">
                  Found on {m.sourceUrls!.length} pages
                </p>
                {m.sourceUrls!.map((u, i) => (
                  <a
                    key={u}
                    href={u}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" /> Page {i + 1}
                  </a>
                ))}
              </div>
            ) : (
              m.source_url && (
                <a
                  href={m.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Where it was found
                </a>
              )
            )}
          </li>
        ))}
      </ul>

      {transactionId && (notKept.data?.length ?? 0) > 0 && (
        <details className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
          <summary className="cursor-pointer text-xs font-medium text-foreground">
            Considered and not kept ({notKept.data!.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {notKept.data!.map((r, i) => (
              <li key={`${r.name}-${i}`} className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{r.name}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
