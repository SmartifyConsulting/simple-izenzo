import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TOKEN_PRICE_USD = 10;
const USD_TO_ZAR = 18.5;

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
    const { supabase, userId } = context;

    const { data: org, error: orgErr } = await supabase
      .from("organisations")
      .select("id, name")
      .eq("id", data.orgId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("That account could not be opened.");

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

    const uuid = await createOnsitePayment(creds, {
      amountZar,
      itemName: `${data.tokens} Izenzo token${data.tokens === 1 ? "" : "s"}`,
      mPaymentId,
      returnUrl: `${data.origin}/credits`,
      cancelUrl: `${data.origin}/credits`,
      notifyUrl: `${data.origin}/api/public/payfast/itn`,
    });

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
