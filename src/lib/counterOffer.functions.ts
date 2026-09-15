import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Negotiation between the bidder and a shortlisted counterparty. Each message is a row on
 * `counter_offers`; the thread is simply every row for the deal in time order. Sending one raises
 * an in-app notification and, when a contact email is on file, emails the counterparty — an email
 * that can't be sent never blocks the negotiation itself. */

const termsSchema = z.object({
  transactionId: z.string().uuid(),
  counterpartyId: z.string().uuid(),
  terms: z.string().trim().min(3, "Say what you're proposing."),
  price: z.number().nonnegative().nullable().optional(),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  currency: z.string().trim().max(8).nullable().optional(),
});

export const listCounterOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("counter_offers")
      .select("*")
      .eq("transaction_id", data.transactionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { offers: rows ?? [] };
  });

export const sendCounterOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => termsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, org_id, title, reference")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("That bid could not be opened.");

    const { data: cp, error: cpErr } = await supabase
      .from("counterparties")
      .select("id, name, contact_email")
      .eq("id", data.counterpartyId)
      .maybeSingle();
    if (cpErr) throw new Error(cpErr.message);
    if (!cp) throw new Error("That counterparty could not be opened.");

    const { data: row, error } = await supabase
      .from("counter_offers")
      .insert({
        transaction_id: data.transactionId,
        counterparty_id: data.counterpartyId,
        direction: "from_bidder",
        terms: data.terms,
        price: data.price ?? null,
        quantity: data.quantity ?? null,
        unit: data.unit ?? null,
        currency: data.currency ?? null,
        status: "sent",
        created_by: userId,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const label = `${tx.reference ? `${tx.reference} — ` : ""}${tx.title ?? "Bid"}`;

    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      stage: "trading",
      step: "counterparties",
      action: "counter_offer_sent",
      detail: `Counter offer sent to ${cp.name}`,
    } as never);

    await supabase.from("notifications").insert({
      org_id: tx.org_id,
      transaction_id: tx.id,
      title: `Counter offer sent to ${cp.name}`,
      body: `${label}: ${data.terms}`,
    } as never);

    let emailed = false;
    let emailNote: string | null = null;
    const to = (cp as { contact_email?: string | null }).contact_email ?? null;
    if (to) {
      try {
        const { loadResendCreds, sendEmail, renderBrandedEmail } = await import("@/lib/resend.server");
        const creds = await loadResendCreds();
        if (creds?.enabled) {
          await sendEmail(creds, {
            to,
            subject: `Counter offer — ${label}`,
            html: renderBrandedEmail(
              `<p>A counter offer has been proposed on <strong>${label}</strong>.</p>` +
              `<p style="white-space:pre-wrap">${data.terms.replace(/</g, "&lt;")}</p>` +
              `<p>Sign in to Izenzo to reply.</p>`,
            ),
          });
          emailed = true;
        } else {
          emailNote = "Email is not connected yet, so only the in-app notice was raised.";
        }
      } catch {
        emailNote = "The counter offer was recorded, but the email could not be sent.";
      }
    } else {
      emailNote = "No contact email on file for this counterparty, so only the in-app notice was raised.";
    }

    return { offer: row, emailed, emailNote };
  });

export const recordCounterOfferReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => termsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await supabase
      .from("counter_offers")
      .update({ status: "answered" } as never)
      .eq("transaction_id", data.transactionId)
      .eq("counterparty_id", data.counterpartyId)
      .eq("status", "sent");

    const { data: row, error } = await supabase
      .from("counter_offers")
      .insert({
        transaction_id: data.transactionId,
        counterparty_id: data.counterpartyId,
        direction: "from_counterparty",
        terms: data.terms,
        price: data.price ?? null,
        quantity: data.quantity ?? null,
        unit: data.unit ?? null,
        currency: data.currency ?? null,
        status: "sent",
        created_by: userId,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { offer: row };
  });
