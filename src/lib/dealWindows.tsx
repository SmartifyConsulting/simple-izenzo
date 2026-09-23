import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export type WindowMode = "docked" | "minimized" | "maximized" | "popped";

export type DealWindow = {
  /** The transaction id this window shows, or "new" for a not-yet-created bid/offer. */
  id: string;
  label: string;
  /** The deal's commodity/title, if it has one yet — shown on hover over the tab, since `label`
   * itself is just the bid/offer reference (e.g. "BID9089361"), not a name a person recognizes. */
  name?: string | undefined;
  mode: WindowMode;
  /** Position while docked and not maximized — dragged freely within the viewport. */
  x: number;
  y: number;
};

const KEY_PREFIX = "izenzo:deal-windows";
/** Tabs the person deliberately closed. Kept separately (and, like the windows themselves, scoped
 * per signed-in user) so restoring their bids from the database on a fresh visit doesn't drag back
 * a tab they just shut, and doesn't leak between accounts on a shared computer either. */
const CLOSED_KEY_PREFIX = "izenzo:deal-windows-closed";

function closedKeyFor(userId: string | null) {
  return userId ? `${CLOSED_KEY_PREFIX}:${userId}` : `${CLOSED_KEY_PREFIX}:anon`;
}

function readClosed(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function rememberClosed(key: string, id: string) {
  try {
    const next = Array.from(new Set([...readClosed(key), id])).slice(-200);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Records against the person's account whether a tab is open or closed, so the taskbar shows what
 * they actually left open — on every browser and device, not just the one they closed it in. View
 * state only; it never touches the deal itself. Best-effort: the local copy still works if this
 * write fails. */
async function recordTabState(
  userId: string | null,
  transactionId: string,
  state: "open" | "closed",
  position = 0,
) {
  if (!userId || !UUID.test(transactionId)) return;
  try {
    await supabase.from("user_workspace_tabs").upsert(
      {
        user_id: userId,
        transaction_id: transactionId,
        state,
        position,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,transaction_id" },
    );
  } catch {
    // Best-effort only.
  }
}



/** Scoped per signed-in user (not just per browser) — a shared computer with more than one
 * Izenzo account otherwise leaked whoever used it last's open bid tabs into the next person's
 * session, since a plain browser-wide key doesn't know who's actually logged in. Falls back to a
 * generic bucket only for the brief window before auth resolves. */
function keyFor(userId: string | null) {
  return userId ? `${KEY_PREFIX}:${userId}` : `${KEY_PREFIX}:anon`;
}

function readAll(key: string): DealWindow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as DealWindow[]) : [];
  } catch {
    return [];
  }
}

function writeAll(key: string, windows: DealWindow[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(windows));
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
  register: (id: string, label: string, name?: string) => void;
  setMode: (id: string, mode: WindowMode) => void;
  move: (id: string, x: number, y: number) => void;
  close: (id: string) => void;
  /** True once this transaction's window has been popped into its own real browser window —
   * the docked/main-window copy should render nothing for it while that's the case. */
  isPoppedElsewhere: (id: string) => boolean;
  /** Reorders the taskbar by moving `draggedId` to sit right before `targetId`. */
  reorder: (draggedId: string, targetId: string) => void;
  /** Puts the person's own bids back on the taskbar (oldest first, newest on the right) without
   * touching any tab already open or reopening one they closed. */
  hydrate: (items: { id: string; label: string; name?: string | undefined }[]) => void;
  /** The deals this person left open, as recorded against their account — `null` until that has
   * been read. Anything not in this list was either closed or never opened, so it must not be put
   * back on the taskbar. */
  storedOpenIds: string[] | null;
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
  const { user } = useAuth();
  const [storedOpenIds, setStoredOpenIds] = useState<string[] | null>(null);
  // A ref (not just the userId itself) so the callbacks below — declared once, with stable deps —
  // always read whichever key is current without needing to be recreated on every auth change.
  const keyRef = useRef(keyFor(null));
  const closedKeyRef = useRef(closedKeyFor(null));
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const key = keyFor(user?.id ?? null);
    keyRef.current = key;
    closedKeyRef.current = closedKeyFor(user?.id ?? null);
    userIdRef.current = user?.id ?? null;
    // The taskbar starts empty on every sign-in rather than restoring whatever was left open
    // last time — both the in-memory state and the stored copy, so a stale entry can't leak back
    // in the moment something else calls readAll(). Tabs opened from here on (register/open) are
    // still remembered for the rest of this session, and still written to storage as usual.
    setWindows([]);
    writeAll(key, []);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setWindows(readAll(key));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user?.id]);

  // What this person left open, read from their own account rather than guessed from this browser.
  // Tabs they closed anywhere are mirrored locally too, so a tab they shut on their phone doesn't
  // come back on their laptop.
  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      setStoredOpenIds(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("user_workspace_tabs")
        .select("transaction_id, state, position")
        .eq("user_id", userId)
        .order("position", { ascending: true });
      if (cancelled || error || !data) return;
      const open = data.filter((r) => r.state === "open").map((r) => r.transaction_id);
      for (const row of data) {
        if (row.state === "closed") rememberClosed(closedKeyFor(userId), row.transaction_id);
      }
      setStoredOpenIds(open);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const persist = useCallback((next: DealWindow[]) => {
    setWindows(next);
    writeAll(keyRef.current, next);
  }, []);

  /** Notes against the person's account that this tab is open, so signing in anywhere brings it
   * back — and only it. */
  const markOpen = useCallback((id: string, position: number) => {
    setStoredOpenIds((prev) => (prev && !prev.includes(id) ? [...prev, id] : prev));
    void recordTabState(userIdRef.current, id, "open", position);
  }, []);

  const open = useCallback(
    (id: string, label: string) => {
      const existing = popped.current.get(id);
      if (existing && !existing.closed) {
        existing.focus();
        return;
      }
      const current = readAll(keyRef.current);
      const already = current.find((w) => w.id === id);
      markOpen(id, current.findIndex((w) => w.id === id) >= 0 ? current.findIndex((w) => w.id === id) : current.length);
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
    [persist, markOpen],
  );

  const register = useCallback(
    (id: string, label: string, name?: string) => {
      const current = readAll(keyRef.current);
      const already = current.find((w) => w.id === id);
      if (already) {
        // Keeps the tab's label current — a brand-new bid/offer opens as "New workspace" and
        // gets a real reference moments later once it's recorded, and the tab should pick that
        // up without disturbing whatever mode the window is already in (minimized, maximized…).
        if (already.label !== label || already.name !== name) {
          persist(current.map((w) => (w.id === id ? { ...w, label, name } : w)));
        }
        return;
      }
      markOpen(id, current.length);
      // A second (or later) workspace takes over the canvas, so whatever was showing before gets
      // out of the way onto the taskbar instead of the two competing for the same space.
      const others = current.map((w) => (w.mode === "minimized" ? w : { ...w, mode: "minimized" as WindowMode }));
      const offset = current.length * 24;
      persist([...others, { id, label, name, mode: "maximized", x: 80 + offset, y: 80 + offset }]);
    },
    [persist, markOpen],
  );

  const hydrate = useCallback(
    (items: { id: string; label: string; name?: string | undefined }[]) => {
      const current = readAll(keyRef.current);
      const closed = new Set(readClosed(closedKeyRef.current));
      const known = new Set(current.map((w) => w.id));
      const missing = items.filter((i) => !known.has(i.id) && !closed.has(i.id));
      if (missing.length === 0) {
        // Still keep labels honest for tabs opened before their reference existed.
        const fixed = current.map((w) => {
          const match = items.find((i) => i.id === w.id);
          return match && (w.label !== match.label || w.name !== match.name)
            ? { ...w, label: match.label, name: match.name }
            : w;
        });
        if (fixed.some((w, i) => w !== current[i])) persist(fixed);
        return;
      }
      const restored: DealWindow[] = missing.map((i, n) => ({
        id: i.id,
        label: i.label,
        name: i.name,
        // Restored tabs sit on the taskbar; nothing steals the canvas from whatever is open.
        mode: "minimized",
        x: 80 + (current.length + n) * 24,
        y: 80 + (current.length + n) * 24,
      }));
      persist([...restored, ...current]);
    },
    [persist],
  );

  const setMode = useCallback(
    (id: string, mode: WindowMode) => {
      const current = readAll(keyRef.current);
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
      persist(readAll(keyRef.current).map((w) => (w.id === id ? { ...w, x, y } : w)));
    },
    [persist],
  );

  const close = useCallback(
    (id: string) => {
      const w = popped.current.get(id);
      if (w && !w.closed) w.close();
      popped.current.delete(id);
      rememberClosed(closedKeyRef.current, id);
      // Recorded against the account, not just this browser, so it stays closed everywhere.
      setStoredOpenIds((prev) => (prev ? prev.filter((x) => x !== id) : prev));
      void recordTabState(userIdRef.current, id, "closed");
      persist(readAll(keyRef.current).filter((win) => win.id !== id));
    },
    [persist],
  );

  const isPoppedElsewhere = useCallback(
    (id: string) => windows.some((w) => w.id === id && w.mode === "popped"),
    [windows],
  );

  /** Moves one tab to sit right before another — drag-and-drop reordering in the taskbar. Purely
   * cosmetic (which order the tabs read left-to-right); doesn't touch mode/position. The new order
   * is kept against the account too, so it survives signing out. */
  const reorder = useCallback(
    (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return;
      const current = readAll(keyRef.current);
      const dragged = current.find((w) => w.id === draggedId);
      if (!dragged) return;
      const withoutDragged = current.filter((w) => w.id !== draggedId);
      const targetIndex = withoutDragged.findIndex((w) => w.id === targetId);
      if (targetIndex === -1) return;
      withoutDragged.splice(targetIndex, 0, dragged);
      persist(withoutDragged);
      withoutDragged.forEach((w, i) => {
        void recordTabState(userIdRef.current, w.id, "open", i);
      });
    },
    [persist],
  );

  return (
    <DealWindowsContext.Provider
      value={{ windows, open, register, setMode, move, close, isPoppedElsewhere, reorder, hydrate, storedOpenIds }}
    >
      {children}
    </DealWindowsContext.Provider>
  );
}

export function useDealWindows() {
  const ctx = useContext(DealWindowsContext);
  if (!ctx) throw new Error("useDealWindows must be used within DealWindowsProvider");
  return ctx;
}
