import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

/** Sends the sign-up confirmation / email-confirm link through Resend (branded Izenzo email)
 * instead of the backend's rate-limited default mailer. Only sends to accounts that already exist,
 * and only to a same-site path, so it can't be used to mail arbitrary links. */
export const sendAuthLinkEmail = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        path: z.string().startsWith("/").refine((p) => !p.startsWith("//")).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const req = getRequest();
    const origin = req ? new URL(req.url).origin : "https://izenzo-onthe-stepper.lovable.app";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
      options: { redirectTo: `${origin}${data.path}` },
    });
    // Don't reveal whether the account exists.
    if (error || !link?.properties?.action_link) return { ok: true };
    const url = link.properties.action_link;
    const { loadResendCreds, sendEmail, renderBrandedEmail } = await import("@/lib/resend.server");
    const creds = await loadResendCreds();
    await sendEmail(creds, {
      to: data.email,
      subject: "Confirm your email for Izenzo",
      html: renderBrandedEmail(`
        <p>Hello,</p>
        <p>Please confirm your email address to continue setting up your Izenzo account.</p>
        <p style="margin:24px 0;"><a href="${url}" style="background:#14b8a6;color:#0d0f14;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Confirm my email</a></p>
        <p style="font-size:12px;color:#6b7280;">If the button doesn't work, copy this link into your browser:<br/>${url}</p>
        <p>Kind regards,<br/>Izenzo Trading</p>`),
    });
    return { ok: true };
  });
