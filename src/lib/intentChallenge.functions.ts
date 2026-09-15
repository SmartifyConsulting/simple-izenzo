import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IntentMessage = {
  id: string;
  transaction_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_name: string | null;
  sender_avatar_url: string | null;
  sender_last_accessed_at: string | null;
};

const SELECT = "id, transaction_id, sender_id, body, created_at";

/** Every message on this deal's intent-challenge thread, newest last. */
export const listIntentMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<IntentMessage[]> => {
    const { supabase } = context;
    const { data: tx } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("You don't have access to this deal.");

    const { data: rows, error } = await (supabase.from("intent_messages" as never) as any)
      .select(SELECT)
      .eq("transaction_id", data.transactionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const messages = (rows ?? []) as unknown as {
      id: string;
      transaction_id: string;
      sender_id: string;
      body: string;
      created_at: string;
    }[];
    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    const { data: senders } = senderIds.length
      ? await supabase.from("profiles").select("id, full_name, avatar_url, last_accessed_at").in("id", senderIds)
      : { data: [] as { id: string; full_name: string | null; avatar_url: string | null; last_accessed_at: string | null }[] };
    const byId = new Map((senders ?? []).map((s) => [s.id, s]));

    return messages.map((m) => ({
      ...m,
      sender_name: byId.get(m.sender_id)?.full_name ?? null,
      sender_avatar_url: byId.get(m.sender_id)?.avatar_url ?? null,
      sender_last_accessed_at: byId.get(m.sender_id)?.last_accessed_at ?? null,
    }));
  });

/** Posts a message on the intent-challenge thread. Logs it into the Bid's Logs (transaction_events)
 * and notifies the other side both in-app (a row in `notifications`) and by email, so a message
 * lands even for someone who isn't on the platform right now. Messages stop once intent has been
 * confirmed — after that the terms are locked and the thread is closed. */
export const postIntentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ transactionId: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<IntentMessage> => {
    const { supabase, userId } = context;
    const { data: tx } = await supabase
      .from("transactions")
      .select("id, org_id, title, reference, intent_confirmed_at")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("You don't have access to this deal.");
    if (tx.intent_confirmed_at) throw new Error("Intent is already confirmed — this thread is closed.");

    const { data: sender } = await supabase
      .from("profiles")
      .select("full_name, email, org_id")
      .eq("id", userId)
      .maybeSingle();

    const { data: row, error } = await (supabase.from("intent_messages" as never) as any)
      .insert({ transaction_id: data.transactionId, sender_id: userId, body: data.body })
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);

    const senderName = sender?.full_name ?? sender?.email ?? "Someone";
    await supabase.from("transaction_events").insert({
      transaction_id: data.transactionId,
      actor_id: userId,
      stage: "trading",
      step: "intent",
      action: "intent_challenge_message",
      summary: `${senderName}: ${data.body.slice(0, 140)}${data.body.length > 140 ? "…" : ""}`,
      payload: { body: data.body },
    });

    // Best-effort notification of the other side — everyone in the bidder's org, plus everyone in
    // the chosen counterparty's org if that counterparty turns out to be a registered platform
    // organisation. Never lets a notification/email failure fail the message itself.
    try {
      const recipientOrgIds = new Set<string>();
      if (tx.org_id) recipientOrgIds.add(tx.org_id);
      const { data: chosen } = await supabase
        .from("counterparties")
        .select("name")
        .eq("transaction_id", data.transactionId)
        .eq("status", "chosen")
        .order("chosen_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (chosen?.name) {
        const { data: matchedOrg } = await supabase
          .from("organisations")
          .select("id")
          .ilike("name", chosen.name)
          .maybeSingle();
        if (matchedOrg?.id) recipientOrgIds.add(matchedOrg.id);
      }

      const { data: recipients } = recipientOrgIds.size
        ? await supabase
            .from("profiles")
            .select("id, email, full_name")
            .in("org_id", [...recipientOrgIds])
            .neq("id", userId)
        : { data: [] as { id: string; email: string | null; full_name: string | null }[] };

      const dealName = tx.reference ?? tx.title;
      for (const r of recipients ?? []) {
        await supabase.from("notifications").insert({
          user_id: r.id,
          org_id: null,
          transaction_id: data.transactionId,
          title: `New message on ${dealName}`,
          body: `${senderName}: ${data.body.slice(0, 200)}`,
        });
        if (r.email) {
          try {
            const { loadResendCreds, sendEmail, renderBrandedEmail } = await import("@/lib/resend.server");
            const creds = await loadResendCreds();
            await sendEmail(creds, {
              to: r.email,
              subject: `New message on ${dealName}`,
              html: renderBrandedEmail(
                `<p><strong>${senderName}</strong> wrote on the Confirm Intent thread for ${dealName}:</p>` +
                `<blockquote>${data.body}</blockquote>` +
                `<p><a href="https://izenzo.co.za/live-deal-engine?tx=${data.transactionId}">Open the deal</a></p>`,
              ),
            });
          } catch {
            // Resend isn't configured yet, or the send failed — the in-app notification already
            // landed, so this is best-effort only.
          }
        }
      }
    } catch {
      // Notification/lookup failure never blocks the message that was already saved.
    }

    return {
      ...(row as { id: string; transaction_id: string; sender_id: string; body: string; created_at: string }),
      sender_name: sender?.full_name ?? null,
      sender_avatar_url: null,
      sender_last_accessed_at: null,
    };
  });
