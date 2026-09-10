import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MatchChallenge = {
  id: string;
  transaction_id: string;
  counterparty_id: string | null;
  subject: string;
  summary: string;
  status: string;
  raised_by: string;
  raised_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

const SELECT = "id, transaction_id, counterparty_id, subject, summary, status, raised_by, raised_at, resolved_at, resolution_note";

/** Every challenge raised on a deal — open ones pause progression, resolved ones stay as part of
 * the record. */
export const listChallenges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<MatchChallenge[]> => {
    const { supabase } = context;
    // Confirms the caller can actually see this deal before returning anything about it.
    const { data: tx } = await supabase.from("transactions").select("id").eq("id", data.transactionId).maybeSingle();
    if (!tx) throw new Error("You don't have access to this deal.");

    // `match_challenges` isn't in the generated Supabase types yet — same untyped-table pattern
    // already used for `counterparties.shortlisted` and the `reference` column elsewhere.
    const { data: rows, error } = await (supabase.from("match_challenges" as never) as any)
      .select(SELECT)
      .eq("transaction_id", data.transactionId)
      .order("raised_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as MatchChallenge[];
  });

/** Raises a challenge on a match — pauses progression until it's resolved. Both parties and
 * platform administrators can see it once raised. */
export const raiseChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionId: z.string().uuid(),
        counterpartyId: z.string().uuid().optional(),
        subject: z.string().min(1).max(120),
        summary: z.string().min(60).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MatchChallenge> => {
    const { supabase, userId } = context;
    const { data: tx } = await supabase.from("transactions").select("id").eq("id", data.transactionId).maybeSingle();
    if (!tx) throw new Error("You don't have access to this deal.");

    const { data: row, error } = await (supabase.from("match_challenges" as never) as any)
      .insert({
        transaction_id: data.transactionId,
        counterparty_id: data.counterpartyId ?? null,
        subject: data.subject,
        summary: data.summary,
        raised_by: userId,
      })
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);

    // Logged directly with the server-side client (rather than the browser-only recordEvent
    // helper, which reads the session via a client singleton that isn't available in here).
    await supabase.from("transaction_events").insert({
      transaction_id: data.transactionId,
      actor_id: userId,
      stage: "trading",
      step: "choice",
      action: "challenge_raised",
      summary: `Challenge raised: ${data.subject}`,
      payload: { subject: data.subject },
    });

    return row as unknown as MatchChallenge;
  });
