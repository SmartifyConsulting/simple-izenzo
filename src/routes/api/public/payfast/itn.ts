import { createFileRoute } from "@tanstack/react-router";

/** PayFast Instant Transaction Notification. This is the only place tokens are actually credited:
 * the payload's signature is verified against the stored passphrase, the amount is matched against
 * the pending purchase, and the credit is applied once per PayFast payment id. */
export const Route = createFileRoute("/api/public/payfast/itn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const params = new URLSearchParams(body);
        const raw: Record<string, string> = {};
        for (const [k, v] of params.entries()) raw[k] = v;

        const { loadPayFastCreds, itnSignatureValid } = await import("@/lib/payfast.server");
        const creds = await loadPayFastCreds();
        if (!creds) return new Response("Not configured", { status: 503 });
        if (!itnSignatureValid(raw, creds.passphrase)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const mPaymentId = raw["m_payment_id"] ?? "";
        const pfPaymentId = raw["pf_payment_id"] ?? "";
        const status = raw["payment_status"] ?? "";
        const grossAmount = Number(raw["amount_gross"] ?? "0");
        if (!mPaymentId) return new Response("Missing payment reference", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: purchase, error } = await supabaseAdmin
          .from("token_purchases")
          .select("*")
          .eq("m_payment_id", mPaymentId)
          .maybeSingle();
        if (error) return new Response("Lookup failed", { status: 500 });
        if (!purchase) return new Response("Unknown payment", { status: 404 });

        // Already handled — PayFast retries the same notification, and tokens are credited once.
        if (purchase.status === "complete") return new Response("ok");

        if (status !== "COMPLETE") {
          await supabaseAdmin
            .from("token_purchases")
            .update({ status: status === "CANCELLED" ? "cancelled" : "failed", pf_payment_id: pfPaymentId } as never)
            .eq("id", purchase.id);
          return new Response("ok");
        }

        if (Math.abs(Number(purchase.amount_zar) - grossAmount) > 0.05) {
          await supabaseAdmin
            .from("token_purchases")
            .update({ status: "failed", pf_payment_id: pfPaymentId } as never)
            .eq("id", purchase.id);
          return new Response("Amount mismatch", { status: 400 });
        }

        const { error: creditErr } = await supabaseAdmin.rpc("atomic_token_adjust", {
          p_org_id: purchase.org_id,
          p_delta: purchase.tokens,
          p_reason: `Purchased ${purchase.tokens} token${purchase.tokens === 1 ? "" : "s"} (PayFast ${pfPaymentId})`,
        });
        if (creditErr) return new Response("Credit failed", { status: 500 });

        await supabaseAdmin
          .from("token_purchases")
          .update({ status: "complete", pf_payment_id: pfPaymentId, credited_at: new Date().toISOString() } as never)
          .eq("id", purchase.id);

        return new Response("ok");
      },
    },
  },
});
