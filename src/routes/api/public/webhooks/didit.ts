import { createFileRoute } from "@tanstack/react-router";

/** Didit calls this when a verification finishes. The signature is an HMAC-SHA256 of the raw
 * body using the webhook secret stored with the Didit credentials. Nothing is written before
 * that signature checks out. */
export const Route = createFileRoute("/api/public/webhooks/didit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = (request.headers.get("x-signature") ?? "").trim().toLowerCase();

        const { loadDiditCreds, mapDiditStatus, hmacHex, safeEqualHex } = await import(
          "@/lib/didit.server"
        );

        let creds;
        try {
          creds = await loadDiditCreds();
        } catch (err) {
          return new Response(
            `Didit is not set up yet: ${(err as Error).message}`,
            { status: 503 },
          );
        }
        if (!creds.webhookSecret) {
          return new Response(
            "Didit webhook secret is missing. Add it under Admin → Integrations.",
            { status: 503 },
          );
        }

        const expected = await hmacHex(creds.webhookSecret, raw);
        if (!signature || !safeEqualHex(signature, expected)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const verificationId: string | undefined = payload?.vendor_data;
        const sessionId: string | undefined = payload?.session_id;
        if (!verificationId && !sessionId) return new Response("Missing reference", { status: 400 });

        const status = mapDiditStatus(payload?.status);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const patch = {
          status,
          decision: payload?.status ?? null,
          result: payload ?? {},
          completed_at:
            status === "passed" || status === "failed" ? new Date().toISOString() : null,
        };

        const query = supabaseAdmin.from("identity_verifications").update(patch);
        const { data: rows, error } = verificationId
          ? await query
              .eq("id", verificationId)
              .select("id, transaction_id, check_type, subject_label, subject_counterparty_id, created_by")
          : await query
              .eq("provider_session_id", sessionId!)
              .select("id, transaction_id, check_type, subject_label, subject_counterparty_id, created_by");
        if (error) return new Response("Write failed", { status: 500 });

        const row = rows?.[0];
        if (row?.transaction_id) {
          await supabaseAdmin.from("transaction_events").insert({
            transaction_id: row.transaction_id,
            actor_id: "00000000-0000-0000-0000-000000000000",
            actor_name: "Verification",
            stage: "compliance",
            step: "wad",
            action: "didit_verification_result",
            summary: `Verification (${row.check_type}) result: ${status}`,
            payload: { verification_id: row.id, status, provider_status: payload?.status ?? null },
          });
        }
        if (status === "passed" && row?.subject_counterparty_id) {
          const { notifyIfFullyMatched } = await import("@/lib/matchNotify.server");
          await notifyIfFullyMatched(row.subject_counterparty_id as string);
        }
        if (row?.transaction_id && row?.created_by && (row.check_type === "id_document" || row.check_type === "kyb") && (status === "passed" || status === "failed")) {
          const { upsertDiligenceFromVerification } = await import("@/lib/engagement.functions");
          await upsertDiligenceFromVerification({
            transactionId: row.transaction_id as string,
            reviewerUserId: row.created_by as string,
            check: row.check_type === "id_document" ? "kyc" : "kyb",
            state: status,
          });
        }

        return new Response("ok");
      },
    },
  },
});
