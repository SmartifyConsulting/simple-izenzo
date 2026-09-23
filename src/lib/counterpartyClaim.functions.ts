import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Links the signed-in person's own organisation to a transaction as its counterparty —
 * "creating an account and linking it to the deal", the thing the counterparty workspace has
 * needed since it was first discussed. Idempotent: clicking the link again once already linked to
 * the same org is a no-op, not an error. Refuses to hijack a deal already linked to a different
 * organisation, and refuses to let a bidder claim their own bid. */
export const claimCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ counterpartyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cp, error: cpErr } = await supabase
      .from("counterparties")
      .select("id, name, transaction_id, status")
      .eq("id", data.counterpartyId)
      .maybeSingle();
    if (cpErr) throw new Error(cpErr.message);
    if (!cp) throw new Error("This link is no longer valid.");
    if (cp.status !== "chosen") {
      throw new Error("This counterparty has not been chosen on this deal yet — the link isn't active.");
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .maybeSingle();
    let myOrgId = membership?.org_id as string | undefined;
    if (!myOrgId) {
      // A brand-new counterparty following this link from an email has just signed up for the
      // first time — they haven't been through (and shouldn't have to go through) a separate
      // "create your company" step before they can even see the opportunity they were invited to.
      // Give them the same lightweight personal organisation ensureOrg() creates for a bidder in
      // the same situation, named after them, rather than dead-ending here.
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
      const displayName =
        (profile as { full_name?: string | null; email?: string | null } | null)?.full_name ||
        (profile as { full_name?: string | null; email?: string | null } | null)?.email ||
        "My account";
      const { data: newOrg, error: orgErr } = await supabase
        .from("organisations")
        .insert({ name: displayName })
        .select("id")
        .single();
      if (orgErr) throw new Error(orgErr.message);
      myOrgId = newOrg.id as string;
      const { error: mErr } = await supabase.from("org_members").insert({ org_id: myOrgId, user_id: userId, role: "owner" });
      if (mErr) throw new Error(mErr.message);
      await supabase.from("profiles").update({ org_id: myOrgId }).eq("id", userId);
    }

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, org_id, counterparty_org_id, title, reference")
      .eq("id", cp.transaction_id)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("This deal is no longer available.");
    if (tx.org_id === myOrgId) {
      throw new Error("You can't accept your own bid as its counterparty.");
    }
    if (tx.counterparty_org_id && tx.counterparty_org_id !== myOrgId) {
      throw new Error(
        "Another organisation has already linked itself to this deal as the counterparty. Contact the bidder if this is unexpected.",
      );
    }

    if (tx.counterparty_org_id !== myOrgId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: upErr } = await supabaseAdmin
        .from("transactions")
        .update({ counterparty_org_id: myOrgId })
        .eq("id", tx.id);
      if (upErr) throw new Error(upErr.message);

      await supabaseAdmin.from("transaction_events").insert({
        transaction_id: tx.id,
        actor_id: userId,
        stage: "trading",
        step: "choice",
        action: "counterparty_account_linked",
        summary: `${cp.name} created an Izenzo account and linked it to this deal`,
      });

      const { notifyBidder } = await import("@/lib/bidderNotify.server");
      await notifyBidder({
        orgId: tx.org_id as string,
        transactionId: tx.id,
        title: `${cp.name} created an account and linked it to your deal`,
        body: `${tx.reference ? `${tx.reference} — ` : ""}${tx.title ?? "Your deal"}: ${cp.name} can now view the deal and respond.`,
      });
    }

    return { transactionId: tx.id as string };
  });

/** The counterparty's own accept/decline of the deal it's been linked to — the opt-out the client
 * asked for, available at any point before Proof of Intent is sealed. Never touches the sealed
 * record itself; sealProofOfIntent is what actually refuses to proceed over a declined response. */
export const respondAsCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ transactionId: z.string().uuid(), response: z.enum(["accepted", "declined"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, org_id, counterparty_org_id, title, reference, poi_sealed_at")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("This deal is no longer available.");
    if (tx.poi_sealed_at) throw new Error("Intent is already sealed — this can no longer be changed.");

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership?.org_id || membership.org_id !== tx.counterparty_org_id) {
      throw new Error("You're not linked to this deal as its counterparty.");
    }

    const { data: cp, error } = await supabase
      .from("counterparties")
      .update({
        counterparty_response: data.response,
        counterparty_responded_at: new Date().toISOString(),
      } as never)
      .eq("transaction_id", tx.id)
      .eq("status", "chosen")
      .select("name")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const cpName = (cp as { name?: string } | null)?.name ?? "The counterparty";

    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      stage: "trading",
      step: "choice",
      action: data.response === "accepted" ? "counterparty_accepted" : "counterparty_declined",
      summary: `${cpName} ${data.response} the deal`,
    });

    const { notifyBidder } = await import("@/lib/bidderNotify.server");
    await notifyBidder({
      orgId: tx.org_id as string,
      transactionId: tx.id,
      title: data.response === "accepted" ? `${cpName} accepted the deal` : `${cpName} declined the deal`,
      body:
        `${tx.reference ? `${tx.reference} — ` : ""}${tx.title ?? "Your deal"}: ` +
        (data.response === "accepted"
          ? "They've accepted and the deal can proceed."
          : "They've opted out before any binding agreement — no Proof of Intent can be sealed for this choice."),
    });

    return { response: data.response };
  });
