import { useEffect, useState } from "react";

export type ShellLayout = "classic" | "sidebar";

const KEY = "izenzo:shell-layout";
const EVENT = "izenzo:shell-layout-change";

export function getLayoutPreference(): ShellLayout {
  if (typeof window === "undefined") return "classic";
  return window.localStorage.getItem(KEY) === "sidebar" ? "sidebar" : "classic";
}

export function setLayoutPreference(layout: ShellLayout) {
  window.localStorage.setItem(KEY, layout);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Lets the user switch between the original top-header shell and the sidebar layout that
 * mirrors compliance-matching.lovable.app, so both can be compared side by side. */
export function useLayoutPreference() {
  const [layout, setLayout] = useState<ShellLayout>(getLayoutPreference());

  useEffect(() => {
    const onChange = () => setLayout(getLayoutPreference());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return [layout, setLayoutPreference] as const;
}
