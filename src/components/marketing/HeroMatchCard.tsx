import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUp, ShieldCheck, FileCheck2, Loader2, RotateCcw, Sparkles, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Reads the same public directory the Responders page reads, so a signed-out visitor actually
 * sees rows. The private counterparty table this used to query is per-transaction and unreadable
 * when signed out, which made the preview come back empty every time. */
function useIllustrativeMatches(enabled: boolean, prompt: string) {
  const terms = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 3)
    .slice(0, 6);

  return useQuery({
    queryKey: ["hero-illustrative-matches", terms.join(",")],
    enabled,
    queryFn: async () => {
      let q = supabase
        .from("responder_listings")
        .select("id, org_id, name, sector, jurisdiction, source, is_example, verified_at, summary, source_url", {
          count: "exact",
        })
        .eq("published", true);

      // What was typed narrows the directory; with nothing typed the newest listings are shown.
      if (terms.length > 0) {
        q = q.or(
          terms
            .flatMap((t) => [`name.ilike.%${t}%`, `sector.ilike.%${t}%`, `jurisdiction.ilike.%${t}%`])
            .join(","),
        );
      }

      const { data, error, count } = await q.order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return { matches: data, total: count ?? data?.length ?? 0 };
    },
  });
}

const BAND_LABEL = {
  verified: "Verified",
  registered: "On Izenzo",
  unclaimed: "Unclaimed",
} as const;

function bandOf(l: { verified_at: string | null; org_id: string | null }) {
  if (l.verified_at) return "verified" as const;
  return l.org_id ? ("registered" as const) : ("unclaimed" as const);
}

/** The homepage's upload-and-preview card. Uploading a file here does not run any real analysis
 * — there is no backend that can screen an unauthenticated visitor's document against Izenzo's
 * actual matching engine. What it shows is real, live Responder data (same counterparties table
 * the Responder Directory reads), framed as an illustration of what a signed-in search returns.
 * Selecting a match is gated behind sign-up/sign-in — this is a preview, not a live workspace. */
export function HeroMatchCard({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: matchData, isLoading } = useIllustrativeMatches(searched, prompt);
  const matches = matchData?.matches;
  const total = matchData?.total ?? 0;
  const searchTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
  }, []);

  function onFindMatches() {
    setSearching(true);
    setSearched(false);
    searchTimer.current = window.setTimeout(() => {
      setSearching(false);
      setSearched(true);
    }, 900);
  }

  function reset() {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    setPrompt("");
    setFileNames([]);
    setSearched(false);
    setSearching(false);
  }

  function addFiles(files: FileList | File[]) {
    const names = Array.from(files).map((f) => f.name);
    if (names.length === 0) return;
    // Dropping/selecting again adds to the pile rather than replacing it, so a visitor can
    // build up a small set of supporting documents before searching.
    setFileNames((prev) => [...prev, ...names.filter((n) => !prev.includes(n))]);
  }

  function removeFile(name: string) {
    setFileNames((prev) => prev.filter((n) => n !== name));
  }

  const canSearch = prompt.trim().length > 0 || fileNames.length > 0;
  const canReset = canSearch || searching || searched;

  return (
    <div className={cn("w-full", className)}>
      {(searched || canReset) && (
        <div className="flex items-center justify-end gap-2">
          {searched && (
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              <ShieldCheck className="h-3 w-3" /> Live listings
            </span>
          )}
          {canReset && (
            <button
              type="button"
              onClick={reset}
              title="Start again"
              aria-label="Start again"
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {searched && (
        <h2 className="mt-1 text-base font-medium tracking-tight text-foreground">Top 5 matches</h2>
      )}

      {!searched && !searching && (
        <>
          <p className="mb-4 text-center text-lg font-medium text-foreground">Ready when you are.</p>

          <div className="flex items-stretch gap-2 rounded-2xl border-2 border-border bg-background p-2 shadow-sm transition-colors focus-within:border-primary">
            {/* Left half: the typed description. */}
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSearch) onFindMatches();
              }}
              placeholder="Describe what you're looking for — product, quantity, location, terms…"
              className="min-w-0 flex-1 basis-1/2 bg-transparent px-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
            />

            {/* Right half: the same strip doubles as the drop zone, so no + button is needed. */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              aria-label="Drop files here or click to browse"
              className={cn(
                "flex min-w-0 flex-1 basis-1/2 items-center justify-center gap-2 rounded-xl border border-dashed px-2 text-xs transition-colors",
                dragOver
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <UploadCloud className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {fileNames.length > 0
                  ? `${fileNames.length} file${fileNames.length === 1 ? "" : "s"} attached`
                  : "Drop files here or click to browse"}
              </span>
            </button>

            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <button
              type="button"
              onClick={onFindMatches}
              disabled={!canSearch}
              aria-label="Find matches"
              className="flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>


          {fileNames.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {fileNames.map((name) => (
                <li
                  key={name}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs"
                >
                  <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-success" />
                  <span className="min-w-0 flex-1 break-words text-foreground">{name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(name)}
                    aria-label={`Remove ${name}`}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            See how matching works — no account needed to preview.
          </p>
        </>
      )}

      {searching && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Searching for matches…</p>
          <p className="text-xs text-muted-foreground">Cross-referencing verified Responders</p>
        </div>
      )}

      {searched && (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {!isLoading && total > 0 ? (
              <>
                <span className="font-medium text-foreground">
                  {total} match{total === 1 ? "" : "es"} found
                </span>
                {total > 5 ? " — showing your top 5. " : ". "}
                Real Responder records, sign up to unlock full contacts.
              </>
            ) : (
              "Your top 5 — real Responder records, sign up to unlock full contacts."
            )}
          </p>

          <div className="mt-4 space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

            {!isLoading && (!matches || matches.length === 0) && (
              <p className="text-sm text-muted-foreground">
                No Responders on file yet — sign up and be the first match.
              </p>
            )}

            {matches?.map((m) => (
              <div key={m.id} className="rounded-xl border border-border p-3">
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
              </div>
            ))}

            {/* More than five found: "See more" opens the Live Workspace with the full list in its
                panel, carrying the typed description so the panel filters on the same search. */}
            {!isLoading && total > 5 && (
              <Link
                to="/live-deal-engine"
                search={{ panel: "matches" as const, ...(prompt.trim() ? { q: prompt.trim() } : {}) }}
                aria-label="See more matches"
                className="mx-auto flex h-9 w-fit items-center justify-center rounded-full border border-border px-4 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                See more
              </Link>
            )}

          </div>


          <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-5 block">
            <Button className="w-full rounded-full gap-1.5">
              <Sparkles className="h-4 w-4" /> Sign up to unlock matches
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
