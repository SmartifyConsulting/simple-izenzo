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

const SOURCES: { source: MediaFinding["source"]; label: string }[] = [
  { source: "linkedin", label: "LinkedIn" },
  { source: "facebook", label: "Facebook" },
  { source: "tiktok", label: "TikTok" },
  { source: "instagram", label: "Instagram / X" },
  { source: "marketplaces", label: "Marketplaces & directories" },
  { source: "news", label: "News & adverse media" },
];

type Judged = Map<
  MediaFinding["source"],
  { status: "found" | "not_found" | "adverse"; detail: string; url: string | null }
>;

/** One OpenAI web search covering all six sources for one company. Throws with the reason when the
 * search itself fails, so the screen can say why instead of only "could not scan". */
async function scanWithOpenAi(apiKey: string, name: string, jurisdiction: string | null): Promise<Judged> {
  const { webSearch } = await import("@/lib/openaiWebSearch.server");
  const sourceLines = SOURCES.map((s) => `- ${s.source}: ${s.label}`).join("\n");
  const result = await webSearch({
    apiKey,
    models: ["gpt-6-astra", "gpt-5"],
    effort: "low",
    instructions:
      "You run an online presence and adverse-media check on one company for a trade counterparty review, using web search. " +
      "For each source listed, search for the company on that kind of site (for example LinkedIn, Facebook, TikTok, Instagram or X, marketplaces and directories, news) and decide: " +
      '"found" (the company has a public presence there and nothing adverse), "not_found" (no clear presence of THIS company) or ' +
      '"adverse" (results tie THIS company to fraud, scams, lawsuits, sanctions, convictions, investigations, money laundering, bribery, corruption, liquidation, insolvency or blacklisting). ' +
      "Only judge results that are clearly about the named company (name and place fit) — ignore namesakes and unrelated pages. " +
      '"detail" is one plain sentence saying what was found; never mention AI, searching or tools. "url" is the single most relevant page address you found for that source, or null. ' +
      'Reply with JSON only: {"findings":[{"source":string,"status":"found"|"not_found"|"adverse","detail":string,"url":string|null}]} with exactly one entry per source listed.',
    input: `Company: ${name}${jurisdiction ? ` (${jurisdiction})` : ""}\n\nSources:\n${sourceLines}`,
  });

  const body = result.text.slice(result.text.indexOf("{"), result.text.lastIndexOf("}") + 1);
  let parsed: { findings?: { source?: string; status?: string; detail?: string; url?: string | null }[] };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("The web check came back in a form that could not be read.");
  }
  const out: Judged = new Map();
  for (const f of parsed.findings ?? []) {
    const source = SOURCES.find((s) => s.source === f.source)?.source;
    if (!source || !f.detail) continue;
    out.set(source, {
      status: f.status === "adverse" || f.status === "found" ? f.status : "not_found",
      detail: String(f.detail).slice(0, 300),
      url: typeof f.url === "string" && /^https?:\/\//.test(f.url) ? f.url : null,
    });
  }
  if (out.size === 0) throw new Error("The web check returned no findings.");
  return out;
}

/** Scans open web and social sources for the shortlisted counterparties with OpenAI's web search.
 * Nothing here changes gates or token costs — findings are recorded against each counterparty so they stay on screen when the user comes back to the deal. */
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

    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();

    const results: MediaCheckResult[] = [];

    for (const cp of counterparties) {
      let findings: MediaFinding[];

      if (!apiKey) {
        findings = SOURCES.map((src) => ({
          source: src.source,
          label: src.label,
          status: "unavailable" as const,
          detail: "Online scanning is not connected yet — ask an administrator to add OpenAI under Admin → Integrations.",
        }));
      } else {
        // One OpenAI web search covers all six sources for this company.
        try {
          const judged = await scanWithOpenAi(apiKey, cp.name, cp.jurisdiction);
          findings = SOURCES.map((src): MediaFinding => {
            const j = judged.get(src.source);
            if (!j) {
              return { source: src.source, label: src.label, status: "not_found", detail: "No clear public presence on this source." };
            }
            return {
              source: src.source,
              label: src.label,
              status: j.status,
              detail: j.detail,
              ...(j.url ? { url: j.url } : {}),
            };
          });
        } catch (err) {
          const reason = (err as Error).message;
          findings = SOURCES.map((src) => ({ source: src.source, label: src.label, status: "failed" as const, detail: reason }));
        }
      }

      // Merged into what the search already stored (its evidence and score breakdown) rather than
      // replacing it.
      const { data: existing } = await supabase
        .from("counterparties")
        .select("media_flags")
        .eq("id", cp.id)
        .maybeSingle();
      await supabase
        .from("counterparties")
        .update({
          media_flags: {
            ...((existing?.media_flags as Record<string, unknown> | null) ?? {}),
            checkedAt: new Date().toISOString(),
            findings,
          } as unknown as never,
        })
        .eq("id", cp.id);

      results.push({ counterpartyId: cp.id, name: cp.name, findings });
    }

    return results;
  });
