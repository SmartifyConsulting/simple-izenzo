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

    // The database decides which company you belong to from your profile record, not from the
    // membership list — so a member whose profile has no company still gets every save rejected.
    // Write it onto the profile (creating the row if it is missing) before returning.
    const { data: p } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (!p?.org_id) {
      const { error: pErr } = await supabase
        .from("profiles")
        .upsert({ id: userId, org_id: org.id, full_name: displayName }, { onConflict: "id" });
      if (pErr) throw pErr;
    }

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

  // Upsert, not update: accounts created before the profile trigger existed have no profile row,
  // and a plain update would quietly change nothing — leaving the user with no company and every
  // save blocked by the database's company check.
  const { data: saved, error: pErr } = await supabase
    .from("profiles")
    .upsert({ id: userId, org_id: org.id, full_name: displayName }, { onConflict: "id" })
    .select("id")
    .maybeSingle();
  if (pErr) throw pErr;
  if (!saved) throw new Error("Could not attach your account to a company. Please sign in again.");

  return org;
}
