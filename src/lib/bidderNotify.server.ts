/** Server-only. Notifies the person who owns a transaction — email, in-app, or both, whichever
 * they chose in Account Settings → Notification Preferences (defaulting to both when unset).
 * Never throws: a notification failing must never break the real action (sending an email,
 * recording a match) that triggered it. */

const ADMIN_EMAIL = "support@izenzo.co.za";

export type NotifyChannel = "email" | "in_app" | "both";

type Recipient = { userId: string; email: string | null; channel: NotifyChannel };

/** The transaction's own creator — "the bidder" for every notification this file sends. */
async function resolveRecipient(supabaseAdmin: any, transactionId: string): Promise<Recipient | null> {
  try {
    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("created_by")
      .eq("id", transactionId)
      .maybeSingle();
    if (!tx?.created_by) return null;
    // notification_channel predates the generated Supabase types being refreshed — read the whole
    // row and cast, rather than name the column directly, so this degrades to the "both" default
    // instead of throwing if the migration hasn't run yet in this environment.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", tx.created_by)
      .maybeSingle();
    const row = profile as { email?: string | null; notification_channel?: NotifyChannel | null } | null;
    return {
      userId: tx.created_by,
      email: row?.email ?? null,
      channel: row?.notification_channel ?? "both",
    };
  } catch {
    return null;
  }
}

/** A specific person's own channel preference, for the handful of notifications that go to
 * someone other than "the transaction owner" (e.g. a counterparty-side platform account matched
 * by email) — resolveRecipient above covers the transaction-owner case; this covers everyone
 * else. Defaults to "both" if unset or the row/column can't be read. */
export async function getNotificationChannel(supabaseAdmin: any, userId: string): Promise<NotifyChannel> {
  try {
    const { data } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle();
    return (data as { notification_channel?: NotifyChannel | null } | null)?.notification_channel ?? "both";
  } catch {
    return "both";
  }
}

/** Notifies the transaction's owner according to their own channel preference — no Admin copy.
 * Use this for every ordinary notification; use notifyBidder (below) only for the handful of
 * events Admin specifically asked to be bcc'd on. */
export async function notifyTransactionOwner(args: {
  orgId: string;
  transactionId: string;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const recipient = await resolveRecipient(supabaseAdmin, args.transactionId);
    const channel = recipient?.channel ?? "both";

    if (channel === "in_app" || channel === "both") {
      try {
        await supabaseAdmin.from("notifications").insert({
          org_id: args.orgId,
          ...(recipient?.userId ? { user_id: recipient.userId } : {}),
          transaction_id: args.transactionId,
          title: args.title,
          body: args.body,
        });
      } catch {
        // An Inbox notification is never worth failing the real action for.
      }
    }

    if ((channel === "email" || channel === "both") && recipient?.email) {
      try {
        const { loadResendCreds, sendEmail, renderBrandedEmail } = await import("@/lib/resend.server");
        const creds = await loadResendCreds();
        await sendEmail(creds, {
          to: recipient.email,
          subject: args.title,
          html: renderBrandedEmail(`<p>${args.title}</p><p>${args.body}</p>`),
        });
      } catch {
        // The bidder's own email is a courtesy on top of the in-app record, never a requirement.
      }
    }
  } catch {
    // Resolving the recipient/preference must never block anything downstream.
  }
}

/** Same as notifyTransactionOwner, plus an unconditional Admin email copy — Admin asked to be
 * bcc'd specifically on: counterparty emailed, counterparty account created, counterparty
 * verified, counterparty viewing the bid. That's an admin policy, not something the bidder's own
 * preference controls, so it is never gated by their channel choice. Only use this for those
 * events — everything else should call notifyTransactionOwner instead. */
export async function notifyBidder(args: {
  orgId: string;
  transactionId: string;
  title: string;
  body: string;
}): Promise<void> {
  await notifyTransactionOwner(args);

  try {
    const { loadResendCreds, sendEmail, renderBrandedEmail } = await import("@/lib/resend.server");
    const creds = await loadResendCreds();
    await sendEmail(creds, {
      to: ADMIN_EMAIL,
      subject: `[Bidder notification] ${args.title}`,
      html: renderBrandedEmail(`<p>${args.title}</p><p>${args.body}</p>`),
    });
  } catch {
    // Admin's copy is a courtesy, not a requirement — never blocks or surfaces as an error.
  }
}
