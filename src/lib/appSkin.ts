/** Which "app" is currently on screen — Izenzo's own Ink & Aqua look, or the Alpha-Bravo re-skin
 * (cream/blue, Space Grotesk) used to demo an alternate look and feel. Alpha-Bravo is
 * presentation-only: same routes' worth of Supabase data, auth and business rules — this only
 * swaps CSS variables/fonts via a `data-app` attribute on <html>.
 *
 * Marketing shells (SiteHeader, AlphaBravoShell) force their own skin on mount, since which one
 * you're on is determined by the marketing route. AppShell — the authenticated app's chrome,
 * shared by both journeys — instead reads back whichever skin the visitor's marketing shell last
 * set, so someone who arrived via Alpha-Bravo keeps that look once signed in, and someone who
 * arrived via classic Izenzo keeps that one. */
export type AppSkin = "izenzo" | "alpha-bravo";

const PREF_KEY = "izenzo:app-skin";

export function applyAppSkin(skin: AppSkin) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["app"] = skin;
  try {
    localStorage.setItem(PREF_KEY, skin);
  } catch {
    // Best-effort only — a private window or blocked storage just means the preference doesn't
    // persist across the redirect into the authenticated app.
  }
}

export function getPreferredAppSkin(): AppSkin {
  if (typeof window === "undefined") return "izenzo";
  try {
    const stored = localStorage.getItem(PREF_KEY);
    return stored === "alpha-bravo" ? "alpha-bravo" : "izenzo";
  } catch {
    return "izenzo";
  }
}
