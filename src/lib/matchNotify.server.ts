/** Raises one Inbox notification per counterparty that has come back clear on every background
 * check — registry, ID document, company (KYB) and sanctions/PEP. Called from the screening run,
 * from the manual refresh, and from the Didit webhook, so whichever path settles the last check
 * is the one that writes it. Server-only: uses the service-role client. */

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";
const REQUIRED_CHECKS = ["id_document", "kyb", "aml"] as const;

export async function notifyIfFullyMatched(counterpartyId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cp } = await supabaseAdmin
      .from("counterparties")
      .select("id, name, transaction_id")
      .eq("id", counterpartyId)
      .maybeSingle();
    if (!cp?.transaction_id) return;

    // Every Didit check must have settled as passed.
    const { data: verifications } = await supabaseAdmin
      .from("identity_verifications")
      .select("check_type, status")
      .eq("subject_counterparty_id", cp.id);
    const passed = new Set(
      (verifications ?? []).filter((v) => v.status === "passed").map((v) => String(v.check_type)),
    );
    if (!REQUIRED_CHECKS.every((c) => passed.has(c))) return;

    // …and the company register must know them.
    const { data: registryHits } = await supabaseAdmin
      .from("registry_companies")
      .select("id")
      .ilike("legal_name", `%${cp.name}%`)
      .limit(1);
    if (!registryHits || registryHits.length === 0) return;

    // Written once per counterparty: a later refresh of the same results must not repeat it.
    const { data: already } = await supabaseAdmin
      .from("transaction_events")
      .select("id")
      .eq("transaction_id", cp.transaction_id)
      .eq("action", "counterparty_full_match_notified")
      .contains("payload", { counterparty_id: cp.id })
      .limit(1)
      .maybeSingle();
    if (already) return;

    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("id, org_id, title, reference")
      .eq("id", cp.transaction_id)
      .maybeSingle();
    if (!tx) return;

    const { notifyTransactionOwner } = await import("@/lib/bidderNotify.server");
    await notifyTransactionOwner({
      orgId: tx.org_id,
      transactionId: tx.id,
      title: `${cp.name} matched on all checks`,
      body: `${tx.reference ? `${tx.reference} — ` : ""}${tx.title}: registry, ID document, company and sanctions checks all came back clear. Open the deal to choose who to proceed with.`,
    });

    await supabaseAdmin.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: SYSTEM_ACTOR,
      actor_name: "Izenzo",
      stage: "trading",
      step: "media",
      action: "counterparty_full_match_notified",
      summary: `${cp.name} matched on all checks`,
      payload: { counterparty_id: cp.id },
    });
  } catch {
    // A notification is never worth failing the screening or the webhook for.
  }
}
