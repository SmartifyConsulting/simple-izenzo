import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { decideClaimOrg } from "@/lib/claimOrg";

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

    // Read both the counterparty row and the deal it belongs to through the admin client, not the
    // caller's: both tables' RLS policies only grant a select once transactions.counterparty_org_id
    // already names one of the caller's companies, which is exactly what this handler is about to
    // write — the whole point of a claim link is reaching a row the caller can't see yet. Through
    // the caller's own client, `cp` read back as absent for every brand-new claim, failing with
    // "This link is no longer valid." before the person had any chance to link their org. Nothing
    // is returned from here beyond what the caller already holds a link to.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cp, error: cpErr } = await supabaseAdmin
      .from("counterparties")
      .select("id, name, transaction_id, status")
      .eq("id", data.counterpartyId)
      .maybeSingle();
    if (cpErr) throw new Error(cpErr.message);
    if (!cp) throw new Error("This link is no longer valid.");
    if (cp.status !== "chosen") {
      throw new Error("This counterparty has not been chosen on this deal yet — the link isn't active.");
    }

    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("id, org_id, counterparty_org_id, title, reference")
      .eq("id", cp.transaction_id)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("This deal is no longer available.");

    // Every company this person trades through, plus the one their profile currently points at.
    // Deliberately a list, not `.maybeSingle()`: that errors once someone is in two companies, and
    // the caller below used to read the resulting null as "has no company" and create another one on
    // every click.
    const { data: memberships, error: memErr } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId);
    if (memErr) throw new Error(memErr.message);

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("org_id, full_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);

    const decision = decideClaimOrg({
      myOrgIds: (memberships ?? []).map((m) => m.org_id as string),
      profileOrgId: (profile as { org_id?: string | null } | null)?.org_id ?? null,
      dealOrgId: tx.org_id as string,
      dealCounterpartyOrgId: tx.counterparty_org_id as string | null,
    });

    if (decision.action === "refuse") {
      throw new Error(
        decision.reason === "self"
          ? "You can't accept your own bid as its counterparty."
          : "Another organisation has already linked itself to this deal as the counterparty. Contact the bidder if this is unexpected.",
      );
    }

    if (decision.action === "already-linked") {
      // Idempotent by contract: the deal already names this person's company, so there is nothing to
      // change and no event to append. Re-clicking the same link must not look like a new link.
      return { transactionId: tx.id as string };
    }

    let myOrgId: string;
    if (decision.action === "create") {
      // A brand-new counterparty following this link from an email has just signed up for the first
      // time — they haven't been through (and shouldn't have to go through) a separate "create your
      // company" step before they can even see the opportunity they were invited to. Give them the
      // same lightweight personal organisation ensureOrg() creates for a bidder in the same
      // situation, named after them, rather than dead-ending here.
      //
      // Only reached now when the person genuinely belongs to no company: the refusals above are
      // decided first, so a click that was going to be rejected can no longer leave a company behind.
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
      const { error: mErr } = await supabase
        .from("org_members")
        .insert({ org_id: myOrgId, user_id: userId, role: "owner" });
      if (mErr) throw new Error(mErr.message);
      await supabase.from("profiles").update({ org_id: myOrgId }).eq("id", userId);
    } else {
      myOrgId = decision.orgId;
      // The company is already a membership; this only re-points the profile if it had gone stale,
      // so the counterparty workspace and the bidder side agree on which company is active.
      if ((profile as { org_id?: string | null } | null)?.org_id !== myOrgId) {
        await supabase.from("profiles").update({ org_id: myOrgId }).eq("id", userId);
      }
    }

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
      title: `${cp.name} is verified and linked to your deal`,
      body: `${tx.reference ? `${tx.reference} — ` : ""}${tx.title ?? "Your deal"}: ${cp.name} created and verified their Izenzo account. You can now run KYC/KYB verification on them at the Without a Doubt gate, and they can do the same on you.`,
      kind: "counterparty_verified",
    });

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

    // Membership as a list: `.maybeSingle()` errors once the person trades through more than one
    // company, which would have locked them out of accepting or declining this deal entirely.
    const { data: memberships, error: memErr } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId);
    if (memErr) throw new Error(memErr.message);
    const isLinkedCounterparty = (memberships ?? []).some((m) => m.org_id === tx.counterparty_org_id);
    if (!tx.counterparty_org_id || !isLinkedCounterparty) {
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
