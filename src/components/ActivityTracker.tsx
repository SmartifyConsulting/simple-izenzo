import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type ActivityRow = {
  user_id: string;
  event_type: "click" | "navigation";
  label: string | null;
  path: string;
  /** The bid this happened on, whenever the address names one — that's what lets the Admin
   * Activity Log be read one BID at a time. */
  transaction_id: string | null;
};

/**
 * user_activity_log isn't in the generated Supabase types until the next `types.ts`
 * regeneration picks up the migration, so these calls go through an untyped client.
 */
const activityLog = supabase as unknown as {
  from(table: "user_activity_log"): {
    insert(row: ActivityRow): Promise<{ error: unknown }>;
  };
};

function logActivity(row: ActivityRow) {
  Promise.resolve(activityLog.from("user_activity_log").insert(row)).catch(() => {});
}

function labelFor(el: Element): string | null {
  const interactive = el.closest("button, a, [role='button'], [role='tab'], [role='menuitem'], input[type='submit']");
  if (!interactive) return null;
  const aria = interactive.getAttribute("aria-label");
  if (aria) return aria.slice(0, 200);
  const text = interactive.textContent?.trim().replace(/\s+/g, " ");
  return text ? text.slice(0, 200) : interactive.tagName.toLowerCase();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Logs every click on an interactive element and every route change, per user and per bid. */
export function ActivityTracker() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const txFromSearch = useRouterState({ select: (s) => (s.location.search as { tx?: string })?.tx });
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;
  // Read at click time, so a click is attributed to whichever bid is open right then.
  const txRef = useRef<string | null>(null);
  txRef.current = txFromSearch && UUID.test(txFromSearch) ? txFromSearch : null;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const userId = userIdRef.current;
      if (!userId) return;
      const target = e.target as Element | null;
      if (!target) return;
      const label = labelFor(target);
      if (!label) return;
      logActivity({
        user_id: userId,
        event_type: "click",
        label,
        path: window.location.pathname,
        transaction_id: txRef.current,
      });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const userId = userIdRef.current;
    if (!userId) return;
    logActivity({
      user_id: userId,
      event_type: "navigation",
      label: null,
      path: pathname,
      transaction_id: txRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, txFromSearch, user?.id]);

  return null;
}
