import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Cancels a bid/offer and notifies every counterparty on it who has a matching Izenzo account —
 * matched by email address (the one thing a counterparty record and a platform account reliably
 * share), not by organisation name, which is too fragile to rely on for something that decides
 * who gets told a deal is off. In-app only: no email is sent from here. */
export const cancelBid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tx } = await supabase
      .from("transactions")
      .select("id, org_id, title, reference, status")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("You don't have access to this deal.");
    if (tx.status === "cancelled") return { notified: 0 };

    const { error: upErr } = await supabase
      .from("transactions")
      .update({ status: "cancelled" })
      .eq("id", tx.id);
    if (upErr) throw new Error(upErr.message);

    const { data: actor } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
    const actorName = actor?.full_name ?? actor?.email ?? "The other party";

    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      stage: "trading",
      step: "bid-offer",
      action: "deal_cancelled",
      summary: `${actorName} cancelled this bid/offer`,
    });

    // Best-effort notification — a lookup/insert failure here must never undo the cancellation
    // that already committed above.
    let notified = 0;
    try {
      const { data: counterparties } = await supabase
        .from("counterparties")
        .select("contact_email")
        .eq("transaction_id", tx.id)
        .not("contact_email", "is", null);

      const emails = [...new Set((counterparties ?? []).map((c) => c.contact_email as string).filter(Boolean))].map((e) =>
        e.toLowerCase(),
      );
      if (emails.length > 0) {
        const { data: matched } = await supabase.from("profiles").select("id, email").in("email", emails);
        const dealName = tx.reference ?? tx.title;
        for (const m of matched ?? []) {
          if (m.id === userId) continue;
          await supabase.from("notifications").insert({
            user_id: m.id,
            org_id: null,
            transaction_id: tx.id,
            title: `${dealName} was cancelled`,
            body: `${actorName} cancelled this bid/offer. No further action is needed on your side.`,
          });
          notified += 1;
        }
      }
    } catch {
      // Notification failure never blocks the cancellation itself.
    }

    return { notified };
  });
