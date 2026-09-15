import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TOKEN_PRICE_USD = 10;
const USD_TO_ZAR = 18.5;
/** The live site PayFast must call back with the payment confirmation. */
const PUBLIC_ORIGIN = "https://reelme.co.za";


/** Starts a token purchase through PayFast. Returns the Onsite Payment reference the browser uses
 * to open the PayFast window in place. Tokens are only credited once PayFast's ITN callback
 * confirms the payment, never here. */
export const startTokenPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        tokens: z.number().int().min(1).max(1000),
        origin: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const { data: org, error: orgErr } = await supabase
      .from("organisations")
      .select("id, name")
      .eq("id", data.orgId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("That account could not be opened.");

    // PayFast requires a buyer email address on every Onsite Payment.
    let email = ((claims as { email?: string } | undefined)?.email ?? "").trim();
    if (!email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      email = ((profile as { email?: string } | null)?.email ?? "").trim();
    }
    if (!email) {
      throw new Error("Add an email address to your profile before buying tokens — PayFast needs one.");
    }

    const { loadPayFastCreds, createOnsitePayment } = await import("@/lib/payfast.server");
    const creds = await loadPayFastCreds();
    if (!creds || !creds.enabled) {
      throw new Error("Card payments are not connected yet. Add the PayFast details under Admin → Integrations.");
    }

    const amountUsd = data.tokens * TOKEN_PRICE_USD;
    const amountZar = Math.round(amountUsd * USD_TO_ZAR * 100) / 100;
    const mPaymentId = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin.from("token_purchases").insert({
      org_id: data.orgId,
      m_payment_id: mPaymentId,
      tokens: data.tokens,
      amount_zar: amountZar,
      amount_usd: amountUsd,
      status: "pending",
      created_by: userId,
    } as never);
    if (insErr) throw new Error(insErr.message);

    let uuid: string;
    try {
      uuid = await createOnsitePayment(creds, {
        amountZar,
        itemName: `${data.tokens} Izenzo token${data.tokens === 1 ? "" : "s"}`,
        mPaymentId,
        returnUrl: `${data.origin}/credits`,
        cancelUrl: `${data.origin}/credits`,
        // The payment confirmation must reach the published site, not a preview address.
        notifyUrl: `${PUBLIC_ORIGIN}/api/public/payfast/itn`,
        emailAddress: email,
      });
    } catch (err) {
      // A refused attempt must not linger as pending.
      await supabaseAdmin
        .from("token_purchases")
        .update({ status: "failed" } as never)
        .eq("m_payment_id", mPaymentId);
      throw err;
    }


    return { uuid, mPaymentId, amountZar, amountUsd };
  });


export const getTokenPurchaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ mPaymentId: z.string().min(4) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("token_purchases")
      .select("status, tokens, credited_at")
      .eq("m_payment_id", data.mPaymentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { status: row?.status ?? "pending", tokens: row?.tokens ?? 0, creditedAt: row?.credited_at ?? null };
  });

/** Whether card payment is available at all, so the page can say so plainly instead of failing on
 * the button. */
export const payfastAvailable = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { loadPayFastCreds } = await import("@/lib/payfast.server");
    const creds = await loadPayFastCreds();
    return { available: Boolean(creds?.enabled), sandbox: creds ? creds.environment !== "production" : true };
  } catch {
    return { available: false, sandbox: true };
  }
});
