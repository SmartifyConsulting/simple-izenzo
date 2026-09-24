import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Writes a short "about this company" brief onto an organisation, using its own public website
 * (read through Firecrawl) plus whatever details are already captured. Existing organisation
 * rules are untouched — this only fills `ai_brief`. */
export const generateOrgBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ orgId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: org, error } = await supabase
      .from("organisations")
      .select("id, name, website, country, sector, industry, years_in_business, offerings")
      .eq("id", data.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!org) throw new Error("Organisation not found, or you do not have access to it.");

    let siteText = "";
    if (org.website) {
      try {
        const { firecrawlConfigured, fetchPageText, summarisePage } = await import(
          "@/lib/firecrawl.server"
        );
        if (await firecrawlConfigured()) {
          const text = await fetchPageText(org.website);
          if (text) siteText = summarisePage(text).excerpt;
        }
      } catch {
        // A site that won't load must not block the brief — the AI still has the captured fields.
        siteText = "";
      }
    }

    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (!apiKey) throw new Error("AI is not configured for this workspace.");

    const facts = [
      `Company: ${org.name}`,
      org.website ? `Website: ${org.website}` : "",
      org.country ? `Country: ${org.country}` : "",
      org.industry ? `Industry: ${org.industry}` : "",
      org.sector ? `Sector: ${org.sector}` : "",
      org.years_in_business ? `Years in business: ${org.years_in_business}` : "",
      org.offerings ? `What they offer: ${org.offerings}` : "",
      siteText ? `Text from their website:\n${siteText}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { callAiChat } = await import("@/lib/aiChat.server");
    const res = await callAiChat(apiKey, {
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "Write a factual 2-3 sentence brief about a company for a trade counterparty to read. Plain prose, no marketing language, no bullet points, no headings. Only use the facts given; never invent figures, clients or claims. If the facts are thin, keep the brief short.",
          },
          { role: "user", content: facts },
        ],
    });
    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      const { isOpenAiQuotaExceeded } = await import("@/lib/openai.server");
      if (isOpenAiQuotaExceeded(body)) {
        const { alertLowFunds } = await import("@/lib/opsAlerts.server");
        void alertLowFunds("OpenAI", 429, body);
        throw new Error("AI credits are exhausted for this workspace — support has been notified.");
      }
      const { logAiRateLimit } = await import("@/lib/opsAlerts.server");
      void logAiRateLimit("OpenAI", "gpt-5-mini");
      throw new Error("AI is busy right now. Please try again shortly.");
    }
    if (!res.ok) throw new Error("The company brief could not be written just now.");
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const brief = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!brief) throw new Error("The company brief came back empty. Try again.");

    const { error: upErr } = await supabase
      .from("organisations")
      .update({ ai_brief: brief, ai_brief_generated_at: new Date().toISOString() })
      .eq("id", org.id);
    if (upErr) throw new Error(upErr.message);

    return { brief, usedWebsite: siteText.length > 0 };
  });
