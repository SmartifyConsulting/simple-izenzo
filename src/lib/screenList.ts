import { useEffect, useState } from "react";

export type ScreenListItem = {
  id: string;
  type: "trader" | "item";
  name: string;
  meta?: string;
};

const KEY = "izenzo:screen-list";
const EVENT = "izenzo:screen-list-change";

function read(): ScreenListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScreenListItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: ScreenListItem[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** A personal watchlist of traders and items surfaced from Search — kept per-browser in
 * localStorage rather than the database, so adding to it is instant with no server round trip. */
export function useScreenList() {
  const [items, setItems] = useState<ScreenListItem[]>(read());

  useEffect(() => {
    const onChange = () => setItems(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const add = (item: ScreenListItem) => {
    const current = read();
    if (current.some((i) => i.id === item.id)) return;
    write([...current, item]);
  };

  const remove = (id: string) => {
    write(read().filter((i) => i.id !== id));
  };

  const has = (id: string) => items.some((i) => i.id === id);

  return { items, add, remove, has };
}
