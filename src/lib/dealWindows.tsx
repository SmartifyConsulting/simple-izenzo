import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type WindowMode = "docked" | "minimized" | "maximized" | "popped";

export type DealWindow = {
  /** The transaction id this window shows, or "new" for a not-yet-created bid/offer. */
  id: string;
  label: string;
  mode: WindowMode;
  /** Position while docked and not maximized — dragged freely within the viewport. */
  x: number;
  y: number;
};

const KEY = "izenzo:deal-windows";

function readAll(): DealWindow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DealWindow[]) : [];
  } catch {
    return [];
  }
}

function writeAll(windows: DealWindow[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(windows));
  } catch {
    // Best-effort only — losing the taskbar's persisted state isn't worth failing over.
  }
}

type DealWindowsValue = {
  windows: DealWindow[];
  /** Opens (or re-focuses, if already open) the workspace window for this deal — forces it back
   * to docked, so only use this for an explicit "open this deal" action. */
  open: (id: string, label: string) => void;
  /** Registers a window if it doesn't exist yet, and keeps its label current, but never changes
   * an existing window's mode — safe to call on every render of the page that owns this deal. */
  register: (id: string, label: string) => void;
  setMode: (id: string, mode: WindowMode) => void;
  move: (id: string, x: number, y: number) => void;
  close: (id: string) => void;
  /** True once this transaction's window has been popped into its own real browser window —
   * the docked/main-window copy should render nothing for it while that's the case. */
  isPoppedElsewhere: (id: string) => boolean;
};

const DealWindowsContext = createContext<DealWindowsValue | null>(null);

/** Tracks every open "deal workspace" (one per transaction) app-wide, backed by localStorage so
 * the taskbar and any popped-out real browser windows for the same deals stay in sync via the
 * native `storage` event — no server round-trip, no extra dependency. A window popped out to its
 * own real browser window (so it can be dragged to another monitor, unlike an in-page panel)
 * keeps a live reference here only for as long as this tab is the one that opened it; refocusing
 * a popped window after this tab reloads isn't possible — that's a real browser limitation, not
 * a gap in this code. */
export function DealWindowsProvider({ children }: { children: ReactNode }) {
  // Starts empty so the client's first render matches the server-rendered markup exactly — reading
  // localStorage during that first render (before hydration completes) is what was causing a
  // hydration mismatch, since the server always sees an empty store.
  const [windows, setWindows] = useState<DealWindow[]>([]);
  const popped = useRef(new Map<string, Window>());

  useEffect(() => {
    setWindows(readAll());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setWindows(readAll());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: DealWindow[]) => {
    setWindows(next);
    writeAll(next);
  }, []);

  const open = useCallback(
    (id: string, label: string) => {
      const existing = popped.current.get(id);
      if (existing && !existing.closed) {
        existing.focus();
        return;
      }
      const current = readAll();
      const already = current.find((w) => w.id === id);
      if (already) {
        persist(current.map((w) => (w.id === id ? { ...w, mode: "docked", label } : w)));
        return;
      }
      const offset = current.length * 24;
      persist([
        ...current,
        { id, label, mode: "maximized", x: 80 + offset, y: 80 + offset },
      ]);
    },
    [persist],
  );

  const register = useCallback(
    (id: string, label: string) => {
      const current = readAll();
      const already = current.find((w) => w.id === id);
      if (already) {
        // Keeps the tab's label current — a brand-new bid/offer opens as "New workspace" and
        // gets a real reference moments later once it's recorded, and the tab should pick that
        // up without disturbing whatever mode the window is already in (minimized, maximized…).
        if (already.label !== label) {
          persist(current.map((w) => (w.id === id ? { ...w, label } : w)));
        }
        return;
      }
      // A second (or later) workspace takes over the canvas, so whatever was showing before gets
      // out of the way onto the taskbar instead of the two competing for the same space.
      const others = current.map((w) => (w.mode === "minimized" ? w : { ...w, mode: "minimized" as WindowMode }));
      const offset = current.length * 24;
      persist([...others, { id, label, mode: "maximized", x: 80 + offset, y: 80 + offset }]);
    },
    [persist],
  );

  const setMode = useCallback(
    (id: string, mode: WindowMode) => {
      const current = readAll();
      if (mode === "popped") {
        const url = `/live-deal-engine?tx=${encodeURIComponent(id)}&popout=1`;
        const w = window.open(url, `izenzo-deal-${id}`, "width=1100,height=760");
        if (w) popped.current.set(id, w);
        persist(current.map((win) => (win.id === id ? { ...win, mode: "popped" } : win)));
        return;
      }
      popped.current.delete(id);
      // Only one workspace is ever open (maximized or docked) at a time — bringing one forward
      // always minimizes every other one, so a minimized tab never has any on-screen footprint to
      // overlap with whatever's actually open.
      const opening = mode === "maximized" || mode === "docked";
      persist(
        current.map((win) => {
          if (win.id === id) return { ...win, mode };
          return opening && win.mode !== "minimized" ? { ...win, mode: "minimized" } : win;
        }),
      );
    },
    [persist],
  );

  const move = useCallback(
    (id: string, x: number, y: number) => {
      persist(readAll().map((w) => (w.id === id ? { ...w, x, y } : w)));
    },
    [persist],
  );

  const close = useCallback(
    (id: string) => {
      const w = popped.current.get(id);
      if (w && !w.closed) w.close();
      popped.current.delete(id);
      persist(readAll().filter((win) => win.id !== id));
    },
    [persist],
  );

  const isPoppedElsewhere = useCallback(
    (id: string) => windows.some((w) => w.id === id && w.mode === "popped"),
    [windows],
  );

  return (
    <DealWindowsContext.Provider value={{ windows, open, register, setMode, move, close, isPoppedElsewhere }}>
      {children}
    </DealWindowsContext.Provider>
  );
}

export function useDealWindows() {
  const ctx = useContext(DealWindowsContext);
  if (!ctx) throw new Error("useDealWindows must be used within DealWindowsProvider");
  return ctx;
}
