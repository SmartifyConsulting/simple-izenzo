import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUp, ShieldCheck, FileCheck2, Loader2, RotateCcw, Sparkles, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { seedNext, stashHeroFiles, useHeroSearch } from "@/lib/heroSearchContext";
import { useAuth } from "@/lib/auth";

function extractTerms(prompt: string) {
  return prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 3)
    .slice(0, 6);
}

/** Reads the same public directory the Responders page reads, so a signed-out visitor actually
 * sees rows. The private counterparty table this used to query is per-transaction and unreadable
 * when signed out, which made the preview come back empty every time. */
function useIllustrativeMatches(enabled: boolean, prompt: string) {
  const terms = extractTerms(prompt);

  return useQuery({
    queryKey: ["hero-illustrative-matches", terms.join(",")],
    enabled,
    queryFn: async () => {
      let q = supabase
        .from("responder_listings")
        .select("id, org_id, name, sector, jurisdiction, source, verified_at, summary, source_url", {
          count: "exact",
        })
        .eq("published", true)
        .eq("is_example", false);

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

function bandOf(l: { verified_at: string | null; org_id: string | null }) {
  if (l.verified_at) return "verified" as const;
  return l.org_id ? ("registered" as const) : ("unclaimed" as const);
}

/** A fit percentage for the teaser report — real term overlap against what was typed when there
 * is a prompt to match against, or a steady band-based estimate while just browsing. Never shown
 * with the counterparty's own name attached: enough to make the number of good matches feel real
 * and worth signing up for, without handing over the actual matches for free. */
function fitScore(m: { name: string; sector: string | null; jurisdiction: string | null; summary: string | null; verified_at: string | null; org_id: string | null }, terms: string[]) {
  if (terms.length === 0) {
    return bandOf(m) === "verified" ? 96 : bandOf(m) === "registered" ? 84 : 70;
  }
  const haystack = `${m.name} ${m.sector ?? ""} ${m.jurisdiction ?? ""} ${m.summary ?? ""}`.toLowerCase();
  const hits = terms.filter((t) => haystack.includes(t)).length;
  return Math.max(Math.round((hits / terms.length) * 100), 60);
}

/** The homepage's upload-and-preview card. Uploading a file here does not run any real analysis
 * — there is no backend that can screen an unauthenticated visitor's document against Izenzo's
 * actual matching engine. What it shows is real, live Responder data (same counterparties table
 * the Responder Directory reads), framed as an illustration of what a signed-in search returns.
 * Selecting a match is gated behind sign-up/sign-in — this is a preview, not a live workspace. */
export function HeroMatchCard({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  // Kept as real File objects (not just names) so they can actually ride along into the bid
  // once the visitor signs in — see stashHeroFiles below.
  const [files, setFiles] = useState<File[]>([]);
  const fileNames = files.map((f) => f.name);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: matchData, isLoading } = useIllustrativeMatches(searched, prompt);
  const matches = matchData?.matches;
  const total = matchData?.total ?? 0;
  const searchTimer = useRef<number | null>(null);

  // Shares what was typed with the header, so clicking Sign In/Sign Up there carries it into the
  // Live Workspace instead of leaving the visitor to repeat themselves after they've authenticated.
  const { setPrompt: setHeroPrompt } = useHeroSearch();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => () => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
  }, []);

  function onFindMatches() {
    // Already signed in: there is nothing to preview or sign up for — the search goes straight into
    // the Live Workspace, which records the bid from what was typed (and any files dropped) and
    // runs the search there.
    if (user) {
      stashHeroFiles(files);
      const seed = prompt.trim();
      void navigate({ to: "/live-deal-engine", search: { fresh: true, ...(seed ? { seed } : {}) } });
      return;
    }
    setSearching(true);
    setSearched(false);
    setHeroPrompt(prompt);
    stashHeroFiles(files);
    searchTimer.current = window.setTimeout(() => {
      setSearching(false);
      setSearched(true);
    }, 900);
  }

  function reset() {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    setPrompt("");
    setFiles([]);
    setSearched(false);
    setSearching(false);
    setHeroPrompt("");
    stashHeroFiles([]);
  }

  function addFiles(incoming: FileList | File[]) {
    const list = Array.from(incoming);
    if (list.length === 0) return;
    // Dropping/selecting again adds to the pile rather than replacing it, so a visitor can
    // build up a small set of supporting documents before searching.
    setFiles((prev) => {
      const next = [...prev, ...list.filter((f) => !prev.some((p) => p.name === f.name))];
      // Kept in sync immediately (not just at search time) so signing in straight from the
      // header — without ever pressing "Find matches" — still carries these files along.
      stashHeroFiles(next);
      return next;
    });
  }

  function removeFile(name: string) {
    setFiles((prev) => {
      const next = prev.filter((f) => f.name !== name);
      stashHeroFiles(next);
      return next;
    });
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
        <h2 className="mt-1 text-base font-medium tracking-tight text-foreground">Search complete</h2>
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
              className="min-w-0 flex-1 basis-1/2 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
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
              aria-label="Drop deal documents here or click to browse"
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
                  : "Drop deal documents here or click to browse"}
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
        </>
      )}

      {searching && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Searching for matches…</p>
          <p className="text-xs text-muted-foreground">Cross-referencing verified Counterparties</p>
        </div>
      )}

      {searched && (
        <>
          <div className="mt-4">
            {isLoading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}

            {!isLoading && total === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                No Counterparties on file yet — sign up and be the first match.
              </p>
            )}

            {!isLoading && total > 0 && (() => {
              const terms = extractTerms(prompt);
              const fits = (matches ?? []).map((m) => fitScore(m, terms));
              const topFit = fits.length ? Math.max(...fits) : null;
              const strongFits = fits.filter((f) => f >= 90).length;
              return (
                <div className="rounded-2xl border border-border bg-muted/30 p-5 text-center">
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{total}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    counterpart{total === 1 ? "y" : "ies"} found{prompt.trim() ? " for your search" : ""}
                  </p>
                  {topFit !== null && (
                    <p className="mt-3 text-sm text-foreground">
                      {strongFits > 0 ? (
                        <>
                          <span className="font-semibold text-primary">{strongFits}</span> of them{" "}
                          {strongFits === 1 ? "has" : "have"} a{" "}
                          <span className="font-semibold text-primary">{topFit}%</span> fit or better.
                        </>
                      ) : (
                        <>
                          Best fit so far: <span className="font-semibold text-primary">{topFit}%</span>.
                        </>
                      )}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Sign up to see who they are and unlock full contacts.
                  </p>
                </div>
              );
            })()}
          </div>


          {!user && (
            <Link to="/auth" search={{ mode: "signup", next: seedNext(prompt) }} className="mt-5 block">
              <Button className="w-full rounded-full gap-1.5">
                <Sparkles className="h-4 w-4" /> Sign up to unlock matches
              </Button>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
