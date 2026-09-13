import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** One open-web source scanned for a counterparty. */
export type MediaFinding = {
  source: "linkedin" | "facebook" | "tiktok" | "instagram" | "marketplaces" | "news";
  label: string;
  status: "found" | "not_found" | "adverse" | "unavailable" | "failed";
  detail: string;
  url?: string;
};

export type MediaCheckResult = {
  counterpartyId: string;
  name: string;
  findings: MediaFinding[];
};

const SOURCES: { source: MediaFinding["source"]; label: string; query: (q: string) => string }[] = [
  { source: "linkedin", label: "LinkedIn", query: (q) => `${q} site:linkedin.com` },
  { source: "facebook", label: "Facebook", query: (q) => `${q} site:facebook.com` },
  { source: "tiktok", label: "TikTok", query: (q) => `${q} site:tiktok.com` },
  {
    source: "instagram",
    label: "Instagram / X",
    query: (q) => `${q} (site:instagram.com OR site:x.com)`,
  },
  {
    source: "marketplaces",
    label: "Marketplaces & directories",
    query: (q) => `${q} (marketplace OR supplier OR directory OR reviews)`,
  },
  { source: "news", label: "News & adverse media", query: (q) => `${q} news` },
];


/** Words that turn an ordinary mention into something a compliance officer should read. */
const ADVERSE = [
  "fraud",
  "scam",
  "lawsuit",
  "sued",
  "sanction",
  "sanctions",
  "convicted",
  "investigation",
  "money laundering",
  "bribery",
  "corruption",
  "liquidation",
  "insolvent",
  "blacklist",
];

/** Scans open web and social sources for the shortlisted counterparties through Firecrawl's
 * remote browser. Nothing here changes gates or token costs — findings are recorded against each
 * counterparty so they stay on screen when the user comes back to the deal. */
export const runOnlineMediaChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionId: z.string().uuid(),
        counterpartyIds: z.array(z.string().uuid()).min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MediaCheckResult[]> => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("counterparties")
      .select("id, name, jurisdiction")
      .eq("transaction_id", data.transactionId)
      .in("id", data.counterpartyIds);
    if (error) throw new Error(error.message);
    const counterparties = rows ?? [];
    if (counterparties.length === 0) {
      throw new Error("None of those counterparties belong to this deal.");
    }

    const { firecrawlConfigured, searchWeb } = await import("@/lib/firecrawl.server");
    const connected = await firecrawlConfigured();

    const results: MediaCheckResult[] = [];

    for (const cp of counterparties) {
      const query = `"${cp.name}"${cp.jurisdiction ? ` ${cp.jurisdiction}` : ""}`;
      const findings: MediaFinding[] = [];

      for (const src of SOURCES) {
        if (!connected) {
          findings.push({
            source: src.source,
            label: src.label,
            status: "unavailable",
            detail: "Live web scanning is not connected yet — ask an administrator to add Firecrawl.",
          });
          continue;
        }
        try {
          const found = await searchWeb(src.query(query), src.label, 5, 30_000);
          const text = found.map((f) => f.text).join(" ").toLowerCase();
          const url = found[0]?.url;
          const mentioned = text.includes(cp.name.toLowerCase().slice(0, 24));
          const hits = ADVERSE.filter((w) => text.includes(w));
          if (hits.length > 0) {
            findings.push({
              source: src.source,
              label: src.label,
              status: "adverse",
              detail: `Possible adverse mentions: ${hits.slice(0, 4).join(", ")}. Read the source before continuing.`,
              ...(url ? { url } : {}),
            });
          } else if (mentioned) {
            findings.push({
              source: src.source,
              label: src.label,
              status: "found",
              detail: "Public presence found, nothing adverse in the visible results.",
              ...(url ? { url } : {}),
            });
          } else {
            findings.push({
              source: src.source,
              label: src.label,
              status: "not_found",
              detail: "No clear public presence on this source.",
              ...(url ? { url } : {}),
            });
          }
        } catch (err) {
          findings.push({
            source: src.source,
            label: src.label,
            status: "failed",
            detail: (err as Error).message,
          });
        }
      }


      await supabase
        .from("counterparties")
        .update({
          media_flags: {
            checkedAt: new Date().toISOString(),
            findings,
          } as unknown as never,
        })
        .eq("id", cp.id);

      results.push({ counterpartyId: cp.id, name: cp.name, findings });
    }

    return results;
  });
