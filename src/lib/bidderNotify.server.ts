/** Server-only. Raises an in-app Inbox notification for a bidder's organisation, and — while
 * Admin wants visibility on these "for now" — sends Admin a copy by email at the same time,
 * standing in for a bcc since there isn't always an outbound email to actually bcc onto (e.g. an
 * account-created or verified notification has no email of its own to attach to). Never throws:
 * a notification failing must never break the real action (sending an email, recording a match)
 * that triggered it. */

const ADMIN_EMAIL = "support@izenzo.co.za";

export async function notifyBidder(args: {
  orgId: string;
  transactionId: string;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      org_id: args.orgId,
      transaction_id: args.transactionId,
      title: args.title,
      body: args.body,
    });
  } catch {
    // An Inbox notification is never worth failing the real action for.
  }

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
