import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock, ShieldCheck, UploadCloud, FileCheck2, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignInModal } from "@/components/auth/SignInModal";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function useIllustrativeMatches(enabled: boolean) {
  return useQuery({
    queryKey: ["hero-illustrative-matches"],
    enabled,
    queryFn: async () => {
      // Counted separately (head: true, no rows) so the card can say how many matches exist in
      // total while still only ever rendering the top 5 in the card.
      const { data, error, count } = await supabase
        .from("counterparties")
        .select("id, name, sector, jurisdiction, rating_band, score", { count: "exact" })
        .order("rating_computed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return { matches: data, total: count ?? data?.length ?? 0 };
    },
  });
}

const RATING_LABEL: Record<string, string> = {
  trusted: "Verified",
  neutral: "Under review",
  flagged: "Flagged",
};

/** The homepage's upload-and-preview card. Uploading a file here does not run any real analysis
 * — there is no backend that can screen an unauthenticated visitor's document against Izenzo's
 * actual matching engine. What it shows is real, live Responder data (same counterparties table
 * the Responder Directory reads), framed as an illustration of what a signed-in search returns.
 * Selecting a match is gated behind sign-up/sign-in — this is a preview, not a live workspace. */
export function HeroMatchCard({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: matchData, isLoading } = useIllustrativeMatches(searched);
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

  const canSearch = fileNames.length > 0;
  const canReset = canSearch || searching || searched;

  return (
    <div className={cn("w-full rounded-2xl border border-border bg-card p-6 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-medium tracking-tight text-foreground">
          {searched ? "Top 5 matches" : "Upload files"}
        </h2>
        <div className="flex items-center gap-2">
          {searched && (
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              <ShieldCheck className="h-3 w-3" /> Live from database
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
      </div>

      {!searched && !searching && (
        <>
          <div
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
            className={cn(
              "mt-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
            )}
          >
            {fileNames.length > 0 ? (
              <>
                <FileCheck2 className="h-5 w-5 text-success" />
                <p className="text-sm font-medium text-foreground">
                  {fileNames.length} file{fileNames.length === 1 ? "" : "s"} added
                </p>
                <p className="text-xs text-muted-foreground">Click, or drop more, to add another</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Drop files here</p>
                <p className="text-xs text-muted-foreground">Pitch deck, proposal, or any file — multiple OK</p>
              </>
            )}
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
          </div>

          {fileNames.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {fileNames.map((name) => (
                <li
                  key={name}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs"
                >
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

          <Button
            className="mt-5 w-full rounded-full text-base font-bold"
            disabled={!canSearch}
            onClick={onFindMatches}
          >
            Find Matches
          </Button>
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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                    {m.rating_band ? RATING_LABEL[m.rating_band] : "Unrated"}
                    {m.sector ? ` · ${m.sector}` : ""}
                  </p>
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </div>
                <p className="mt-1 text-sm font-medium text-foreground blur-[3px] select-none">
                  {m.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.jurisdiction ?? "Jurisdiction pending"}
                  {m.score != null ? ` · Score: ${m.score}` : ""}
                </p>
              </div>
            ))}

            {/* More than five found: the "…" opens the Live Workspace with the full list in its
                panel. The route is authenticated, so a visitor is sent to sign up / sign in first
                and lands back on the same results. */}
            {!isLoading && total > 5 && (
              <Link
                to="/live-deal-engine"
                search={{ panel: "matches" as const }}
                aria-label="Show all matches"
                className="mx-auto flex h-9 w-16 items-center justify-center rounded-full border border-border text-lg leading-none text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                …
              </Link>
            )}
          </div>


          <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-5 block">
            <Button className="w-full rounded-full gap-1.5">
              <Sparkles className="h-4 w-4" /> Sign up to unlock matches
            </Button>
          </Link>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Already have an account?{" "}
            <SignInModal>
              <button type="button" className="font-medium text-primary hover:underline">
                Sign in with facial recognition
              </button>
            </SignInModal>
          </p>
        </>
      )}
    </div>
  );
}
