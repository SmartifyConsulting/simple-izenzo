import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
};

type Scoring = { total?: number; components?: { label?: string; note?: string }[] };

/** Same organisation found on more than one page should read as one result. Company suffixes and
 * punctuation are dropped so "Fowler Law PLLC" and "Fowler Law, P.L.L.C." collapse together. */
const SUFFIXES =
  /\b(inc|llc|llp|pllc|ltd|limited|plc|pty|pte|gmbh|bv|nv|sa|srl|co|corp|corporation|company|group|holdings|partners|associates|advisors|advisers|attorneys|law|legal|services)\b/g;

function nameKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(SUFFIXES, " ").replace(/\s+/g, " ").trim();
}

function hostKey(url: string | null) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Keeps the highest-scoring row per organisation and remembers every page it was found on. */
function dedupe(rows: Row[]): Row[] {
  const byKey = new Map<string, Row>();
  const hostToKey = new Map<string, string>();
  for (const row of rows) {
    const host = hostKey(row.source_url);
    const key = (host && hostToKey.get(host)) || nameKey(row.name) || row.id;
    if (host && !hostToKey.has(host)) hostToKey.set(host, key);
    const existing = byKey.get(key);
    const urls = [...(existing?.sourceUrls ?? []), ...(row.source_url ? [row.source_url] : [])];
    const uniqueUrls = Array.from(new Set(urls));
    if (!existing) {
      byKey.set(key, { ...row, sourceUrls: uniqueUrls });
      continue;
    }
    const better = (row.score ?? 0) > (existing.score ?? 0) ? row : existing;
    byKey.set(key, { ...better, sourceUrls: uniqueUrls });
  }
  return Array.from(byKey.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
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
      return (data ?? [])
        .map((c) => {
          const flags = (c.media_flags ?? {}) as {
            scoring?: Scoring;
            evidence?: { url?: string }[];
          };
          const reason =
            flags.scoring?.components?.find((k) => k.label === "Izenzo AI read")?.note ?? null;
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
        })
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
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
            ? "No matches recorded for this bid yet — run Fetch Interest."
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
