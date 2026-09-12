import { createContext, useContext, useState, type ReactNode } from "react";

type HeroSearchContextValue = {
  prompt: string;
  setPrompt: (value: string) => void;
};

const HeroSearchContext = createContext<HeroSearchContextValue | null>(null);

/** Shares whatever a visitor typed into the homepage's search bar with the header's Sign In/
 * Sign Up buttons, so clicking either carries that same description into the Live Workspace —
 * otherwise a visitor who already ran a search would land on an empty workspace after signing in,
 * having to repeat themselves. */
export function HeroSearchProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState("");
  return <HeroSearchContext.Provider value={{ prompt, setPrompt }}>{children}</HeroSearchContext.Provider>;
}

export function useHeroSearch() {
  const ctx = useContext(HeroSearchContext);
  if (!ctx) throw new Error("useHeroSearch must be used within HeroSearchProvider");
  return ctx;
}

/** Same as `useHeroSearch`, but safe on screens rendered outside the provider (the signed-in
 * shells): there is simply no typed prompt to carry there. */
export function useHeroSearchOptional(): HeroSearchContextValue {
  return useContext(HeroSearchContext) ?? { prompt: "", setPrompt: () => {} };
}

/** Builds the `next` search-and-path destination that carries a typed prompt into the Live
 * Workspace, or `undefined` when there's nothing to carry. */
export function seedNext(prompt: string): string | undefined {
  const trimmed = prompt.trim();
  return trimmed ? `/live-deal-engine?seed=${encodeURIComponent(trimmed)}` : undefined;
}

// Files dropped on the homepage can't ride along in a URL param the way the typed prompt does,
// and signing in unmounts AlphaBravoShell's HeroSearchProvider entirely (a different layout takes
// over), so a File[] held in React state there is lost the moment that happens. A plain
// module-level variable survives instead, because signing in and landing on the Live Workspace is
// still all one client-side session — nothing here needs to survive an actual page reload.
let stashedHeroFiles: File[] = [];

export function stashHeroFiles(files: File[]) {
  stashedHeroFiles = files;
}

/** Non-destructive read — safe to call from a `useState` lazy initializer, which React's Strict
 * Mode deliberately double-invokes in development. A combined read-and-clear there would lose the
 * files on the second call before anything had a chance to use them; call `clearStashedHeroFiles`
 * separately (e.g. from a `useEffect`) once they've actually been picked up. */
export function peekStashedHeroFiles(): File[] {
  return stashedHeroFiles;
}

export function clearStashedHeroFiles() {
  stashedHeroFiles = [];
}
