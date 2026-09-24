import { supabase } from "@/integrations/supabase/client";

/** Guarantees the given user has an organisation, creating a lightweight personal one (named
 * after them) if they don't already have one. Covers accounts that never went through the
 * "Company or Individual" signup step — Google OAuth sign-ups, and any account created before
 * that step existed — so actions like "Record and continue" never dead-end on a missing org. */
export async function ensureOrg(
  userId: string,
  displayName: string,
): Promise<{ id: string; credits: number }> {
  // The profile's active company is read first, before anything else. It is one row per person, so
  // it can neither be ambiguous nor hidden by a membership-scoped policy — unlike the membership
  // list, which is what previously made this function decide someone had no company at all.
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .maybeSingle();
  const activeOrgId = (profile as { org_id?: string | null } | null)?.org_id ?? null;

  if (activeOrgId) {
    const { data: activeOrg, error } = await supabase
      .from("organisations")
      .select("id, credits")
      .eq("id", activeOrgId)
      .maybeSingle();
    if (error) throw error;
    if (activeOrg) return activeOrg;
    // Otherwise the profile points at a company this account can't see; fall through to the
    // membership list rather than treating that as "no company" and creating another.
  }

  // Every company this person trades through, as a list. `.maybeSingle()` used to sit here and
  // errors the moment someone belongs to two companies — the null that produced was read as "no
  // company", so each call created yet another one. This is what left a single person with seven
  // identical organisations.
  const { data: memberships, error: memErr } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId);
  if (memErr) throw memErr;

  const firstOrgId = (memberships ?? [])[0]?.org_id as string | undefined;
  if (firstOrgId) {
    const { data: org, error } = await supabase
      .from("organisations")
      .select("id, credits")
      .eq("id", firstOrgId)
      .maybeSingle();
    if (error) throw error;
    if (org) {
      // The database decides which company you belong to from your profile record, not from the
      // membership list — so a member whose profile has no company still gets every save rejected.
      // Write it onto the profile (creating the row if it is missing) before returning.
      if (activeOrgId !== org.id) {
        const { error: pErr } = await supabase
          .from("profiles")
          .upsert({ id: userId, org_id: org.id, full_name: displayName }, { onConflict: "id" });
        if (pErr) throw pErr;
      }
      return org;
    }
  }

  // Reached only when the person genuinely belongs to no company.
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
