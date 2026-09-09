import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ScreeningCheck = {
  /** Which check ran. */
  kind: "id_document" | "kyb" | "aml" | "registry";
  label: string;
  status: "started" | "matched" | "no_match" | "unavailable" | "failed";
  detail: string;
  /** Hosted Didit link, when the provider returned one. */
  url?: string;
  /** The stored verification row, so the UI can follow this check to its result. */
  verificationId?: string;
};


export type ScreeningResult = {
  counterpartyId: string;
  name: string;
  checks: ScreeningCheck[];
};

const DIDIT_CHECKS = [
  { kind: "id_document", label: "ID document + selfie" },
  { kind: "kyb", label: "Company (KYB)" },
  { kind: "aml", label: "Sanctions / PEP" },
] as const;

/** Runs background screening for the counterparties a bidder/responder shortlisted: a registry
 * lookup against the company register we already hold, plus Didit ID, KYB and AML sessions per
 * counterparty. Nothing here changes gates, token costs, or the deal's step — screening is the
 * "runs quietly" background step of the Proof of Intent gate. */
export const runBackgroundScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionId: z.string().uuid(),
        counterpartyIds: z.array(z.string().uuid()).min(1).max(20),
        origin: z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ScreeningResult[]> => {
    const { supabase, userId } = context;

    // RLS proves the caller may see this deal and these candidates.
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, org_id")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("You don't have access to this deal.");

    const { data: rows, error: cpErr } = await supabase
      .from("counterparties")
      .select("id, name, jurisdiction")
      .eq("transaction_id", data.transactionId)
      .in("id", data.counterpartyIds);
    if (cpErr) throw new Error(cpErr.message);
    const counterparties = rows ?? [];
    if (counterparties.length === 0) throw new Error("None of those counterparties belong to this deal.");

    const { loadDiditCreds, createDiditSession } = await import("@/lib/didit.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let creds: Awaited<ReturnType<typeof loadDiditCreds>> | null = null;
    let credsError: string | null = null;
    try {
      creds = await loadDiditCreds();
      if (!creds.enabled) {
        credsError = "Didit is switched off under Admin → Integrations.";
        creds = null;
      }
    } catch (err) {
      credsError = (err as Error).message;
    }

    const results: ScreeningResult[] = [];

    for (const cp of counterparties) {
      const checks: ScreeningCheck[] = [];

      // 1. Registry lookup — the company register we already hold.
      try {
        const { data: hits, error } = await supabase
          .from("registry_companies")
          .select("legal_name, country, registration_no, readiness_state")
          .ilike("legal_name", `%${cp.name}%`)
          .limit(3);
        if (error) throw new Error(error.message);
        if (hits && hits.length > 0) {
          checks.push({
            kind: "registry",
            label: "Registry lookup",
            status: "matched",
            detail: hits
              .map((h) =>
                [h.legal_name, h.registration_no, h.country].filter(Boolean).join(" · "),
              )
              .join("\n"),

          });
        } else {
          checks.push({
            kind: "registry",
            label: "Registry lookup",
            status: "no_match",
            detail: "No company register entry found under that name.",
          });
        }
      } catch (err) {
        checks.push({
          kind: "registry",
          label: "Registry lookup",
          status: "failed",
          detail: (err as Error).message,
        });
      }

      // 2. Didit ID / KYB / AML.
      for (const check of DIDIT_CHECKS) {
        if (!creds) {
          checks.push({
            kind: check.kind,
            label: check.label,
            status: "unavailable",
            detail: credsError ?? "Didit is not connected yet.",
          });
          continue;
        }

        // Reuse the newest finished result for this counterparty and check type — opening a fresh
        // provider session on every run is what made already-cleared checks read as "waiting".
        const { data: settled } = await supabaseAdmin
          .from("identity_verifications")
          .select("id, status, reason")
          .eq("subject_counterparty_id", cp.id)
          .eq("check_type", check.kind)
          .in("status", ["passed", "failed", "review"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (settled) {
          checks.push({
            kind: check.kind,
            label: check.label,
            status: settled.status === "passed" ? "matched" : settled.status === "failed" ? "no_match" : "started",
            detail:
              (settled.reason as string | null) ??
              (settled.status === "passed"
                ? "Provider returned a clear result."
                : settled.status === "failed"
                  ? "Provider returned a negative result."
                  : "A person needs to look at this result."),
            verificationId: settled.id as string,
          });
          continue;
        }

        const { data: row, error: insErr } = await supabaseAdmin
          .from("identity_verifications")
          .insert({
            check_type: check.kind,
            subject_org_id: tx.org_id as string,
            subject_counterparty_id: cp.id,
            transaction_id: data.transactionId,
            subject_label: cp.name,
            status: "pending",
            created_by: userId,
          })
          .select("id")
          .single();
        if (insErr) {
          checks.push({
            kind: check.kind,
            label: check.label,
            status: "failed",
            detail: insErr.message,
          });
          continue;
        }

        try {
          const session = await createDiditSession(creds, {
            checkType: check.kind,
            vendorData: row.id as string,
            ...(data.origin ? { callbackUrl: `${data.origin}/live-deal-engine` } : {}),
          });
          await supabaseAdmin
            .from("identity_verifications")
            .update({
              provider_session_id: session.sessionId,
              provider_url: session.url,
              status: "in_progress",
            })
            .eq("id", row.id);
          checks.push({
            kind: check.kind,
            label: check.label,
            status: "started",
            detail: "Screening opened — the result lands here on its own.",
            url: session.url,
            verificationId: row.id as string,
          });
        } catch (err) {
          await supabaseAdmin
            .from("identity_verifications")
            .update({ status: "review", reason: (err as Error).message })
            .eq("id", row.id);
          checks.push({
            kind: check.kind,
            label: check.label,
            status: "failed",
            detail: (err as Error).message,
            verificationId: row.id as string,
          });
        }

      }

      await supabaseAdmin.from("transaction_events").insert({
        transaction_id: data.transactionId,
        actor_id: userId,
        stage: "trading",
        step: "media",
        action: "background_screening_started",
        summary: `Background screening run for ${cp.name}`,
        payload: { counterparty_id: cp.id, checks },
      });

      results.push({ counterpartyId: cp.id, name: cp.name, checks });
    }

    return results;
  });
