import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const KEY = "izenzo:theme";
const EVENT = "izenzo:theme-change";

function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(KEY) === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset["theme"] = theme;
}

function setTheme(theme: Theme) {
  window.localStorage.setItem(KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Dark (Ink & Aqua, black ground) is the committed default — light is opt-in and persisted
 * per browser. Call `initTheme()` once at app start to apply the stored/default theme before
 * first paint; `useTheme()` reads and toggles it from any component. */
export function initTheme() {
  if (typeof window === "undefined") return;
  applyTheme(getTheme());
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getTheme());

  useEffect(() => {
    const onChange = () => setThemeState(getTheme());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = () => setTheme(getTheme() === "dark" ? "light" : "dark");

  return [theme, toggle] as const;
}
