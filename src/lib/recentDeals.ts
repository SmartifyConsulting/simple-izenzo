import { useEffect, useState } from "react";

/** A small, per-browser "recently opened" list for the Search dialog — not synced anywhere, just
 * a shortcut back to the last few Bid/Offer IDs this person actually looked at. */
export type RecentDeal = {
  id: string;
  reference: string;
  title: string;
  direction: "bid" | "offer";
  time: string;
};

const KEY = "izenzo:recent-deals";
const MAX = 8;

function read(): RecentDeal[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RecentDeal[]) : [];
  } catch {
    return [];
  }
}

function write(list: RecentDeal[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Best-effort — recents just won't persist if storage is unavailable.
  }
}

/** Records a deal as opened, moving it to the front — call this wherever a deal is actually
 * loaded onto the canvas (opened from the trades list, resumed, or just recorded). */
export function pushRecentDeal(entry: RecentDeal) {
  const list = read().filter((d) => d.id !== entry.id);
  list.unshift(entry);
  write(list.slice(0, MAX));
}

/** Live-updating read of the recent-deals list, refreshed whenever another tab (or this one)
 * pushes to it. */
export function useRecentDeals() {
  const [list, setList] = useState<RecentDeal[]>(() => read());

  useEffect(() => {
    // Same 1.5s freshness, but it skips the work while the tab is hidden and only pushes a new
    // array (re-rendering everything that shows the list) when the stored value actually changed.
    let last = JSON.stringify(read());
    const sync = (force: boolean) => {
      if (!force && document.visibilityState !== "visible") return;
      const next = read();
      const encoded = JSON.stringify(next);
      if (encoded === last) return;
      last = encoded;
      setList(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === KEY) sync(true);
    };
    const tick = () => sync(false);
    window.addEventListener("storage", onStorage);
    const interval = setInterval(tick, 1500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", tick);
      clearInterval(interval);
    };
  }, []);

  return list;
}
