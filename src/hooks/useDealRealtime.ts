import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TX_TABLES = [
  "engagement_responses",
  "transaction_events",
  "documents",
  "identity_verifications",
  "engagement_diligence",
  "match_challenges",
  "counter_offers",
  "bid_offers",
  "document_signatures",
] as const;

/** Listens for the other party's changes on this deal and quietly refreshes what's on screen.
 * React Query keeps current data visible while refetching, so nothing flickers or resets.
 * RLS limits the rows each person receives to deals they can already see. */
export function useDealRealtime(txId: string | null | undefined, onChange?: () => void) {
  const qc = useQueryClient();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (!txId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void qc.invalidateQueries({ refetchType: "active" });
        onChangeRef.current?.();
      }, 300);
    };
    let channel = supabase
      .channel(`deal-${txId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `id=eq.${txId}` }, bump);
    for (const table of TX_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `transaction_id=eq.${txId}` },
        bump,
      );
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txId, qc]);
}
