import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reads a company's own public website through Bright Data's remote browser and returns a short
 * summary. Nothing is stored — the caller decides what to do with it. */
export const lookupCompanySite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        url: z.string().url().max(500),
        companyName: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { brightDataConfigured, fetchPageText, summarisePage } = await import(
      "@/lib/brightdata.server"
    );

    if (!(await brightDataConfigured())) {
      return {
        ok: false as const,
        excerpt: "",
        wordCount: 0,
        note: "Live web lookups are not connected yet. Ask the system administrator to add the Bright Data browser endpoint.",
      };
    }

    try {
      const text = await fetchPageText(data.url);
      if (!text) {
        return {
          ok: false as const,
          excerpt: "",
          wordCount: 0,
          note: "The site loaded but had no readable text on it.",
        };
      }
      const { excerpt, wordCount } = summarisePage(text);
      return { ok: true as const, excerpt, wordCount, note: "" };
    } catch (err) {
      return { ok: false as const, excerpt: "", wordCount: 0, note: (err as Error).message };
    }
  });
