/** Server-only. Notifies the person who owns a transaction — email, in-app, or both, whichever
 * they chose in Account Settings → Notification Preferences (defaulting to both when unset).
 * Never throws: a notification failing must never break the real action (sending an email,
 * recording a match) that triggered it. */

const ADMIN_EMAIL = "support@izenzo.co.za";

export type NotifyChannel = "email" | "in_app" | "both";

/** Matches the checkbox keys in src/components/account/NotificationPreferences.tsx. Passing a
 * `kind` lets a caller be opted out of specifically; omitting it (most callers) always sends,
 * unchanged from before per-type opt-outs existed. */
export type NotificationTypeKey =
  | "new_bid_or_offer"
  | "poi_sealed"
  | "wad_attention"
  | "low_token_balance"
  | "counterparty_emailed"
  | "counterparty_verified";

type Recipient = {
  userId: string;
  email: string | null;
  channel: NotifyChannel;
  subscriptions: Partial<Record<NotificationTypeKey, boolean>>;
};

/** The transaction's own creator — "the bidder" for every notification this file sends. */
async function resolveRecipient(supabaseAdmin: any, transactionId: string): Promise<Recipient | null> {
  try {
    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("created_by")
      .eq("id", transactionId)
      .maybeSingle();
    if (!tx?.created_by) return null;
    // notification_channel/notification_subscriptions predate the generated Supabase types being
    // refreshed — read the whole row and cast, rather than name the columns directly, so this
    // degrades to the defaults instead of throwing if a migration hasn't run yet in this environment.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", tx.created_by)
      .maybeSingle();
    const row = profile as {
      email?: string | null;
      notification_channel?: NotifyChannel | null;
      notification_subscriptions?: Partial<Record<NotificationTypeKey, boolean>> | null;
    } | null;
    return {
      userId: tx.created_by,
      email: row?.email ?? null,
      channel: row?.notification_channel ?? "both",
      subscriptions: row?.notification_subscriptions ?? {},
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
  /** One of the checkbox types in Notification Preferences — omit for events that aren't
   * individually switchable there (everything before per-type opt-outs existed). */
  kind?: NotificationTypeKey;
  /** Writes the Inbox/on-screen notification regardless of the recipient's channel preference —
   * for the handful of events (an offer being accepted) that are governance milestones someone
   * should never miss just because they set their preference to email-only. Email still follows
   * their own preference either way. */
  force?: boolean;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const recipient = await resolveRecipient(supabaseAdmin, args.transactionId);
    // A missing key means "subscribed" — the checkbox defaults to ticked.
    if (args.kind && recipient?.subscriptions[args.kind] === false) return;
    const channel = recipient?.channel ?? "both";

    if (args.force || channel === "in_app" || channel === "both") {
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
  kind?: NotificationTypeKey;
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

/** Tells the counterparty side, inside the app, that they have been matched to a deal.
 *
 * The match email goes to the counterparty's contact address; if that address belongs to an Izenzo
 * account, this writes the same news into that account's Inbox so it is visible in the app and not
 * only in their mail. No account for that address means there is nothing to write, and nothing here
 * ever fails the match itself. */
export async function notifyCounterpartyContact(args: {
  email: string;
  transactionId: string;
  title: string;
  body: string;
  /** Writes the Inbox/on-screen notification even if this person's preference is email-only —
   * see notifyTransactionOwner's own `force` for why. */
  force?: boolean;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .ilike("email", args.email.trim())
      .maybeSingle();
    const row = profile as { id?: string | null; org_id?: string | null } | null;
    if (!row?.id) return;
    const channel = await getNotificationChannel(supabaseAdmin, row.id);
    if (channel === "email" && !args.force) return; // They asked for email only, which they have already had.
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: row.id,
      ...(row.org_id ? { org_id: row.org_id } : {}),
      transaction_id: args.transactionId,
      title: args.title,
      body: args.body,
    });
    if (error) console.error("[notifyCounterpartyContact] inbox write failed:", error.message);
  } catch (e) {
    console.error("[notifyCounterpartyContact] failed:", e instanceof Error ? e.message : e);
  }
}
