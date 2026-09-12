import { useEffect, useState } from "react";
import { applyAppSkin } from "@/lib/appSkin";

/** A "style preset" bundles the three independent visual switches (app skin, theme, and the
 * marketing ink-grid background pattern) into one named choice, so a single control can flip
 * between "the whole look" instead of three separate toggles. */
export type StylePreset = "cream" | "black" | "grid";

const KEY = "izenzo:style-preset";
const EVENT = "izenzo:style-preset-change";

export const STYLE_PRESETS: { id: StylePreset; label: string; description: string }[] = [
  { id: "cream", label: "Cream", description: "Alpha-Bravo — cream ground, royal blue" },
  { id: "black", label: "Black", description: "Ink & Aqua — dark ground, teal signal" },
  { id: "grid", label: "Green Grid", description: "Ink & Aqua with the marketing grid pattern" },
];

function getPreset(): StylePreset {
  if (typeof window === "undefined") return "cream";
  const stored = window.localStorage.getItem(KEY);
  return stored === "black" || stored === "grid" ? stored : "cream";
}

function applyPreset(preset: StylePreset) {
  if (typeof document === "undefined") return;
  applyAppSkin(preset === "cream" ? "alpha-bravo" : "izenzo");
  document.documentElement.dataset["theme"] = "dark";
  document.body.classList.toggle("ink-grid", preset === "grid");
}

export function setStylePreset(preset: StylePreset) {
  window.localStorage.setItem(KEY, preset);
  applyPreset(preset);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Call on mount wherever a page would otherwise force its own default skin — applies whatever
 * preset was last chosen (defaulting to "cream" if none was ever set), so the switcher's choice
 * sticks across every Alpha-Bravo page instead of being reset by each page's own mount effect. */
export function applyCurrentStylePreset() {
  applyPreset(getPreset());
}

export function useStylePreset() {
  const [preset, setPresetState] = useState<StylePreset>(getPreset());

  useEffect(() => {
    const onChange = () => setPresetState(getPreset());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  return [preset, setStylePreset] as const;
}
