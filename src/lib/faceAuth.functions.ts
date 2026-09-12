import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Face sign-in: someone types their email, we open a Didit identity/liveness session, and once
 * Didit approves the face we mint a single-use email link server-side and hand its token back so
 * the browser can turn it into a session. No password, no document upload, no search needed.
 *
 * Nothing here trusts the browser: the decision is read straight from Didit with our own API key,
 * and every attempt is single-use and time limited. */

export type FaceSignInStart = { attemptId: string; url: string };
export type FaceSignInPoll =
  | { state: "waiting" }
  | { state: "failed"; reason: string }
  | { state: "ready"; tokenHash: string };

const emailSchema = z.object({ email: z.string().email(), origin: z.string().url().optional() });

export const startFaceSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => emailSchema.parse(d))
  .handler(async ({ data }): Promise<FaceSignInStart> => {
    const email = data.email.trim().toLowerCase();
    const { loadDiditCreds, createDiditSession } = await import("@/lib/didit.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();
    if (!profile) {
      throw new Error("We don't have an account with that email address yet.");
    }

    const creds = await loadDiditCreds();
    if (!creds.enabled) throw new Error("Face sign-in is switched off right now. Use your password instead.");

    const { data: attempt, error: insErr } = await supabaseAdmin
      .from("face_sign_in_attempts")
      .insert({ email, user_id: profile.id as string, status: "pending" })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    try {
      const session = await createDiditSession(creds, {
        checkType: "id_document",
        vendorData: `face:${attempt.id as string}`,
        contactEmail: email,
        ...(data.origin ? { callbackUrl: `${data.origin}/auth` } : {}),
      });
      await supabaseAdmin
        .from("face_sign_in_attempts")
        .update({
          provider_session_id: session.sessionId,
          provider_url: session.url,
          status: "in_progress",
        })
        .eq("id", attempt.id as string);
      return { attemptId: attempt.id as string, url: session.url };
    } catch (err) {
      await supabaseAdmin
        .from("face_sign_in_attempts")
        .update({ status: "failed", reason: (err as Error).message })
        .eq("id", attempt.id as string);
      throw err;
    }
  });

export const pollFaceSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ attemptId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<FaceSignInPoll> => {
    const { loadDiditCreds, fetchDiditDecision, mapDiditStatus } = await import("@/lib/didit.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: attempt } = await supabaseAdmin
      .from("face_sign_in_attempts")
      .select("id, email, provider_session_id, status, consumed_at, expires_at")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (!attempt) return { state: "failed", reason: "That sign-in attempt is no longer valid." };
    if (attempt.consumed_at) return { state: "failed", reason: "That face check was already used." };
    if (new Date(attempt.expires_at as string).getTime() < Date.now()) {
      return { state: "failed", reason: "The face check timed out. Please start again." };
    }
    const sessionId = attempt.provider_session_id as string | null;
    if (!sessionId) return { state: "waiting" };

    const creds = await loadDiditCreds();
    const decision = await fetchDiditDecision(creds, sessionId);
    const raw = (decision as { status?: string } | null)?.status ?? null;
    const status = mapDiditStatus(raw);

    if (status !== "passed") {
      if (status === "failed" || status === "expired") {
        await supabaseAdmin
          .from("face_sign_in_attempts")
          .update({ status, decision: raw })
          .eq("id", attempt.id as string);
        return { state: "failed", reason: "We couldn't match your face. Try again or use your password." };
      }
      return { state: "waiting" };
    }

    const email = attempt.email as string;
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      return { state: "failed", reason: "Face check passed, but we couldn't open your session. Use your password." };
    }

    await supabaseAdmin
      .from("face_sign_in_attempts")
      .update({ status: "passed", decision: raw, consumed_at: new Date().toISOString() })
      .eq("id", attempt.id as string);

    return { state: "ready", tokenHash: link.properties.hashed_token };
  });
