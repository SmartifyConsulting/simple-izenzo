/** Which marketing "app" is currently on screen — Izenzo's own Ink & Aqua look, or the
 * Alpha-Bravo re-skin (cream/blue, Space Grotesk) used to demo an alternate look and feel.
 * Alpha-Bravo is presentation-only: same routes' worth of Supabase data, auth and business
 * rules — this only swaps CSS variables/fonts via a `data-app` attribute on <html>.
 *
 * Unlike theme.ts (dark/light, a genuine per-browser preference), which "app" is showing is
 * determined entirely by which routes you're on — so each shell just forces its own value on
 * mount rather than reading/writing a stored preference. */
export type AppSkin = "izenzo" | "alpha-bravo";

export function applyAppSkin(skin: AppSkin) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["app"] = skin;
}
