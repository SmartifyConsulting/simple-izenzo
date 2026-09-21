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

type Snippet = { title: string; url: string; description: string };
type Searched = { src: (typeof SOURCES)[number]; snippets: Snippet[]; error: string | null };
type Judged = Map<
  MediaFinding["source"],
  { status: "found" | "not_found" | "adverse"; detail: string; url: string | null }
>;

/** One OpenAI read of everything the searches turned up about a company. Returns null when OpenAI
 * is not connected or does not answer, so the caller falls back to a plain word check. */
async function judgeWithOpenAi(name: string, jurisdiction: string | null, searched: Searched[]): Promise<Judged | null> {
  try {
    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (!apiKey) return null;
    const { callOpenAiChat } = await import("@/lib/openaiCall.server");

    const blocks = searched
      .filter((x) => !x.error)
      .map(
        (x) =>
          `SOURCE ${x.src.source} (${x.src.label})\n` +
          (x.snippets.length === 0
            ? "- no results"
            : x.snippets.map((s) => `- ${s.title} — ${s.url} — ${s.description}`).join("\n")),
      )
      .join("\n\n");
    if (!blocks) return null;

    const res = await callOpenAiChat(
      apiKey,
      {
        model: "gpt-6-astra",
        reasoning_effort: "low",
        max_completion_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You check public web search results about one company for a trade counterparty review. For each source decide: " +
              '"found" (the company has a public presence there and nothing adverse), "not_found" (no clear presence of THIS company) or ' +
              '"adverse" (the results tie THIS company to fraud, scams, lawsuits, sanctions, convictions, investigations, money laundering, bribery, corruption, liquidation, insolvency or blacklisting). ' +
              "Only judge results that are clearly about the named company (name and place fit) — ignore namesakes and unrelated pages. " +
              '"detail" is one plain sentence saying what was found; never mention AI, searching or tools. "url" is the single most relevant result address, or null. ' +
              'Reply with JSON only: {"findings":[{"source":string,"status":"found"|"not_found"|"adverse","detail":string,"url":string|null}]} with one entry per source given.',
          },
          { role: "user", content: `Company: ${name}${jurisdiction ? ` (${jurisdiction})` : ""}\n\n${blocks}` },
        ],
      },
      { retries: 1 },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    const body = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    const parsed = JSON.parse(body) as {
      findings?: { source?: string; status?: string; detail?: string; url?: string | null }[];
    };
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
    return out.size > 0 ? out : null;
  } catch {
    return null;
  }
}

/** The plain word check used when OpenAI cannot be reached. */
function keywordFinding(src: (typeof SOURCES)[number], name: string, snippets: Snippet[]): MediaFinding {
  const text = snippets.map((s) => `${s.title} ${s.description}`).join(" ").toLowerCase();
  const url = snippets[0]?.url;
  const hits = ADVERSE.filter((w) => text.includes(w));
  const base = { source: src.source, label: src.label, ...(url ? { url } : {}) };
  if (hits.length > 0) {
    return {
      ...base,
      status: "adverse",
      detail: `Possible adverse mentions: ${hits.slice(0, 4).join(", ")}. Read the source before continuing.`,
    };
  }
  if (text.includes(name.toLowerCase().slice(0, 24))) {
    return { ...base, status: "found", detail: "Public presence found, nothing adverse in the visible results." };
  }
  return { ...base, status: "not_found", detail: "No clear public presence on this source." };
}

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

    const { firecrawlConfigured, searchSnippets } = await import("@/lib/firecrawl.server");
    const connected = await firecrawlConfigured();

    const results: MediaCheckResult[] = [];

    for (const cp of counterparties) {
      const query = `"${cp.name}"${cp.jurisdiction ? ` ${cp.jurisdiction}` : ""}`;
      let findings: MediaFinding[];

      if (!connected) {
        findings = SOURCES.map((src) => ({
          source: src.source,
          label: src.label,
          status: "unavailable" as const,
          detail: "Live web scanning is not connected yet — ask an administrator to add Firecrawl.",
        }));
      } else {
        // All six sources are searched at once — Firecrawl returns the result listings without
        // opening each page, which is what social networks and marketplaces need — and then one
        // OpenAI read judges what was actually found about this particular company.
        const searched = await Promise.all(
          SOURCES.map(async (src) => {
            try {
              return { src, snippets: await searchSnippets(src.query(query), 5, 25_000), error: null as string | null };
            } catch (err) {
              return { src, snippets: [] as Snippet[], error: (err as Error).message };
            }
          }),
        );

        const judged = await judgeWithOpenAi(cp.name, cp.jurisdiction, searched);
        findings = searched.map(({ src, snippets, error }): MediaFinding => {
          if (error) return { source: src.source, label: src.label, status: "failed", detail: error };
          const j = judged?.get(src.source);
          if (j) {
            const url = j.url ?? snippets[0]?.url;
            return { source: src.source, label: src.label, status: j.status, detail: j.detail, ...(url ? { url } : {}) };
          }
          return keywordFinding(src, cp.name, snippets);
        });
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
