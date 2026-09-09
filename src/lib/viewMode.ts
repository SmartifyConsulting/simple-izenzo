import { useSyncExternalStore } from "react";

/** Which layout the Live Deal Engine renders in — the original vertical pipeline ("classic") or
 * the node-diagram workflow map ("mahjong"). Global (not per-page) since the toggle lives in the
 * app header, shared across every screen, and should stick as the user navigates around. */
export type ViewMode = "classic" | "mahjong";

const KEY = "izenzo:view-mode";
const listeners = new Set<() => void>();

function readStored(): ViewMode {
  if (typeof window === "undefined") return "mahjong";
  try {
    // Session-scoped on purpose: every sign-in starts on the Mahjong workflow map, and a toggle
    // (or the automatic switch to Classic when registering a bid/offer) only sticks for that
    // browsing session.
    return sessionStorage.getItem(KEY) === "classic" ? "classic" : "mahjong";
  } catch {
    return "mahjong";
  }
}

let current: ViewMode = readStored();

export function getViewMode(): ViewMode {
  return current;
}

export function setViewMode(mode: ViewMode) {
  current = mode;
  try {
    sessionStorage.setItem(KEY, mode);
  } catch {
    // Best-effort — the toggle still works for this tab even if it can't persist.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useViewMode(): ViewMode {
  return useSyncExternalStore(subscribe, getViewMode, () => "mahjong");
}
