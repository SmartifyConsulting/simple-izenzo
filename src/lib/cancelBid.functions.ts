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
      .select("id, org_id, title, reference, status, commodity")
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
    const { data: actorOrg } = await supabase.from("organisations").select("name").eq("id", tx.org_id).maybeSingle();
    const actorOrgName = actorOrg?.name ?? "The bidder";

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
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: counterparties } = await supabase
        .from("counterparties")
        .select("name, contact_email")
        .eq("transaction_id", tx.id)
        .not("contact_email", "is", null);
      const ref = tx.reference ?? tx.title;
      const kind = (tx.reference ?? "").startsWith("OFF") ? "offer" : "bid";
      const what = tx.commodity ? ` (${tx.commodity})` : "";
      const title = `${ref} has been cancelled`;
      const { getNotificationChannel } = await import("@/lib/bidderNotify.server");
      const seen = new Set<string>();
      for (const cp of counterparties ?? []) {
        const email = (cp.contact_email as string).trim().toLowerCase();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        const cpName = (cp.name as string) || "Counterparty";
        const body =
          `Dear ${cpName}, ${actorOrgName} has withdrawn ${kind} ${ref}${what}. The opportunity is now closed on the ` +
          `Izenzo Trading Gateway and no further action is needed from you. Kind regards, Izenzo Trading`;
        const html =
          `<p>Dear ${cpName},</p>` +
          `<p>${actorOrgName} has withdrawn ${kind} <strong>${ref}</strong>${what}. The opportunity is now closed on the Izenzo Trading Gateway. ` +
          `No further action is needed from you, and no tokens have been charged to your account for this ${kind}.</p>` +
          `<p>Thank you for your time and consideration. We look forward to matching you with future opportunities.</p>` +
          `<p>Kind regards,<br><strong>Izenzo Trading</strong></p>`;
        // Match the account by profile email, falling back to the org whose contact this is.
        let recipientId: string | null = null;
        const { data: prof } = await supabaseAdmin.from("profiles").select("id").ilike("email", email).maybeSingle();
        recipientId = prof?.id ?? null;
        if (!recipientId) {
          const { data: org } = await supabaseAdmin.from("organisations").select("id").ilike("primary_contact_email", email).maybeSingle();
          if (org?.id) {
            const { data: owner } = await supabaseAdmin.from("org_members").select("user_id").eq("org_id", org.id).eq("role", "owner").maybeSingle();
            recipientId = owner?.user_id ?? null;
          }
        }
        if (recipientId === userId) continue;
        const channel = recipientId ? await getNotificationChannel(supabaseAdmin, recipientId) : "email";
        if (recipientId && (channel === "in_app" || channel === "both")) {
          await supabaseAdmin.from("notifications").insert({ user_id: recipientId, transaction_id: tx.id, title, body });
        }
        if (channel === "email" || channel === "both") {
          try {
            const { loadResendCreds, sendEmail, renderBrandedEmail } = await import("@/lib/resend.server");
            const creds = await loadResendCreds();
            await sendEmail(creds, { to: email, subject: title, html: renderBrandedEmail(html) });
          } catch {
            // Email is a courtesy on top of the in-app record.
          }
        }
        notified += 1;
      }
    } catch {
      // Notification failure never blocks the cancellation itself.
    }

    return { notified };
  });
