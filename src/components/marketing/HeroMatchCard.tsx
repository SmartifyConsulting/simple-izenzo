import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock, ShieldCheck, UploadCloud, FileCheck2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function useIllustrativeMatches(enabled: boolean) {
  return useQuery({
    queryKey: ["hero-illustrative-matches"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, name, sector, jurisdiction, rating_band, score")
        .order("rating_computed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
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
  const [fileName, setFileName] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: matches, isLoading } = useIllustrativeMatches(searched);
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
    setFileName(null);
    setSearched(false);
    setSearching(false);
  }

  /** Clears just the results, back to an empty upload prompt, for running the illustration
   * again with a different file — unlike Cancel, which is meant to abandon the flow. */
  function newSearch() {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    setFileName(null);
    setSearched(false);
    setSearching(false);
  }

  const canSearch = Boolean(fileName);

  return (
    <div className={cn("w-full rounded-2xl border border-border bg-card p-6 shadow-sm", className)}>
      {!searched && !searching && (
        <>
          <h2 className="text-base font-medium tracking-tight text-foreground">
            Upload Bid Proposal
          </h2>

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
              const file = e.dataTransfer.files?.[0];
              if (file) setFileName(file.name);
            }}
            className={cn(
              "mt-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
            )}
          >
            {fileName ? (
              <>
                <FileCheck2 className="h-5 w-5 text-success" />
                <p className="text-sm font-medium text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">Click to replace</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Drop files here</p>
                <p className="text-xs text-muted-foreground">Pitch deck, proposal, or any file</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </div>

          <div className="mt-5 flex gap-2">
            {fileName && (
              <Button variant="outline" className="rounded-full" onClick={reset}>
                Cancel
              </Button>
            )}
            <Button className="flex-1 rounded-full" disabled={!canSearch} onClick={onFindMatches}>
              Find Matches
            </Button>
          </div>
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
          <Button variant="outline" className="mt-2 rounded-full" onClick={reset}>
            Cancel
          </Button>
        </div>
      )}

      {searched && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-medium tracking-tight text-foreground">
              Top 5 matches
            </h2>
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              <ShieldCheck className="h-3 w-3" /> Live from database
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            A teaser of your top 5 — real Responder records, sign up to unlock full contacts.
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
          </div>

          <Link to="/auth" search={{ mode: "signup", next: undefined }} className="mt-5 block">
            <Button className="w-full rounded-full gap-1.5">
              <Sparkles className="h-4 w-4" /> Sign up to unlock matches
            </Button>
          </Link>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" className="flex-1 rounded-full" onClick={newSearch}>
              New Search
            </Button>
            <Button variant="ghost" className="flex-1 rounded-full" onClick={reset}>
              Cancel
            </Button>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/auth"
              search={{ mode: "signin", next: undefined }}
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
