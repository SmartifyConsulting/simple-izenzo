import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeInput = (data: unknown) => z.object({ code: z.string().min(1) }).parse(data);

/** Looks up an organisation by its shareable invite code — service-role only. A signed-in user has
 * no RLS-visible access to any organisation they don't already belong to, and that isolation must
 * stay intact even for this lookup, so it never runs as a direct client-side select. Returns just
 * enough to show a "you're about to join X" confirmation before actually joining. */
export const previewOrgByInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.trim().toUpperCase();
    // invite_code predates the last regenerated Supabase types — cast through `any` until they're
    // regenerated after this migration runs.
    const { data: org } = await (supabaseAdmin.from("organisations") as any)
      .select("id, name, country, sector")
      .eq("invite_code", code)
      .maybeSingle();
    if (!org) throw new Error("That invite code doesn't match any organisation — check it and try again.");
    return { id: org.id as string, name: org.name as string, country: org.country as string | null, sector: org.sector as string | null };
  });

/** Joins the signed-in person to the organisation behind an invite code, as a member (never an
 * owner), and makes it their active organisation. Re-entering a code for an org already joined is
 * harmless — it just switches back to it. */
export const joinOrgByInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.trim().toUpperCase();

    const { data: org } = await (supabaseAdmin.from("organisations") as any)
      .select("id, name")
      .eq("invite_code", code)
      .maybeSingle();
    if (!org) throw new Error("That invite code doesn't match any organisation — check it and try again.");

    const { data: existing } = await supabaseAdmin
      .from("org_members")
      .select("org_id")
      .eq("org_id", org.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: mErr } = await supabaseAdmin
        .from("org_members")
        .insert({ org_id: org.id, user_id: userId, role: "member" });
      if (mErr) throw new Error(mErr.message);
    }

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ org_id: org.id })
      .eq("id", userId);
    if (pErr) throw new Error(pErr.message);

    return { orgId: org.id, orgName: org.name, alreadyMember: Boolean(existing) };
  });
