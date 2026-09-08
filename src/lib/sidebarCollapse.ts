import { useEffect, useState } from "react";

const KEY = "izenzo:sidebar-collapsed";
const EVENT = "izenzo:sidebar-collapsed-change";

function getCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

function setCollapsed(collapsed: boolean) {
  window.localStorage.setItem(KEY, collapsed ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Remembers whether the sidebar nav is minimized to an icon rail, same persisted-preference
 * pattern as useLayoutPreference. */
export function useSidebarCollapsed() {
  const [collapsed, setState] = useState<boolean>(getCollapsed());

  useEffect(() => {
    const onChange = () => setState(getCollapsed());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = () => setCollapsed(!getCollapsed());

  return [collapsed, toggle] as const;
}
