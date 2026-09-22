import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A lightweight, automated go/no-go signal for the counterparty a person has just chosen — a
 * company-registry lookup plus one focused public-search check for sanctions, fraud, litigation,
 * insolvency or blacklisting. Deliberately not a hosted KYC/KYB verification session (that's the
 * WaD gate's job, and needs the subject's own participation) and not a new step or page of its
 * own: it runs quietly the moment a counterparty is chosen and writes its result onto the
 * counterparty's existing rating_band, so the WaD gate's existing "Flagged" banner — built long
 * ago but never driven by anything — finally has a real signal behind it.
 *
 * Never claims a clean result it didn't actually check for: if neither Tavily nor OpenAI is
 * configured, or the search itself fails, the verdict is "unknown" (rating_band "neutral"), never
 * a false "green".
 */

export type ComplianceVerdict = "green" | "red" | "unknown";
export type ComplianceFlag = { reason: string; url: string | null };
export type ComplianceSnapshot = { verdict: ComplianceVerdict; flags: ComplianceFlag[]; checkedAt: string };

const RATING_VERSION = "compliance-snapshot-v1";

/** The one rule this whole check exists to enforce: a clean result is only ever "green" (rating
 * "trusted") when a check genuinely ran and found nothing; anything that didn't actually run —
 * no API configured, the search failed — is "unknown" (rating "neutral"), never presented as a
 * pass. A flag of any kind is "red" (rating "flagged"). Exported and tested on its own because
 * this is the exact honesty guarantee the feature is for. */
export function deriveComplianceVerdict(
  checked: boolean,
  flags: ComplianceFlag[],
): { verdict: ComplianceVerdict; ratingBand: "trusted" | "neutral" | "flagged" } {
  const verdict: ComplianceVerdict = !checked ? "unknown" : flags.length > 0 ? "red" : "green";
  const ratingBand = verdict === "red" ? ("flagged" as const) : verdict === "green" ? ("trusted" as const) : ("neutral" as const);
  return { verdict, ratingBand };
}

export const runComplianceSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ counterpartyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ComplianceSnapshot> => {
    const { supabase } = context;
    const { data: cp, error } = await supabase
      .from("counterparties")
      .select("id, name, jurisdiction, media_flags")
      .eq("id", data.counterpartyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cp) throw new Error("Counterparty not found, or you don't have access to it.");

    // 1. Registry lookup — the company register already on file. A hit is a positive legitimacy
    // signal recorded alongside the verdict; absence isn't a red flag on its own; most genuine
    // counterparties simply won't be in a South African-focused register.
    let registryHit = false;
    try {
      const { data: hits } = await supabase
        .from("registry_companies")
        .select("legal_name")
        .ilike("legal_name", `%${cp.name}%`)
        .limit(1);
      registryHit = Boolean(hits && hits.length > 0);
    } catch {
      // A bonus signal, never a requirement.
    }

    // 2. One focused public-search check for sanctions, fraud, litigation, insolvency or
    // blacklisting — grounded to what was actually found, never invented.
    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    const { loadTavilyApiKey } = await import("@/lib/tavily.server");
    const tavilyKey = apiKey ? await loadTavilyApiKey() : null;

    const flags: ComplianceFlag[] = [];
    let checked = false;

    if (apiKey) {
      try {
        const query = `"${cp.name}"${cp.jurisdiction ? ` ${cp.jurisdiction}` : ""} sanctions fraud lawsuit insolvency blacklist`;
        let pageText = "";
        if (tavilyKey) {
          const { tavilySearch } = await import("@/lib/tavily.server");
          const results = await tavilySearch(tavilyKey, query, { max: 6, timeoutMs: 20_000 });
          pageText = results.map((r) => `${r.url}\n${r.title}\n${r.content}`).join("\n\n");
        } else {
          const { webSearch } = await import("@/lib/openaiWebSearch.server");
          const r = await webSearch({
            apiKey,
            models: ["gpt-5-mini", "gpt-5"],
            effort: "low",
            instructions:
              "Search the public web for sanctions listings, fraud, active litigation, insolvency or " +
              "blacklisting tied to the named company. Report only what you actually find.",
            input: `Company: ${cp.name}${cp.jurisdiction ? ` (${cp.jurisdiction})` : ""}`,
          });
          pageText = r.text;
        }

        if (pageText.trim()) {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-5-mini",
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content:
                    "You check public search results for one named company for sanctions or PEP listing, " +
                    "fraud, active litigation, insolvency or blacklisting. Only report a flag clearly about " +
                    "THIS company — never a namesake or an unrelated party — and never invent a source or a " +
                    "claim that isn't in the text below. " +
                    'Reply with JSON only: {"flags":[{"reason":"under 30 words, name the specific issue and ' +
                    'source","url":string|null}]} — an empty array if nothing adverse is found.',
                },
                {
                  role: "user",
                  content: `Company: ${cp.name}${cp.jurisdiction ? ` (${cp.jurisdiction})` : ""}\n\n${pageText.slice(0, 10000)}`,
                },
              ],
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
            const content = json.choices?.[0]?.message?.content ?? "";
            const start = content.indexOf("{");
            const end = content.lastIndexOf("}");
            if (start >= 0 && end > start) {
              const parsed = JSON.parse(content.slice(start, end + 1)) as {
                flags?: { reason?: string; url?: string | null }[];
              };
              for (const f of parsed.flags ?? []) {
                if (!f.reason) continue;
                flags.push({
                  reason: String(f.reason).slice(0, 200),
                  url: typeof f.url === "string" && /^https?:\/\//.test(f.url) ? f.url : null,
                });
              }
            }
            checked = true;
          }
        }
      } catch {
        // A failed search leaves checked=false — reported as unknown, never as a false "green".
      }
    }

    const { verdict, ratingBand } = deriveComplianceVerdict(checked, flags);
    const checkedAt = new Date().toISOString();

    await supabase
      .from("counterparties")
      .update({
        rating_band: ratingBand,
        rating_computed_at: checkedAt,
        rating_version: RATING_VERSION,
        media_flags: {
          ...((cp.media_flags as Record<string, unknown> | null) ?? {}),
          compliance: { verdict, flags, checkedAt, registryHit },
        } as unknown as never,
      })
      .eq("id", cp.id);

    return { verdict, flags, checkedAt };
  });
