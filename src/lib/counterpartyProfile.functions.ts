import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CounterpartyPortfolioItem = {
  title: string;
  description: string | null;
  imageUrl: string | null;
};

export type CounterpartyProfile = {
  name: string;
  jurisdiction: string | null;
  sector: string | null;
  score: number | null;
  source: string | null;
  website: string | null;
  contactEmail: string | null;
  contactName: string | null;
  phone: string | null;
  country: string | null;
  industry: string | null;
  yearsInBusiness: number | null;
  offerings: string | null;
  termsOfTrade: string | null;
  registrationNo: string | null;
  summary: string | null;
  /** True when a company profile (organisation or published listing) was actually found on the
   * platform — false means everything shown came off the search result itself. */
  hasProfile: boolean;
  verified: boolean;
  portfolio: CounterpartyPortfolioItem[];
};

/** The counterparty's own profile, as it should read to the other side of a deal: their published
 * company details, what they say they offer, and whatever material they have attached to their
 * profile. Resolved server-side because `organisations` RLS only ever exposes your own org — this
 * deliberately returns a narrow, public-facing shape and nothing else. */
export const getCounterpartyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ counterpartyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<CounterpartyProfile> => {
    // Read through the caller's own client first: RLS on `counterparties` is what establishes that
    // this person is allowed to look at this row at all.
    const { data: cp, error } = await context.supabase
      .from("counterparties")
      .select("id, name, jurisdiction, sector, score, source, rationale, website, contact_email, phone")
      .eq("id", data.counterpartyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cp) throw new Error("That counterparty is not on this deal.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org } = await supabaseAdmin
      .from("organisations")
      .select(
        "id, name, country, sector, industry, years_in_business, offerings, terms_of_trade, website, registration_no, primary_contact_name, primary_contact_email, ai_brief",
      )
      .ilike("name", cp.name)
      .limit(1)
      .maybeSingle();

    const { data: listing } = await supabaseAdmin
      .from("responder_listings")
      .select("name, sector, jurisdiction, summary, source, source_url, verified_at, published, org_id")
      .or(org?.id ? `org_id.eq.${org.id},name.ilike.${cp.name}` : `name.ilike.${cp.name}`)
      .order("published", { ascending: false })
      .order("verified_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    let portfolio: CounterpartyPortfolioItem[] = [];
    if (org?.id) {
      const { data: items } = await supabaseAdmin
        .from("org_portfolio_items")
        .select("title, description, image_url")
        .eq("org_id", org.id)
        .order("created_at", { ascending: true });
      portfolio = (items ?? []).map((i) => ({
        title: i.title,
        description: i.description ?? null,
        imageUrl: i.image_url ?? null,
      }));
    }

    return {
      name: cp.name,
      jurisdiction: cp.jurisdiction ?? listing?.jurisdiction ?? org?.country ?? null,
      sector: cp.sector ?? listing?.sector ?? org?.sector ?? null,
      score: cp.score ?? null,
      source: cp.source ?? listing?.source ?? null,
      website: org?.website ?? cp.website ?? listing?.source_url ?? null,
      contactEmail: org?.primary_contact_email ?? cp.contact_email ?? null,
      contactName: org?.primary_contact_name ?? null,
      phone: cp.phone ?? null,
      country: org?.country ?? null,
      industry: org?.industry ?? null,
      yearsInBusiness: org?.years_in_business ?? null,
      offerings: org?.offerings ?? null,
      termsOfTrade: org?.terms_of_trade ?? null,
      registrationNo: org?.registration_no ?? null,
      summary: org?.ai_brief ?? listing?.summary ?? cp.rationale ?? null,
      hasProfile: Boolean(org || listing),
      verified: Boolean(listing?.verified_at),
      portfolio,
    };
  });
