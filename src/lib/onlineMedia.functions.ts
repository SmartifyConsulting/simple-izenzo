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


/** Where each source is searched on the public internet. */
const SOURCE_SEARCH: Record<MediaFinding["source"], { domains?: string[]; topic?: "news"; suffix?: string }> = {
  linkedin: { domains: ["linkedin.com"] },
  facebook: { domains: ["facebook.com"] },
  tiktok: { domains: ["tiktok.com"] },
  instagram: { domains: ["instagram.com", "x.com", "twitter.com"] },
  marketplaces: { suffix: "supplier directory marketplace reviews" },
  news: { topic: "news", suffix: "news" },
};

/** Words that turn an ordinary mention into something a compliance officer should read. */
const ADVERSE = [
  "fraud", "scam", "lawsuit", "sued", "sanction", "sanctions", "convicted", "investigation",
  "money laundering", "bribery", "corruption", "liquidation", "insolvent", "blacklist",
];

type Page = { title: string; url: string; content: string };

/** Online scanning through Tavily: each source is searched on the public internet, then OpenAI
 * judges what was found about this particular company (a plain word check if OpenAI is absent). */
async function scanWithTavily(
  tavilyKey: string,
  openAiKey: string | null,
  name: string,
  jurisdiction: string | null,
): Promise<MediaFinding[]> {
  const { tavilySearch } = await import("@/lib/tavily.server");
  const base = `"${name}"${jurisdiction ? ` ${jurisdiction}` : ""}`;
  const searched = await Promise.all(
    SOURCES.map(async (src) => {
      const cfg = SOURCE_SEARCH[src.source];
      try {
        const pages: Page[] = await tavilySearch(tavilyKey, `${base}${cfg.suffix ? ` ${cfg.suffix}` : ""}`, {
          max: 5,
          ...(cfg.domains ? { includeDomains: cfg.domains } : {}),
          ...(cfg.topic ? { topic: cfg.topic } : {}),
        });
        return { src, pages, error: null as string | null };
      } catch (err) {
        return { src, pages: [] as Page[], error: (err as Error).message };
      }
    }),
  );

  let judged: Judged | null = null;
  if (openAiKey) {
    try {
      const blocks = searched
        .filter((x) => !x.error)
        .map(
          (x) =>
            `SOURCE ${x.src.source} (${x.src.label})\n` +
            (x.pages.length === 0 ? "- no results" : x.pages.map((pg) => `- ${pg.title} — ${pg.url} — ${pg.content}`).join("\n")),
        )
        .join("\n\n");
      if (blocks) {
        const { callOpenAiChat } = await import("@/lib/openaiCall.server");
        const res = await callOpenAiChat(
          openAiKey,
          {
            model: "gpt-5-mini",
            reasoning_effort: "low",
            max_completion_tokens: 8000,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You check public internet search results about one company for a trade counterparty review. For each source decide: " +
                  '"found" (the company has a public presence there and nothing adverse), "not_found" (no clear presence of THIS company) or ' +
                  '"adverse" (the results tie THIS company to fraud, scams, lawsuits, sanctions, convictions, investigations, money laundering, bribery, corruption, liquidation, insolvency or blacklisting). ' +
                  "Only judge results that are clearly about the named company (name and place fit) — ignore namesakes and unrelated pages. " +
                  '"detail" is a short explanation of this specific check, in one or two plain sentences (under 40 words): for "found", say what was found and where — the page or profile, and what it shows about the company; for "not_found", say what was looked for on this source and that no page for this company came up (or that the only matches were other organisations); for "adverse", say exactly what is alleged, by whom or in which report, and when if known. Name the actual page, post or article rather than speaking in general terms. Never mention AI, searching or tools. ' +
                  '"url" is the single most relevant result address, or null. ' +
                  'Reply with JSON only: {"findings":[{"source":string,"status":"found"|"not_found"|"adverse","detail":string,"url":string|null}]} with one entry per source given.',
              },
              { role: "user", content: `Company: ${name}${jurisdiction ? ` (${jurisdiction})` : ""}\n\n${blocks}` },
            ],
          },
          { retries: 1 },
        );
        if (res.ok) {
          const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const content = json.choices?.[0]?.message?.content ?? "";
          const parsed = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1)) as {
            findings?: { source?: string; status?: string; detail?: string; url?: string | null }[];
          };
          const out: Judged = new Map();
          for (const f of parsed.findings ?? []) {
            const source = SOURCES.find((x) => x.source === f.source)?.source;
            if (!source || !f.detail) continue;
            out.set(source, {
              status: f.status === "adverse" || f.status === "found" ? f.status : "not_found",
              detail: String(f.detail).slice(0, 300),
              url: typeof f.url === "string" && /^https?:\/\//.test(f.url) ? f.url : null,
            });
          }
          if (out.size > 0) judged = out;
        }
      }
    } catch {
      judged = null;
    }
  }

  return searched.map(({ src, pages, error }): MediaFinding => {
    if (error) return { source: src.source, label: src.label, status: "failed", detail: error };
    const j = judged?.get(src.source);
    const firstUrl = pages[0]?.url;
    if (j) {
      const url = j.url ?? firstUrl;
      return { source: src.source, label: src.label, status: j.status, detail: j.detail, ...(url ? { url } : {}) };
    }
    // Checked per page, not across the whole blob of up to 5 results concatenated together — an
    // adverse word on a page that never mentions this company (a different result Tavily happened
    // to return) must never brand this company "adverse". Both have to show up on the same page.
    const namePart = name.toLowerCase().slice(0, 24);
    const companyPages = pages.filter((pg) => `${pg.title} ${pg.content}`.toLowerCase().includes(namePart));
    let adverseHit: { page: Page; words: string[] } | null = null;
    for (const pg of companyPages) {
      const t = `${pg.title} ${pg.content}`.toLowerCase();
      const words = ADVERSE.filter((w) => t.includes(w));
      if (words.length > 0) {
        adverseHit = { page: pg, words };
        break;
      }
    }
    const base2 = { source: src.source, label: src.label, ...(firstUrl ? { url: firstUrl } : {}) };
    if (adverseHit) {
      return {
        ...base2,
        status: "adverse",
        url: adverseHit.page.url,
        detail: `"${adverseHit.page.title.slice(0, 90)}" — mentions ${adverseHit.words.slice(0, 4).join(", ")} alongside the company name.`,
      };
    }
    if (companyPages.length > 0) {
      return { ...base2, status: "found", detail: `${companyPages[0]?.title ? `Found "${companyPages[0].title.slice(0, 90)}". ` : ""}Nothing adverse shows in the visible results.` };
    }
    return { ...base2, status: "not_found", detail: `Searched ${src.label} for ${name}${jurisdiction ? ` (${jurisdiction})` : ""} — no page for this company came up.` };
  });
}

