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
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === KEY) setList(read());
    };
    window.addEventListener("storage", onStorage);
    const interval = setInterval(() => setList(read()), 1500);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, []);

  return list;
}
