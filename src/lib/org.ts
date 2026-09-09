import { supabase } from "@/integrations/supabase/client";

/** Guarantees the given user has an organisation, creating a lightweight personal one (named
 * after them) if they don't already have one. Covers accounts that never went through the
 * "Company or Individual" signup step — Google OAuth sign-ups, and any account created before
 * that step existed — so actions like "Record and continue" never dead-end on a missing org. */
export async function ensureOrg(userId: string, displayName: string): Promise<{ id: string; credits: number }> {
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membership?.org_id) {
    const { data: org, error } = await supabase
      .from("organisations")
      .select("id, credits")
      .eq("id", membership.org_id)
      .single();
    if (error) throw error;
    return org;
  }

  const { data: org, error: orgErr } = await supabase
    .from("organisations")
    .insert({ name: displayName || "My account" })
    .select("id, credits")
    .single();
  if (orgErr) throw orgErr;

  const { error: mErr } = await supabase
    .from("org_members")
    .insert({ org_id: org.id, user_id: userId, role: "owner" });
  if (mErr) throw mErr;

  const { error: pErr } = await supabase.from("profiles").update({ org_id: org.id }).eq("id", userId);
  if (pErr) throw pErr;

  return org;
}
