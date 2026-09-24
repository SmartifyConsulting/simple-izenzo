import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PartyRegistrationInfo = {
  side: "bidder" | "counterparty";
  fullName: string | null;
  accountType: "company" | "individual" | null;
  idNumberType: "id" | "passport" | null;
  /** All but the last four characters replaced with a bullet — the counterparty's ID/passport
   * number is shown here to build trust between two parties who may otherwise have never met, not
   * so either side can copy the other's full number down. */
  idNumberMasked: string | null;
  documentLabel: "Authority to Act" | "Proof of Residential Address";
  documentName: string | null;
  identityVerified: boolean;
};

function maskId(idNumber: string): string {
  const trimmed = idNumber.trim();
  if (trimmed.length <= 4) return "•".repeat(trimmed.length);
  return "•".repeat(trimmed.length - 4) + trimmed.slice(-4);
}

/** The registration-time identity of each side of a deal — ID/passport number (masked) and which
 * document they were asked for (Authority to Act for a company, Proof of Residential Address for
 * an individual) — shown at the WaD gate so each party can see who they're actually dealing with
 * alongside the live KYC/KYB checks. Restricted to the deal's own two organisations: reads through
 * the admin client (profiles' own RLS is self-only), but only after confirming the caller actually
 * belongs to one of them. */
export const getPartyRegistrationInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PartyRegistrationInfo[]> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("org_id, counterparty_org_id")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) return [];

    const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", userId);
    const myOrgIds = new Set((memberships ?? []).map((m) => m.org_id as string));
    const bidderOrgId = tx.org_id as string | null;
    const counterpartyOrgId = tx.counterparty_org_id as string | null;
    const allowed = (bidderOrgId && myOrgIds.has(bidderOrgId)) || (counterpartyOrgId && myOrgIds.has(counterpartyOrgId));
    if (!allowed) throw new Error("You're not a participant on this deal.");

    const sides: { side: "bidder" | "counterparty"; orgId: string | null }[] = [
      { side: "bidder", orgId: bidderOrgId },
      { side: "counterparty", orgId: counterpartyOrgId },
    ];

    const results: PartyRegistrationInfo[] = [];
    for (const s of sides) {
      if (!s.orgId) continue;
      // Earliest member of the org, not filtered by role: .maybeSingle() with a role filter threw
      // outright (and silently emptied this whole result) on any org with more than one "owner"
      // row, which an org with several members can genuinely have.
      const { data: members } = await supabaseAdmin
        .from("org_members")
        .select("user_id")
        .eq("org_id", s.orgId)
        .order("created_at", { ascending: true })
        .limit(1);
      const memberId = (members as { user_id?: string }[] | null)?.[0]?.user_id;
      if (!memberId) continue;

      const { data: profileRow } = await supabaseAdmin.from("profiles").select("*").eq("id", memberId).maybeSingle();
      const profile = profileRow as {
        full_name?: string | null;
        account_type?: "company" | "individual" | null;
        id_number_type?: "id" | "passport" | null;
        id_number?: string | null;
        authority_to_act_name?: string | null;
        residential_address_name?: string | null;
        identity_verified?: boolean | null;
      } | null;
      if (!profile) continue;

      const isIndividual = profile.account_type === "individual";
      results.push({
        side: s.side,
        fullName: profile.full_name ?? null,
        accountType: profile.account_type ?? null,
        idNumberType: profile.id_number_type ?? null,
        idNumberMasked: profile.id_number ? maskId(profile.id_number) : null,
        documentLabel: isIndividual ? "Proof of Residential Address" : "Authority to Act",
        documentName: (isIndividual ? profile.residential_address_name : profile.authority_to_act_name) ?? null,
        identityVerified: Boolean(profile.identity_verified),
      });
    }
    return results;
  });
