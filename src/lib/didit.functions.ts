import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VerificationRow = {
  id: string;
  check_type: "id_document" | "kyb" | "aml";
  status: "pending" | "in_progress" | "passed" | "review" | "failed" | "expired";
  decision: string | null;
  reason: string | null;
  provider_url: string | null;
  subject_label: string | null;
  transaction_id: string | null;
  created_at: string;
  completed_at: string | null;
};

const SELECT =
  "id, check_type, status, decision, reason, provider_url, subject_label, transaction_id, created_at, completed_at";

/** My own identity verifications (Account settings). */
export const listMyVerifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VerificationRow[]> => {
    const { data, error } = await context.supabase
      .from("identity_verifications")
      .select(SELECT)
      .eq("subject_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as VerificationRow[];
  });

/** Verifications attached to one deal (WaD gate). RLS scopes this to the caller's org. */
export const listVerificationsForTx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<VerificationRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("identity_verifications")
      .select(SELECT)
      .eq("transaction_id", data.transactionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as VerificationRow[];
  });

const startInput = (d: unknown) =>
  z
    .object({
      checkType: z.enum(["id_document", "kyb", "aml"]),
      /** Omit for a self-check; supply a deal id for a counterparty check at the WaD gate. */
      transactionId: z.string().uuid().optional(),
      origin: z.string().url().optional(),
    })
    .parse(d);

/** Open a Didit session. Returns the hosted verification URL to send the person to. */
export const startVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(startInput)
  .handler(async ({ data, context }): Promise<{ id: string; url: string }> => {
    const { loadDiditCreds, createDiditSession } = await import("@/lib/didit.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let subjectOrgId: string | null = null;
    let subjectCounterpartyId: string | null = null;
    let subjectLabel: string | null = null;

    if (data.transactionId) {
      // RLS on the caller's client proves they may see this deal.
      const { data: tx, error } = await context.supabase
        .from("transactions")
        .select("id, org_id, title")
        .eq("id", data.transactionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!tx) throw new Error("You don't have access to this deal.");
      subjectOrgId = tx.org_id as string;
      subjectLabel = tx.title as string;

      const { data: cp } = await context.supabase
        .from("counterparties")
        .select("id, name")
        .eq("transaction_id", data.transactionId)
        .eq("status", "chosen")
        .maybeSingle();
      if (cp) {
        subjectCounterpartyId = cp.id as string;
        subjectLabel = cp.name as string;
      }
    } else {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("full_name, email, org_id")
        .eq("id", context.userId)
        .maybeSingle();
      subjectOrgId = (profile?.org_id as string | null) ?? null;
      subjectLabel = (profile?.full_name as string | null) ?? (profile?.email as string | null) ?? null;
    }

    const creds = await loadDiditCreds();
    if (!creds.enabled) throw new Error("Didit is switched off under Admin → Integrations.");

    const { data: row, error: insErr } = await supabaseAdmin
      .from("identity_verifications")
      .insert({
        check_type: data.checkType,
        subject_user_id: data.transactionId ? null : context.userId,
        subject_org_id: subjectOrgId,
        subject_counterparty_id: subjectCounterpartyId,
        transaction_id: data.transactionId ?? null,
        subject_label: subjectLabel,
        status: "pending",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    try {
      const session = await createDiditSession(creds, {
        checkType: data.checkType,
        vendorData: row.id as string,
        ...(data.origin ? { callbackUrl: `${data.origin}/account/settings` } : {}),
      });
      await supabaseAdmin
        .from("identity_verifications")
        .update({
          provider_session_id: session.sessionId,
          provider_url: session.url,
          status: "in_progress",
        })
        .eq("id", row.id);

      if (data.transactionId) {
        await supabaseAdmin.from("transaction_events").insert({
          transaction_id: data.transactionId,
          actor_id: context.userId,
          stage: "compliance",
          step: "wad",
          action: "didit_verification_started",
          summary: `Didit ${data.checkType} check opened for ${subjectLabel ?? "counterparty"}`,
          payload: { verification_id: row.id, check_type: data.checkType },
        });
      }

      return { id: row.id as string, url: session.url };
    } catch (err) {
      await supabaseAdmin
        .from("identity_verifications")
        .update({ status: "review", reason: (err as Error).message })
        .eq("id", row.id);
      throw err;
    }
  });

/** Pull the latest decision from Didit for one verification (in case the callback is late). */
export const refreshVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<VerificationRow> => {
    // Read through the caller's client first so RLS enforces who may look.
    const { data: mine, error } = await context.supabase
      .from("identity_verifications")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!mine) throw new Error("Verification not found.");

    const { loadDiditCreds, fetchDiditDecision, mapDiditStatus } = await import("@/lib/didit.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("identity_verifications")
      .select("provider_session_id")
      .eq("id", data.id)
      .maybeSingle();
    const sessionId = row?.provider_session_id as string | null;
    if (!sessionId) throw new Error("This verification has no Didit session yet.");

    const creds = await loadDiditCreds();
    const decision = await fetchDiditDecision(creds, sessionId);
    const status = mapDiditStatus(decision?.status);

    const { data: updated, error: upErr } = await supabaseAdmin
      .from("identity_verifications")
      .update({
        status,
        decision: decision?.status ?? null,
        result: decision ?? {},
        completed_at:
          status === "passed" || status === "failed" ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .select(SELECT)
      .single();
    if (upErr) throw new Error(upErr.message);
    return updated as VerificationRow;
  });
