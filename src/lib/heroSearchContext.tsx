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

/** Builds the `next` search-and-path destination that carries a typed prompt into the Live
 * Workspace, or `undefined` when there's nothing to carry. */
export function seedNext(prompt: string): string | undefined {
  const trimmed = prompt.trim();
  return trimmed ? `/live-deal-engine?seed=${encodeURIComponent(trimmed)}` : undefined;
}