/** One OpenAI web search covering all six sources for one company. Throws with the reason when the
 * search itself fails, so the screen can say why instead of only "could not scan". */
async function scanWithOpenAi(apiKey: string, name: string, jurisdiction: string | null): Promise<Judged> {
  const { webSearch } = await import("@/lib/openaiWebSearch.server");
  const sourceLines = SOURCES.map((s) => `- ${s.source}: ${s.label}`).join("\n");
  const result = await webSearch({
    apiKey,
    models: ["gpt-5-mini", "gpt-5"],
    effort: "low",
    instructions:
      "You run an online presence and adverse-media check on one company for a trade counterparty review, using web search. " +
      "For each source listed, search for the company on that kind of site (for example LinkedIn, Facebook, TikTok, Instagram or X, marketplaces and directories, news) and decide: " +
      '"found" (the company has a public presence there and nothing adverse), "not_found" (no clear presence of THIS company) or ' +
      '"adverse" (results tie THIS company to fraud, scams, lawsuits, sanctions, convictions, investigations, money laundering, bribery, corruption, liquidation, insolvency or blacklisting). ' +
      "Only judge results that are clearly about the named company (name and place fit) — ignore namesakes and unrelated pages. " +
      '"detail" is a short explanation of this specific check, in one or two plain sentences (under 40 words): for "found", say what was found and where — the page or profile, and what it shows about the company; for "not_found", say what was looked for on this source and that no page for this company came up (or that the only matches were other organisations); for "adverse", say exactly what is alleged, by whom or in which report, and when if known. Name the actual page, post or article rather than speaking in general terms. Never mention AI, searching or tools. ' +
      '"url" is the single most relevant page address you found for that source, or null. ' +
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
    const { loadTavilyApiKey } = await import("@/lib/tavily.server");
    const tavilyKey = await loadTavilyApiKey();

    const results: MediaCheckResult[] = [];

    for (const cp of counterparties) {
      let findings: MediaFinding[];

      if (!apiKey && !tavilyKey) {
        findings = SOURCES.map((src) => ({
          source: src.source,
          label: src.label,
          status: "unavailable" as const,
          detail: "Online scanning is not connected yet — ask an administrator to add Tavily (or OpenAI) under Admin → Integrations.",
        }));
      } else if (tavilyKey) {
        // Public internet search through Tavily, judged by OpenAI.
        try {
          findings = await scanWithTavily(tavilyKey, apiKey, cp.name, cp.jurisdiction);
        } catch (err) {
          const reason = (err as Error).message;
          findings = SOURCES.map((src) => ({ source: src.source, label: src.label, status: "failed" as const, detail: reason }));
        }
      } else {
        // One OpenAI web search covers all six sources for this company.
        try {
          const judged = await scanWithOpenAi(apiKey as string, cp.name, cp.jurisdiction);
          findings = SOURCES.map((src): MediaFinding => {
            const j = judged.get(src.source);
            if (!j) {
              return { source: src.source, label: src.label, status: "not_found", detail: `Searched ${src.label} for ${cp.name} — no page for this company came up.` };
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
