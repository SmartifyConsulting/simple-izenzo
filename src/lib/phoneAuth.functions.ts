import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const phoneSchema = z.string().min(6).max(24);

async function helpers() {
  return import("@/lib/phoneAuth.server");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function profileByPhone(phone: string) {
  const { data } = await (await admin())
    .from("profiles")
    .select("id, phone_verified_at")
    .eq("phone", phone)
    .maybeSingle();
  return data;
}

/** Sends a sign-up or password-reset code. Reset never reveals whether the number is registered. */
export const sendPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ phone: phoneSchema, purpose: z.enum(["signup", "reset"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const h = await helpers();
    const phone = h.normalisePhone(data.phone);
    const existing = await profileByPhone(phone);
    if (data.purpose === "signup" && existing) {
      throw new Error("This number already has an account. Sign in instead.");
    }
    if (data.purpose === "reset" && !existing) return { ok: true };
    await h.issueOtp(phone, data.purpose, existing?.id ?? null);
    return { ok: true };
  });

export const completePhoneSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        phone: phoneSchema,
        code: z.string().min(4).max(8),
        password: z.string().min(8).max(128),
        fullName: z.string().max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const h = await helpers();
    const phone = h.normalisePhone(data.phone);
    if (await profileByPhone(phone)) throw new Error("This number already has an account. Sign in instead.");
    await h.consumeOtp(phone, "signup", data.code);
    const db = await admin();
    const { data: created, error } = await db.auth.admin.createUser({
      email: h.syntheticEmail(phone),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone, signup_method: "phone" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account.");
    const now = new Date().toISOString();
    await db
      .from("profiles")
      .update({ phone, phone_verified_at: now, email_verified_at: now, email: null } as never)
      .eq("id", created.user.id);
    return { ok: true };
  });

/** Signs in with phone + password server-side and hands the session back, so the internal login
 * behind a phone number is never exposed to the browser. */
export const phoneSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ phone: phoneSchema, password: z.string().min(1).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const h = await helpers();
    const bad = "Phone number or password is incorrect.";
    let phone: string;
    try {
      phone = h.normalisePhone(data.phone);
    } catch {
      throw new Error(bad);
    }
    const prof = await profileByPhone(phone);
    if (!prof?.phone_verified_at) throw new Error(bad);
    const db = await admin();
    const { data: u } = await db.auth.admin.getUserById(prof.id);
    const email = u.user?.email;
    if (!email) throw new Error(bad);
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const hd = new Headers(init?.headers);
          if (key.startsWith("sb_") && hd.get("Authorization") === `Bearer ${key}`) hd.delete("Authorization");
          hd.set("apikey", key);
          return fetch(input, { ...init, headers: hd });
        },
      },
    });
    const { data: s, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || !s.session) throw new Error(bad);
    return { access_token: s.session.access_token, refresh_token: s.session.refresh_token };
  });

export const resetPasswordWithOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ phone: phoneSchema, code: z.string().min(4).max(8), password: z.string().min(8).max(128) }).parse(d),
  )
  .handler(async ({ data }) => {
    const h = await helpers();
    const phone = h.normalisePhone(data.phone);
    const prof = await profileByPhone(phone);
    if (!prof) throw new Error("That code has expired. Ask for a new one.");
    await h.consumeOtp(phone, "reset", data.code);
    const { error } = await (await admin()).auth.admin.updateUserById(prof.id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Existing email accounts: send a code to the number they want to add. */
export const sendLinkPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await helpers();
    const phone = h.normalisePhone(data.phone);
    const existing = await profileByPhone(phone);
    if (existing && existing.id !== context.userId) throw new Error("This number is already used by another account.");
    await h.issueOtp(phone, "link", context.userId);
    return { ok: true };
  });

export const confirmLinkPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: phoneSchema, code: z.string().min(4).max(8) }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await helpers();
    const phone = h.normalisePhone(data.phone);
    await h.consumeOtp(phone, "link", data.code, context.userId);
    const { error } = await (await admin())
      .from("profiles")
      .update({ phone, phone_verified_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message.includes("unique") ? "This number is already used by another account." : error.message);
    return { ok: true };
  });
