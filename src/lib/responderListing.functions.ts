import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reads (and, on first read, creates) this organisation's public directory listing. Listings are
 * on by default, so a business that has never touched the setting still appears. The Verified badge
 * is derived from a passed identity check — it is never self-awarded. */
export const getOrgListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orgId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organisations")
      .select("id, name, sector, country")
      .eq("id", data.orgId)
      .maybeSingle();
    if (!member) throw new Error("Organisation not found");

    const { data: verified } = await context.supabase
      .from("identity_verifications")
      .select("completed_at")
      .eq("subject_org_id", data.orgId)
      .eq("status", "passed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const verifiedAt = verified?.completed_at ?? null;

    const { data: existing } = await supabaseAdmin
      .from("responder_listings")
      .select("id, published, verified_at")
      .eq("org_id", data.orgId)
      .maybeSingle();

    if (existing) {
      if (existing.verified_at !== verifiedAt) {
        await supabaseAdmin
          .from("responder_listings")
          .update({ verified_at: verifiedAt })
          .eq("id", existing.id);
      }
      return { published: existing.published };
    }

    await supabaseAdmin.from("responder_listings").insert({
      org_id: data.orgId,
      name: member.name,
      sector: member.sector,
      jurisdiction: member.country,
      source: "registered",
      published: true,
      verified_at: verifiedAt,
      created_by: context.userId,
    });
    return { published: true };
  });

/** Turns this organisation's public directory listing on or off. */
export const setOrgListingPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ orgId: z.string().uuid(), published: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: org } = await context.supabase
      .from("organisations")
      .select("id")
      .eq("id", data.orgId)
      .maybeSingle();
    if (!org) throw new Error("Organisation not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("responder_listings")
      .update({ published: data.published })
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return { published: data.published };
  });
