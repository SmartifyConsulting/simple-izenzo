import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

/** Sends the sign-up confirmation / email-confirm link through Resend (branded Izenzo email)
 * instead of the backend's rate-limited default mailer. Only sends to accounts that already exist,
 * and only to a same-site path, so it can't be used to mail arbitrary links. The link points back
 * to whichever site the request came from, so preview sign-ups stay in the preview. */
export const sendAuthLinkEmail = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        path: z.string().max(500).startsWith("/").refine((p) => !p.startsWith("//")),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; sent: boolean; error?: string }> => {
    const req = getRequest();
    const origin = req ? new URL(req.url).origin : "https://izenzo-onthe-stepper.lovable.app";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
      options: { redirectTo: `${origin}${data.path}` },
    });
    // Don't reveal whether the account exists — but log why nothing was sent.
    if (error || !link?.properties?.action_link) {
      console.error("[authEmail] could not create confirmation link:", error?.message ?? "no link");
      return { ok: true, sent: false };
    }
    const url = link.properties.action_link;
    try {
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
      console.log("[authEmail] confirmation email sent via Resend to", data.email);
      return { ok: true, sent: true };
    } catch (e) {
      const msg = (e as Error).message;
      console.error("[authEmail] Resend send failed:", msg);
      return { ok: false, sent: false, error: msg };
    }
  });
