import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock, ShieldCheck, UploadCloud, FileCheck2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const DEAL_SIZES = ["Under $100k", "$100k – $500k", "$500k – $2M", "$2M+"];
const SECTORS = ["Agriculture", "Logistics", "Metals", "Energy", "Manufacturing"];

function useIllustrativeMatches(enabled: boolean) {
  return useQuery({
    queryKey: ["hero-illustrative-matches"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, name, sector, jurisdiction, rating_band, score")
        .order("rating_computed_at", { ascending: false })
        .limit(3);
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
  const [email, setEmail] = useState("");
  const [dealSize, setDealSize] = useState("");
  const [sector, setSector] = useState("");
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const { data: matches, isLoading } = useIllustrativeMatches(searched);

  function onFindMatches() {
    setSearching(true);
    setSearched(false);
    window.setTimeout(() => {
      setSearching(false);
      setSearched(true);
    }, 900);
  }

  const canSearch = Boolean(fileName && email && dealSize && sector);

  return (
    <div className={cn("w-full rounded-2xl border border-border bg-card p-6 shadow-sm", className)}>
      {!searched && !searching && (
        <>
          <h2 className="text-base font-medium tracking-tight text-foreground">
            Upload Bid Proposal Document
          </h2>

          <div
            onClick={() => inputRef.current?.click()}
            className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/40"
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
                <p className="text-sm font-medium text-foreground">Drop your document here</p>
                <p className="text-xs text-muted-foreground">
                  Pitch deck, proposal, or any text document
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="hero-email">Your Email</Label>
            <Input
              id="hero-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label>Deal Size</Label>
            <Select value={dealSize} onValueChange={setDealSize}>
              <SelectTrigger>
                <SelectValue placeholder="How much is the opportunity?" />
              </SelectTrigger>
              <SelectContent>
                {DEAL_SIZES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label>Sector</Label>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger>
                <SelectValue placeholder="Select your sector" />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="mt-5 w-full rounded-full" disabled={!canSearch} onClick={onFindMatches}>
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
          <p className="text-xs text-muted-foreground">Sector, deal size, and jurisdiction fit</p>
        </div>
      )}

      {searched && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-medium tracking-tight text-foreground">
              Illustrative matches
            </h2>
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              <ShieldCheck className="h-3 w-3" /> Live from database
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Real Responder records — sign up to run this against your own opportunity.
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
