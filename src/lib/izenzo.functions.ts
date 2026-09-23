import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { POI_COST, WAD_COST } from "@/lib/spine";
import { userFacingText } from "@/lib/userFacingText";
import { isRelevant } from "@/lib/relevance";
import { guessSideFromWording } from "@/lib/tradeSide";
import { nameKey } from "@/lib/dedupeOrgs";

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const txInput = (data: unknown) => z.object({ transactionId: z.string().uuid() }).parse(data);

/** GPT-6 Astra is reserved strictly for the AI+ Recommendations engine (decisionPack.functions.ts).
 * Counterparty search and every web check — the "AI" step and the "AI+" step alike — run on the
 * standard model through Tavily (public internet search) and OpenAI. The "AI+" kind still gets a
 * more thorough pass (higher reasoning effort, a bigger token budget), just never a different,
 * heavier model — Astra was previously used here too, which both broke that separation and made
 * every search wait on Astra's own latency for no benefit specific to search. */
const AI_MODEL = "gpt-5-mini";

function aiPlusOptions(model: string, kind: "ai" | "ai_plus" = "ai_plus") {
  if (model !== AI_MODEL) return {};
  return {
    reasoning_effort: (kind === "ai" ? "low" : "high") as "low" | "high",
    max_completion_tokens: kind === "ai" ? 8000 : 16000,
  };
}

/** Sends one search request. It uses the OpenAI account saved under Admin → Integrations when one
 * is saved, and falls back to the built-in AI service when it is not, so a missing OpenAI key never
 * dead-ends a search. Transient request limits are retried and failures are worded plainly. */
async function chatCompletion(apiKey: string | null, body: unknown): Promise<Response> {
  if (apiKey) {
    const { callOpenAiChat } = await import("@/lib/openaiCall.server");
    return callOpenAiChat(apiKey, body);
  }
  const { callLovableAiChat } = await import("@/lib/lovableAi.server");
  return callLovableAiChat(body, { retries: 2 });
}

/** True when at least one AI service can answer: a saved OpenAI key, or the built-in service. */
async function aiAvailable(apiKey: string | null): Promise<boolean> {
  if (apiKey) return true;
  const { lovableAiConfigured } = await import("@/lib/lovableAi.server");
  return lovableAiConfigured();
}



async function aiFailureMessage(res: Response): Promise<string> {
  const { isLovableAiResponse, lovableAiFailureMessage } = await import("@/lib/lovableAi.server");
  if (isLovableAiResponse(res)) return lovableAiFailureMessage(res);
  const { openAiFailureMessage } = await import("@/lib/openaiCall.server");
  return openAiFailureMessage(res);
}



/** Seal the Proof of Intent. Hard server-side gate: 1 token. */
export const sealProofOfIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(txInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tx, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (error || !tx) throw new Error("Transaction not found");
    if (tx.poi_sealed_at) throw new Error("Proof of Intent is already sealed");
    if (!tx.intent_confirmed_at) throw new Error("Confirm intent before sealing the Proof of Intent");

    // No separate media-scan gate: Online Media Screening and Background Screening are both part
    // of Step 1 and must already be complete for intent to have been confirmed at all.

    // The counterparty's own opt-out, if it linked its account and declined, is checked right up
    // to the moment of sealing — this is exactly the "before any binding agreement" window the
    // opt-out is for.
    // counterparty_response predates the generated Supabase types being refreshed — select "*"
    // and cast, rather than name the column directly.
    const { data: chosenCpRaw } = await supabase
      .from("counterparties")
      .select("*")
      .eq("transaction_id", tx.id)
      .eq("status", "chosen")
      .maybeSingle();
    const chosenCp = chosenCpRaw as { name?: string | null; counterparty_response?: string | null } | null;
    if (chosenCp?.counterparty_response === "declined") {
      throw new Error(
        `${chosenCp?.name ?? "The counterparty"} has opted out of this deal — Proof of Intent cannot be sealed for this choice.`,
      );
    }


    const { data: org } = await supabase
      .from("organisations")
      .select("id, name, credits")
      .eq("id", tx.org_id)
      .maybeSingle();
    if (!org) throw new Error("Organisation not found");
    if ((org.credits ?? 0) < POI_COST)
      throw new Error("Not enough tokens. The Proof of Intent costs 1 token (USD 10).");

    const sealedAt = new Date().toISOString();
    const hash = await sha256(
      JSON.stringify({
        id: tx.id,
        org: org.name,
        title: tx.title,
        commodity: tx.commodity,
        quantity: tx.quantity,
        price: tx.price,
        currency: tx.currency,
        intent_confirmed_at: tx.intent_confirmed_at,
        sealedAt,
      }),
    );

    const { error: debitErr } = await supabase.rpc("atomic_token_adjust", {
      p_org_id: org.id,
      p_delta: -POI_COST,
      p_reason: "Proof of Intent sealed",
      p_transaction_id: tx.id,
    });
    if (debitErr) throw new Error(debitErr.message);
    await supabase
      .from("transactions")
      .update({ poi_sealed_at: sealedAt, poi_hash: hash, stage: "compliance", step: "wad" })
      .eq("id", tx.id);
    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      stage: "trading",
      step: "poi",
      action: "poi_sealed",
      summary: "Proof of Intent sealed",
      fingerprint: hash,
      payload: { sealedAt, cost: POI_COST },
    });

    return { hash, sealedAt, creditsLeft: (org.credits ?? 0) - POI_COST };
  });

/** Complete the WaD case. Hard server-side gate: 3 tokens. */
export const completeWad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        transactionId: z.string().uuid(),
        checks: z.record(z.string(), z.any()),
        decision: z.enum(["cleared", "referred", "blocked"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("Transaction not found");
    if (!tx.poi_sealed_at) throw new Error("Seal the Proof of Intent first");
    if (tx.wad_completed_at) throw new Error("WaD verification is already complete");

    const { data: org } = await supabase
      .from("organisations")
      .select("id, credits")
      .eq("id", tx.org_id)
      .maybeSingle();
    if (!org) throw new Error("Organisation not found");
    if ((org.credits ?? 0) < WAD_COST)
      throw new Error("Not enough tokens. WaD verification costs 3 tokens (USD 30).");

    const now = new Date().toISOString();
    const fingerprint = await sha256(JSON.stringify({ tx: tx.id, checks: data.checks, now }));

    const { error: debitErr } = await supabase.rpc("atomic_token_adjust", {
      p_org_id: org.id,
      p_delta: -WAD_COST,
      p_reason: "WaD verification",
      p_transaction_id: tx.id,
    });
    if (debitErr) throw new Error(debitErr.message);

    const record = {
      transaction_id: tx.id,
      status: data.decision,
      kyc: data.checks["kyc"] ?? {},
      kyb: data.checks["kyb"] ?? {},
      ubo: data.checks["ubo"] ?? {},
      sanctions: data.checks["sanctions"] ?? {},
      pep: data.checks["pep"] ?? {},
      authority: data.checks["authority"] ?? {},
      decided_by: userId,
      decided_at: now,
    };
    const { data: existing } = await supabase
      .from("wad_cases")
      .select("id")
      .eq("transaction_id", tx.id)
      .maybeSingle();
    if (existing) {
      await supabase.from("wad_cases").update(record).eq("id", existing.id);
    } else {
      await supabase.from("wad_cases").insert(record);
    }

    const cleared = data.decision === "cleared";
    await supabase
      .from("transactions")
      .update({
        wad_completed_at: cleared ? now : null,
        stage: cleared ? "execution" : "compliance",
        step: cleared ? "business-docs" : "wad",
      })
      .eq("id", tx.id);

    // File the clearance as a certificate against the deal, the same way Proof of Intent is —
    // otherwise there was no filed record of the WaD case ever completing.
    if (cleared) {
      const body = [
        "IZENZO — WITHOUT A DOUBT (WAD)",
        "",
        `Transaction: ${tx.title}`,
        `Decision: ${data.decision}`,
        `Cleared: ${now}`,
        "",
        `Fingerprint: ${fingerprint}`,
      ].join("\n");
      const path = `deals/${tx.id}/${Date.now()}-wad-cleared.txt`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, new Blob([body], { type: "text/plain" }));
      if (!upErr) {
        await supabase.from("documents").insert({
          transaction_id: tx.id,
          name: `Without a Doubt (WAD) — Cleared — ${tx.title}.txt`,
          doc_type: "certificate",
          notes: "Certificate",
          sha256: fingerprint,
          storage_path: path,
        });
      }
    }

    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      stage: "compliance",
      step: "wad",
      action: "wad_" + data.decision,
      summary: `WaD verification ${data.decision}`,
      fingerprint,
      payload: { cost: WAD_COST, decision: data.decision },
    });

    return { decision: data.decision, fingerprint, creditsLeft: (org.credits ?? 0) - WAD_COST };
  });

type CandidateResult = {
  name: string;
  jurisdiction?: string | undefined;
  sector?: string | undefined;
  score?: number | undefined;
  rationale?: string | undefined;
  sourceUrl?: string | undefined;
  /** The facts from the page that show why this organisation fits. */
  evidence?: string | undefined;
};

export type LocalOrgRow = {
  name: string;
  sector: string | null;
  industry: string | null;
  offerings: string | null;
  ai_brief: string | null;
  country: string | null;
  website: string | null;
  primary_contact_email: string | null;
};

/** Turns registered-organisation rows into search candidates: keeps only the ones relevant to
 * this search and excludes the bidder's own organisation. A recorded contact email is a bonus
 * (used straight away instead of needing enrichment) but never a requirement to be found — a real,
 * relevant registered company with no email on file still belongs in the results. Exported for
 * direct testing — the DB query stays inline in searchCounterparties, since that's the one part
 * that needs a live Supabase connection. */
export function localOrgCandidates(
  orgs: LocalOrgRow[],
  relevanceQuery: string,
  ownName: string,
): { candidates: CandidateResult[]; emails: Map<string, string> } {
  const candidates: CandidateResult[] = [];
  const emails = new Map<string, string>();
  const ownKey = nameKey(ownName);
  for (const org of orgs) {
    // A registered org with no saved contact email used to be excluded outright here — dropped
    // from local matching entirely, no matter how relevant, rather than just missing a pre-filled
    // email the same way any AI/web-found candidate would need enrichment for one. A real,
    // well-matched registered company (e.g. one that simply hasn't filled in that field yet)
    // should still surface; it just won't have an email ready until enrichment finds one.
    if (ownKey && (nameKey(org.name) || org.name.trim().toLowerCase()) === ownKey) continue;
    const candidate: CandidateResult = {
      name: org.name,
      jurisdiction: org.country ?? undefined,
      sector: org.sector ?? org.industry ?? undefined,
      rationale: org.offerings ?? org.ai_brief ?? undefined,
      sourceUrl: org.website ?? undefined,
    };
    const matchText = [org.sector, org.industry, org.offerings, org.ai_brief].filter(Boolean).join(" ");
    if (
      isRelevant(
        { name: candidate.name, sector: candidate.sector, jurisdiction: candidate.jurisdiction, rationale: matchText },
        relevanceQuery,
        { loose: true },
      )
    ) {
      candidates.push(candidate);
      if (org.primary_contact_email) {
        emails.set(nameKey(candidate.name) || candidate.name.toLowerCase(), org.primary_contact_email);
      }
    }
  }
  return { candidates, emails };
}

/** Published directory listings turned straight into candidates. Used when the model returns
 * nothing from the fallback sources, so a search still yields real named organisations. */
async function listingCandidates(query: string, limit = 6): Promise<CandidateResult[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("responder_listings")
      .select("name, sector, jurisdiction, summary, source_url")
      .eq("published", true)
      .eq("is_example", false)
      .order("verified_at", { ascending: false, nullsFirst: false })
      .limit(200);
    return (data ?? []).map((r) => ({
      name: r.name,
      jurisdiction: r.jurisdiction ?? undefined,
      sector: r.sector ?? undefined,
      rationale: r.summary ? String(r.summary).slice(0, 160) : undefined,
      sourceUrl: r.source_url ?? undefined,
    }))
      .filter((c) => isRelevant(c, query))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/** Scrapes the open web for one query and turns the pages into grounding context for the model.
 * When the live web cannot be read, it falls back to the published Izenzo directory rather than
 * failing the whole search — but it never lets the model answer without real sources. */
const webModelsFor = (_kind: "ai" | "ai_plus") => [AI_MODEL, "gpt-5"];

/** Finds real organisations on the live web with OpenAI's web search. A failure is returned, not
 * thrown, so the caller can still fall back to the published directory. */
async function findOnWeb(
  apiKey: string | null,

  kind: "ai" | "ai_plus",
  instructions: string,
  input: string,
  query?: string,
) {
  const { webSearch } = await import("@/lib/openaiWebSearch.server");
  const { loadTavilyApiKey, tavilySearch } = await import("@/lib/tavily.server");
  // Tavily (public internet search) plus OpenAI when Tavily is connected; OpenAI's own web search
  // otherwise.
  const tavilyKey = query ? await loadTavilyApiKey() : null;
  if (tavilyKey && query) {
    try {
      const pages = await tavilySearch(tavilyKey, query, { depth: kind === "ai" ? "basic" : "advanced", max: 8 });
      if (pages.length > 0) {
        const model = AI_MODEL;
        const res = await chatCompletion(apiKey, {
          model,
          ...aiPlusOptions(model, kind),
          messages: [
            {
              role: "system",
              content:
                instructions +
                " The public internet search results are given in the message: use only those pages, and set sourceUrl to one of their addresses.",
            },
            {
              role: "user",
              content: `${input}\n\nSearch results:\n${pages
                .map((pg, i) => `${i + 1}. ${pg.title} — ${pg.url}\n${pg.content}`)
                .join("\n\n")}`,
            },
          ],
        });
        if (!res.ok) throw new Error(await aiFailureMessage(res));
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return {
          output: json.choices?.[0]?.message?.content ?? "",
          model,
          sources: pages.map((pg) => ({ label: pg.title || pg.url, url: pg.url })),
          failures: [] as { label: string; reason: string }[],
          webError: null as Error | null,
        };
      }
    } catch (err) {
      return {
        output: "",
        model: AI_MODEL,
        sources: [] as { label: string; url: string }[],
        failures: [{ label: "Internet search", reason: (err as Error).message }],
        webError: err as Error,
      };
    }
  }
  if (!apiKey) {
    // Without a saved OpenAI key there is no internet search of its own to fall back on — the
    // reasoning still ran on the built-in service above, so report only the missing search.
    const reason =
      "Internet search is unavailable: connect Tavily, or add an OpenAI key in Admin → Integrations.";
    return {
      output: "",
      model: AI_MODEL,
      sources: [] as { label: string; url: string }[],
      failures: [{ label: "Internet search", reason }],
      webError: new Error(reason) as Error | null,
    };
  }
  try {
    const r = await webSearch({
      apiKey,

      instructions,
      input,
      models: webModelsFor(kind),
      effort: kind === "ai" ? "low" : "medium",
    });
    return {
      output: r.text,
      model: r.model,
      sources: r.sources.map((x) => ({ label: x.title || x.url, url: x.url })),
      failures: [] as { label: string; reason: string }[],
      webError: null as Error | null,
    };
  } catch (err) {
    return {
      output: "",
      model: AI_MODEL,
      sources: [] as { label: string; url: string }[],
      failures: [{ label: "Web search", reason: (err as Error).message }],
      webError: err as Error,
    };
  }
}

const GROUNDING_RULES =
  "Write every rationale and sector only about the organisation and how its products or services fit what the person asked for — never mention AI, AI+, Izenzo, models, searching, scoring, sources or how this list was produced. Use web search to find real organisations. Only return organisations that actually appear in what you found. Never invent a company. Only include an organisation that clearly trades in, or is directly connected to, what the person asked for (and the place, if they named one) — leave out anything unrelated, and return an empty array [] if nothing qualifies. For each one, set sourceUrl to the address of the page you found it on.";

function parseCandidates(raw: string): CandidateResult[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .map((c) => ({
        name: String(c["name"] ?? "").slice(0, 200),
        jurisdiction: c["jurisdiction"] ? String(c["jurisdiction"]).slice(0, 200) : undefined,
        sector: userFacingText(c["sector"] ? String(c["sector"]).slice(0, 200) : null) ?? undefined,
        score: typeof c["score"] === "number" ? c["score"] : undefined,
        rationale: userFacingText(c["rationale"] ? String(c["rationale"]).slice(0, 500) : null) ?? undefined,
        sourceUrl:
          typeof c["sourceUrl"] === "string" && /^https?:\/\//.test(c["sourceUrl"])
            ? c["sourceUrl"].slice(0, 500)
            : undefined,
      }))
      .filter((c) => c.name.length > 0)
      .slice(0, 8);
  } catch {
    return [];
  }
}

type ScoreComponent = { label: string; points: number; max: number; note: string };

/** Turns a candidate into an explainable percentage. The model's own read is only one of five
 * inputs, so the number can always be broken down for the person deciding — an opaque LLM score
 * is not something anyone can act on. */
function scoreCandidate(
  c: CandidateResult,
  ctx: { subject: string; region: string | null; verified: boolean },
): { total: number; components: ScoreComponent[] } {
  const wanted = keywords(ctx.subject);
  const theirs = keywords([c.name, c.sector ?? "", c.rationale ?? ""].join(" "));
  let hits = 0;
  for (const w of wanted) if (theirs.has(w)) hits++;
  const fit = wanted.size ? Math.round((hits / wanted.size) * 30) : 0;

  const region = (ctx.region ?? "").trim().toLowerCase();
  const where = (c.jurisdiction ?? "").trim().toLowerCase();
  let place = 10;
  let placeNote = "No location on record";
  if (region && where) {
    const same = where.includes(region) || region.includes(where);
    place = same ? 20 : 4;
    placeNote = same ? `Located in ${c.jurisdiction}` : `${c.jurisdiction}, not ${ctx.region}`;
  } else if (where) {
    place = 14;
    placeNote = `Located in ${c.jurisdiction}`;
  }

  const evidence = c.sourceUrl ? 20 : 6;
  const verified = ctx.verified ? 15 : 0;
  const read = Math.round(((c.score ?? 50) / 100) * 15);

  const components: ScoreComponent[] = [
    {
      label: "What they trade",
      points: fit,
      max: 30,
      note: hits > 0 ? `${hits} of ${wanted.size} search terms appear on their listing` : "No search terms matched",
    },
    { label: "Where they are", points: place, max: 20, note: placeNote },
    {
      label: "Evidence",
      points: evidence,
      max: 20,
      note: c.sourceUrl ? "Found on a real page we can open" : "No page recorded",
    },
    {
      label: "Verified on Izenzo",
      points: verified,
      max: 15,
      note: ctx.verified ? "Identity confirmed through the app" : "Not verified through the app yet",
    },
    { label: "Fit with your request", points: read, max: 15, note: c.rationale ?? "No note" },
  ];

  return { total: components.reduce((sum, k) => sum + k.points, 0), components };
}

/** Pulls the searchable subject out of a document summary when nobody typed a commodity — the
 * first substantial line of the bullet summary, stripped of bullet marks and filler, capped so the
 * web query stays a query rather than a paragraph. */
function keywordsFromSummary(summary: string): string {
  const line = summary
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*]\s*/, "").replace(/^(proposal|scope|deliverables)\s*:\s*/i, "").trim())
    .find(
      (l) =>
        l.length > 8 &&
        !/^not stated/i.test(l) &&
        !/^(scope|deliverables|evaluation criteria|due date)\b/i.test(l),
    );
  if (!line) return "";
  return line
    .replace(/[.,;:]/g, " ")
    .split(/\s+/)
    .slice(0, 12)
    .join(" ")
    .slice(0, 160)
    .trim();
}

/** Decides from what the person typed and attached whether this is a search for a SELLER (they are
 * buying — a Bid) or a search for a BUYER (they are selling — an Offer). Returns null when it
 * genuinely cannot tell, and the workspace stays a plain Workspace. */
export const classifyTradeSide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(txInput)
  .handler(async ({ data, context }): Promise<{ direction: "bid" | "offer" | null }> => {
    const { supabase } = context;
    const { data: tx } = await supabase.from("transactions").select("*").eq("id", data.transactionId).maybeSingle();
    if (!tx) return { direction: null };
    const typed = ((tx as { search_prompt?: string | null }).search_prompt ?? "").trim();
    const summary = ((tx.document_summary as string | null) ?? "").trim();
    const commodity = (tx.commodity ?? "").trim();
    const text = [typed, commodity, summary].filter(Boolean).join("\n");
    if (!text) return { direction: null };

    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (apiKey) {
      try {
        const model = AI_MODEL;
        const res = await chatCompletion(apiKey, {
          model,
          ...aiPlusOptions(model, "ai"),
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Decide from what a person typed and attached whether they are searching for a SELLER (a supplier, provider or vendor — they want to buy or procure) or searching for a BUYER (a customer, buyer or off-taker — they want to sell or supply). " +
                'Reply with JSON only: {"lookingFor":"seller"|"buyer"|"unclear","reason":string}. Always choose the more likely of the two from the wording and context (a request for proposals, a tender, or a need for goods or a service means seller; goods or services being offered for sale means buyer). An offer, quotation, price list or sales proposal from the person — goods they hold or can supply, with a price, quantity or delivery terms such as "delivered Durban" — means they are SELLING and need a BUYER, even when the same product is named throughout. Use "unclear" only if the text has no such hint at all.',
            },
            { role: "user", content: text.slice(0, 6000) },
          ],
        });
        if (res.ok) {
          const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const content = json.choices?.[0]?.message?.content ?? "";
          const parsed = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1)) as { lookingFor?: string };
          if (parsed.lookingFor === "seller") return { direction: "bid" };
          if (parsed.lookingFor === "buyer") return { direction: "offer" };
          return { direction: null };
        }
      } catch {
        // Fall through to the plain wording check below.
      }
    }
    return { direction: guessSideFromWording(text) };
  });

/** AI-driven counterparty search. AI/AI+ propose candidates from the bid's terms; a person still chooses. */
export const searchCounterparties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        transactionId: z.string().uuid(),
        kind: z.enum(["ai", "ai_plus"]),
        region: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Timing only, so a slow search can be diagnosed with real numbers next time instead of a
    // guess — recorded as a transaction_event once the search finishes, win or lose.
    const startedAt = Date.now();
    let localMs = 0;
    let pipelineMs = 0;
    const { supabase } = context;
    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (!(await aiAvailable(apiKey)))
      throw new Error("No AI service is available. Add and enable OpenAI in Admin → Integrations.");


    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("Transaction not found");

    const { data: bids } = await supabase
      .from("bid_offers")
      .select("direction, price, quantity, unit, currency, terms")
      .eq("transaction_id", tx.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const latestBid = bids?.[0];

    // Search the real web first — the model only ranks what was actually found.
    const wantedSide = (latestBid?.direction ?? "bid") === "bid" ? "suppliers" : "buyers";
    // What is actually being traded: whatever was typed into the Search field, plus whatever the
    // uploaded documents said when there are any — never one replacing the other. With nothing
    // typed and no documents read yet, fall back to the commodity field, then to the attached
    // filenames. The bid's own title ("New Bid") is never a search term — searching on it is what
    // used to return nothing.
    const docSummary = (tx.document_summary as string | null) ?? "";
    const typedPrompt = ((tx as { search_prompt?: string | null }).search_prompt ?? "").trim();
    const docKeywords = docSummary.trim() ? keywordsFromSummary(docSummary) : "";
    let subject = [typedPrompt.slice(0, 160), docKeywords].filter(Boolean).join(" ").slice(0, 200).trim();
    if (!subject) subject = tx.commodity?.trim() ?? "";
    // What a result is checked against is the short, deliberate description of the bid — what was
    // typed, the commodity, or the bid's title — not the long sentence pulled from a document, whose
    // many incidental words no real organisation's description would share.
    const bidTitle = tx.title && tx.title !== "New Bid" && tx.title !== "New Offer" ? tx.title : "";
    const relevanceQuery = typedPrompt.slice(0, 160) || tx.commodity?.trim() || bidTitle || subject;
    if (!subject) {
      // Nothing typed and no summary saved yet (documents attached but still unread): fall back to
      // what the attached filenames say, so the search runs instead of dead-ending the workspace.
      const { data: docs } = await supabase
        .from("documents")
        .select("name")
        .eq("transaction_id", tx.id)
        .limit(5);
      subject = (docs ?? [])
        .map((d) => (d.name ?? "").replace(/\.[a-z0-9]+$/i, "").replace(/[_\-]+/g, " "))
        .join(" ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !/^\d+$/.test(w))
        .slice(0, 12)
        .join(" ")
        .slice(0, 160)
        .trim();
    }
    if (!subject) {
      throw new Error(
        "There is nothing to search on yet — add the commodity, type what you're looking for, or attach a document that says what is being traded.",
      );
    }

    // The bidder's own organisation is never a counterparty for its own bid.
    const { data: ownOrg } = await supabase.from("organisations").select("name").eq("id", tx.org_id).maybeSingle();
    const ownName = (ownOrg?.name ?? "").trim().toLowerCase();
    const notOwn = (c: { name: string }) => !ownName || c.name.trim().toLowerCase() !== ownName;

    // Registered organisations on Izenzo are searched locally, before any AI or web search runs —
    // a company that already has a verified account here is offered with its own recorded email
    // straight away, rather than being sent out to the AI/web pipeline to reconstruct one. This is
    // additive, never a replacement: AI/web search still runs afterwards for everyone else, and a
    // local lookup failure here must never block the search the person is waiting on.
    let localMatches: CandidateResult[] = [];
    let localEmails = new Map<string, string>();
    {
      const t0 = Date.now();
      try {
        const { data: orgs } = await supabase
          .from("organisations")
          .select("name, sector, industry, offerings, ai_brief, country, website, primary_contact_email")
          .neq("id", tx.org_id)
          // Without an explicit order, which 300 rows a table past that size returns is whatever
          // order Postgres happens to hand back — not guaranteed to be the same rows twice, and
          // not guaranteed to include any particular organisation at all. Most-recently-updated
          // first is at least deterministic and biases toward the freshest, most complete profiles.
          .order("updated_at", { ascending: false })
          .limit(300);
        const local = localOrgCandidates((orgs ?? []) as LocalOrgRow[], relevanceQuery, ownOrg?.name ?? "");
        localMatches = local.candidates;
        localEmails = local.emails;
      } catch {
        // The local registry is an enhancement, never a blocker.
      }
      localMs = Date.now() - t0;
    }
    const localKeys = new Set(localMatches.map((c) => nameKey(c.name) || c.name.toLowerCase()));

    // Bid + documents → understand the transaction → determine the required counterparty → search
    // the public internet → identify real organisations → test relevance → reason over the
    // evidence → return the counterparties.
    const pipelineStartedAt = Date.now();
    const { findCounterparties } = await import("@/lib/counterpartyPipeline.server");
    const pipeline = await findCounterparties({
      apiKey,
      kind: data.kind,
      chatModel: AI_MODEL,
      webModels: webModelsFor(data.kind),
      tavilyKey: await (await import("@/lib/tavily.server")).loadTavilyApiKey(),
      txKey: tx.id,
      direction: (latestBid?.direction ?? "bid") === "offer" ? "offer" : "bid",
      commodity: tx.commodity ?? null,
      quantity: `${tx.quantity ?? "n/a"} ${tx.unit ?? ""}`.trim(),
      price: `${tx.price ?? "n/a"} ${tx.currency}`,
      incoterms: tx.incoterms ?? null,
      jurisdiction: tx.jurisdiction ?? null,
      region: data.region ?? null,
      terms: latestBid?.terms ?? null,
      typedPrompt,
      docSummary,
      fallbackSubject: subject,
      ownOrgName: ownOrg?.name ?? "",
    });
    pipelineMs = Date.now() - pipelineStartedAt;
    const { model, sources, failures } = pipeline;
    const web = { webError: pipeline.webError };
    // A last, loose sanity check against the brief's own wording, on top of the evidence test.
    const briefQuery = [
      relevanceQuery,
      pipeline.brief.role,
      ...pipeline.brief.organisationTypes,
      ...pipeline.brief.capabilities,
      ...pipeline.brief.sectors,
    ].join(" ");
    // Everything the search found but did not keep, with the reason — so "no matches" can be read
    // as "these were found, here is why each was dropped" instead of silence.
    const notKept: { name: string; reason: string }[] = pipeline.rejected.map((r) => ({
      name: r.name,
      reason: r.reason,
    }));
    let candidates: CandidateResult[] = pipeline.candidates.filter((c) => {
      if (!notOwn(c)) {
        notKept.push({ name: c.name, reason: "The bidder's own organisation." });
        return false;
      }
      const relevant = isRelevant(
        { name: c.name, sector: c.sector, jurisdiction: c.jurisdiction, rationale: `${c.rationale ?? ""} ${c.evidence ?? ""}` },
        briefQuery,
        { loose: true },
      );
      if (!relevant) {
        notKept.push({ name: c.name, reason: "Nothing on its page matched what this bid is asking for." });
      }
      return relevant;
    });
    if (candidates.length === 0) candidates = (await listingCandidates(relevanceQuery, 6)).filter(notOwn);
    // Registered platform organisations found locally go first, ahead of anything AI or the
    // directory fallback found for the same company — deduped by the same normalised-name rule
    // used everywhere else, so a company already matched locally is never listed a second time.
    candidates = [...localMatches, ...candidates.filter((c) => !localKeys.has(nameKey(c.name) || c.name.toLowerCase()))];
    if (candidates.length === 0) {
      // Nothing kept: record what was considered and why it was dropped, so an empty result can be
      // explained afterwards instead of disappearing.
      try {
        await supabase.from("transaction_events").insert({
          transaction_id: tx.id,
          actor_id: context.userId,
          stage: "trading",
          step: "search",
          action: "counterparty_search_completed",
          summary: `${data.kind.toUpperCase()} search kept 0 of ${notKept.length} organisation${notKept.length === 1 ? "" : "s"} considered`,
          payload: {
            kind: data.kind,
            candidateCount: 0,
            consideredCount: notKept.length,
            notKept: notKept.slice(0, 30),
            hadDocuments: Boolean(docSummary),
          },
        });
      } catch {
        // Diagnostics only.
      }
      // A web search that itself failed is reported as that, not as "nothing relevant exists".
      if (web.webError) throw web.webError;
      if (notKept.length > 0) {
        throw new Error(
          `${notKept.length} organisation${notKept.length === 1 ? " was" : "s were"} found but none were kept. ` +
            notKept
              .slice(0, 5)
              .map((r) => `${r.name}: ${r.reason}`)
              .join(" "),
        );
      }
      throw new Error(
        "No organisations relevant to this search were found. Try rewording it or adding more detail.",
      );
    }

    const source = data.kind === "ai" ? "ai_search" : "ai_plus_search";

    // Which of these names have already proved who they are through the app — one of the five
    // inputs to the match percentage.
    const verifiedNames = new Set<string>();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: listed } = await supabaseAdmin
        .from("responder_listings")
        .select("name, verified_at")
        .in("name", candidates.map((c) => c.name));
      for (const row of listed ?? []) {
        if (row.verified_at) verifiedNames.add(row.name.toLowerCase());
      }
    } catch {
      // Absent verification data simply scores zero for that component.
    }

    const scoreRegion = data.region ?? tx.jurisdiction ?? null;
    const rows = candidates.map((c) => {
      const key = nameKey(c.name) || c.name.toLowerCase();
      const isLocal = localKeys.has(key);
      const localEmail = localEmails.get(key) ?? null;
      const scored = scoreCandidate(c, {
        subject,
        region: scoreRegion,
        // A registered platform organisation is verified by definition — it doesn't need the
        // separate responder-directory check that stands in for verification elsewhere.
        verified: isLocal || verifiedNames.has(c.name.toLowerCase()),
      });
      return {
        transaction_id: tx.id,
        name: c.name,
        jurisdiction: c.jurisdiction ?? null,
        sector: c.sector ?? null,
        score: scored.total,
        source: isLocal ? "platform_registry" : source,
        rationale: c.rationale ?? null,
        status: "surfaced",
        // A local match already has its own recorded email/website — no need to wait for the
        // shortlist-time enrichment lookup that web-found candidates still rely on.
        ...(localEmail ? { contact_email: localEmail, website: c.sourceUrl ?? null } : {}),
        // Evidence lives in media_flags so the source page can be opened next to the name, along
        // with the breakdown behind the percentage.
        media_flags: {
          ...(isLocal
            ? { evidence: [{ source: "platform_registry", note: "Registered organisation on the Izenzo platform" }] }
            : c.sourceUrl
              ? { evidence: [{ url: c.sourceUrl, source: "web_search", ...(c.evidence ? { note: c.evidence } : {}) }] }
              : {}),
          scoring: { total: scored.total, components: scored.components },
        },
      };
    });
    // AI and AI+ both run for every bid and often find the same organisations — one that is already
    // on this bid (or repeated within this batch) is not added a second time.
    const { data: already } = await supabase.from("counterparties").select("name").eq("transaction_id", tx.id);
    const seenKeys = new Set((already ?? []).map((r) => nameKey(r.name as string)));
    const freshRows = rows.filter((r) => {
      const key = nameKey(r.name) || r.name.toLowerCase();
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    const { data: inserted, error } = freshRows.length
      ? await supabase.from("counterparties").insert(freshRows).select()
      : { data: [], error: null };
    if (error) throw error;

    // Publish each web-found name to the public Responder directory as an unclaimed listing,
    // keeping the page it was found on as evidence. Private per-bid rows above stay untouched.
    // Names already listed are skipped, so an existing (or claimed) listing is never overwritten.
    // A registered platform organisation is already a claimed account, not an unclaimed lead, so
    // local matches are never published here.
    try {
      const webCandidates = candidates.filter((c) => !localKeys.has(nameKey(c.name) || c.name.toLowerCase()));
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: already } = await supabaseAdmin
        .from("responder_listings")
        .select("name")
        .in("name", webCandidates.map((c) => c.name));
      const taken = new Set((already ?? []).map((r) => r.name.toLowerCase()));
      const fresh = webCandidates.filter((c) => !taken.has(c.name.toLowerCase()));
      if (fresh.length > 0) {
        await supabaseAdmin.from("responder_listings").insert(
          fresh.map((c) => ({
            name: c.name,
            sector: c.sector ?? null,
            jurisdiction: c.jurisdiction ?? null,
            summary: c.rationale ?? null,
            source: "web_search",
            source_url: c.sourceUrl ?? null,
            published: true,
          })),
        );
      }
    } catch {
      // Directory publishing must never break the search the person is waiting on.
    }

    // Timing only — recorded so a slow search can be diagnosed with real numbers (which stage
    // actually took the time) rather than a guess, the next time someone reports one.
    const totalMs = Date.now() - startedAt;
    try {
      await supabase.from("transaction_events").insert({
        transaction_id: tx.id,
        actor_id: context.userId,
        stage: "trading",
        step: "search",
        action: "counterparty_search_completed",
        summary: `${data.kind.toUpperCase()} search found ${(inserted ?? []).length} counterpart${(inserted ?? []).length === 1 ? "y" : "ies"} in ${(totalMs / 1000).toFixed(1)}s`,
        payload: {
          kind: data.kind,
          totalMs,
          localMs,
          pipelineMs,
          candidateCount: (inserted ?? []).length,
          consideredCount: notKept.length + candidates.length,
          notKept: notKept.slice(0, 30),
          hadDocuments: Boolean(docSummary),
        },
      });
    } catch {
      // Diagnostics only — never blocks returning the result.
    }

    return {
      candidates: inserted ?? [],
      model,
      sourcesRead: sources.map((s) => ({ label: s.label, url: s.url })),
      sourcesSkipped: failures.map((f) => ({ label: f.label, reason: f.reason })),
      notKept: notKept.slice(0, 30),
    };
  });

/** Marks/unmarks a discovered counterparty as shortlisted — a non-committal "interested" flag a
 * bidder or responder can toggle from the Record panel. Separate from `status:"chosen"`, which is
 * the existing single, final pick made later in ChoiceStep. */
export const setCounterpartyShortlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        counterpartyId: z.string().uuid(),
        shortlisted: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("counterparties")
      .update({ shortlisted: data.shortlisted })
      .eq("id", data.counterpartyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


/** Free-text AI/AI+ counterparty discovery for the Discover Counterparties screen — not tied to
 * a transaction, so results are returned to the caller rather than written to `counterparties`
 * (that table requires a transaction_id). A person adds a result to a real case from there. */
export const discoverCounterpartiesByQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        query: z.string().min(2).max(300),
        role: z.enum(["buyer", "seller"]),
        kind: z.enum(["ai", "ai_plus"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (!(await aiAvailable(apiKey)))
      throw new Error("No AI service is available. Add and enable OpenAI in Admin → Integrations.");


    const counterpart = data.role === "buyer" ? "suppliers/sellers" : "buyers";
    const system =
      data.kind === "ai"
        ? `You are the Izenzo counterparty search assistant. ${GROUNDING_RULES} The user is a ${data.role} searching for ${counterpart}. Pick the organisations you find that match their search. You never decide and never contact anyone — you only propose candidates for a person to review. Respond with ONLY a JSON array, each item: {"name":string,"jurisdiction":string,"sector":string,"score":number 0-100,"rationale":string under 40 words,"sourceUrl":string}. No prose outside the array.`
        : `You are Izenzo AI+, a deeper counterparty search. ${GROUNDING_RULES} The user is a ${data.role} searching for ${counterpart}. Pick the best-matched organisations in the sources, weighing jurisdiction fit, sector fit and plausibility. You never decide and never contact anyone. Respond with ONLY a JSON array, each item: {"name":string,"jurisdiction":string,"sector":string,"score":number 0-100,"rationale":string under 40 words covering fit and any risk notes,"sourceUrl":string}. No prose outside the array.`;

    const prompt = `Search the web for: "${data.query}" ${counterpart}\nRole: ${data.role}\nPropose 4-6 real candidates found on the web.`;

    const web = await findOnWeb(apiKey, data.kind, system, prompt, `${data.query} ${counterpart}`);
    const { output, model, sources, failures } = web;
    let candidates = parseCandidates(output).filter((c) => isRelevant(c, data.query));
    if (candidates.length === 0) candidates = await listingCandidates(data.query, 6);
    if (candidates.length === 0 && web.webError) throw web.webError;

    return {
      candidates,
      model,
      kind: data.kind,
      sourcesRead: sources.map((s) => ({ label: s.label, url: s.url })),
      sourcesSkipped: failures.map((f) => ({ label: f.label, reason: f.reason })),
    };
  });

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "was",
  "our", "their", "have", "has", "will", "can", "all", "not", "who", "what", "how",
  "www", "com", "https", "http", "a", "an", "of", "to", "in", "on", "at", "by", "or",
]);

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** Fetches a candidate's own website (via the counterparty-discovery edge function's scrape mode)
 * and scores how well its content overlaps with the search query — a cheap signal for "do they
 * actually sell what we're looking for", without a second LLM round trip per candidate. */
export const checkCandidateProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        url: z.string().url(),
        query: z.string().min(2).max(300),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let text = "";
    let note = "";

    // Preferred path: Firecrawl's remote browser, which renders JavaScript-only sites.
    const { firecrawlConfigured, fetchPageText } = await import("@/lib/firecrawl.server");
    if (await firecrawlConfigured()) {
      try {
        text = await fetchPageText(data.url);
      } catch (err) {
        note = (err as Error).message;
      }
    }

    if (!text) {
      const { data: result, error } = await supabase.functions.invoke("counterparty-discovery", {
        body: { mode: "scrape", url: data.url },
      });
      if (error) return { text: "", matchScore: 0, note: note || error.message };
      text = result?.text ?? "";
      note = note || result?.note || "";
    }

    if (!text) return { text: "", matchScore: 0, note: note || "No content found" };


    const pageWords = keywords(text);
    const queryWords = keywords(data.query);
    const overlap = [...queryWords].filter((w) => pageWords.has(w));
    const matchScore = queryWords.size === 0 ? 0 : Math.round((overlap.length / queryWords.size) * 100);

    return { text: text.slice(0, 400), matchScore, matchedTerms: overlap };
  });

/** AI and AI+ proposals. AI proposes; a person always confirms. */
export const runAiProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        transactionId: z.string().uuid(),
        kind: z.enum(["ai", "ai_plus"]),
        question: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (!(await aiAvailable(apiKey)))
      throw new Error("No AI service is available. Add and enable OpenAI in Admin → Integrations.");


    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("Transaction not found");

    const { data: docs } = await supabase
      .from("documents")
      .select("name, doc_type, notes")
      .eq("transaction_id", tx.id);
    const { data: bids } = await supabase
      .from("bid_offers")
      .select("direction, price, quantity, unit, currency, terms, status")
      .eq("transaction_id", tx.id);

    const system =
      data.kind === "ai"
        ? "You are the Izenzo trading assistant. Read the transaction record and propose. You never decide and never adopt a choice on the user's behalf. Answer in short labelled sections with plain professional language."
        : "You are Izenzo AI+. Produce a deeper analysis: counterparty risk, pricing sanity check, jurisdiction and regulatory notes, documentation gaps, and questions the party should ask before intent. You never decide. Use short labelled sections.";

    const prompt = [
      `Transaction: ${tx.title}`,
      `Commodity: ${tx.commodity ?? "n/a"}`,
      `Quantity: ${tx.quantity ?? "n/a"} ${tx.unit ?? ""}`,
      `Price: ${tx.price ?? "n/a"} ${tx.currency}`,
      `Incoterms: ${tx.incoterms ?? "n/a"}`,
      `Jurisdiction: ${tx.jurisdiction ?? "n/a"}`,
      `Bids/offers: ${JSON.stringify(bids ?? [])}`,
      `Documents: ${JSON.stringify(docs ?? [])}`,
      data.question ? `Specific question: ${data.question}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const model = AI_MODEL;
    const res = await chatCompletion(apiKey, {
      model,
      ...aiPlusOptions(model, data.kind),
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });
    if (res.status === 402) {
      const { alertLowFunds } = await import("@/lib/opsAlerts.server");
      void alertLowFunds("OpenAI", 402);
      throw new Error("AI credits are exhausted for this workspace — support has been notified.");
    }
    if (!res.ok) throw new Error(await aiFailureMessage(res));
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const output = json.choices?.[0]?.message?.content ?? "";

    const { data: proposal } = await supabase
      .from("ai_proposals")
      .insert({
        transaction_id: tx.id,
        kind: data.kind,
        prompt: data.question ?? null,
        output,
        model,
      })
      .select()
      .single();

    return { output, id: proposal?.id ?? null };
  });

/** Reads whatever the deal actually recorded — fields, bid/offer terms, uploaded documents — and
 * asks the AI to name the material terms a person would want confirmed before signing intent.
 * Every deal type (goods, services, a lease, a licence…) carries different terms, so this never
 * hardcodes a fixed field list — a services deal has no "quantity/unit" the way a commodity trade
 * does, and a fixed dl of trade-specific fields either sat blank or lied by omission for those. */
export const extractMaterialTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(txInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();

    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("Transaction not found");

    // A safe, always-available fallback if AI is unreachable — never leaves the confirmation
    // screen with nothing on it.
    const fallback = [
      { label: "Transaction", value: tx.title },
      ...(tx.commodity ? [{ label: "Commodity", value: tx.commodity }] : []),
      ...(tx.quantity ? [{ label: "Quantity", value: `${tx.quantity} ${tx.unit ?? ""}`.trim() }] : []),
      ...(tx.price ? [{ label: "Price", value: `${tx.price} ${tx.currency}` }] : []),
      ...(tx.incoterms ? [{ label: "Incoterms", value: tx.incoterms }] : []),
      ...(tx.jurisdiction ? [{ label: "Jurisdiction", value: tx.jurisdiction }] : []),
    ];
    if (!apiKey) return { terms: fallback, source: "fallback" as const };

    const { data: bids } = await supabase
      .from("bid_offers")
      .select("direction, price, quantity, unit, currency, terms, status")
      .eq("transaction_id", tx.id);
    const { data: docs } = await supabase
      .from("documents")
      .select("name, doc_type, notes")
      .eq("transaction_id", tx.id);

    const prompt = [
      `Transaction record: ${JSON.stringify(tx)}`,
      `Bids/offers: ${JSON.stringify(bids ?? [])}`,
      `Documents on file: ${JSON.stringify(docs ?? [])}`,
    ].join("\n");

    try {
      // This has a safe fallback below, so it never spends the retry budget a free OpenAI
      // account allows — the document read is what needs those retries.
      const { callAiChat } = await import("@/lib/lovableAi.server");
      const res = await callAiChat(
        apiKey,
        {
          model: AI_MODEL,
          ...aiPlusOptions(AI_MODEL, "ai"),
          messages: [
            {
              role: "system",
              content:
                "You read a trade record (which may be goods, services, a lease, a licence, or anything else two parties are trading) and name the material terms a party should read and confirm before expressing intent to transact. Pick whichever terms actually apply to THIS deal — never force in a field the record doesn't have, and never invent a value. Reply with ONLY a JSON array of {\"label\": string, \"value\": string}, 4-8 entries, most important first. No prose, no markdown fence.",
            },
            { role: "user", content: prompt },
          ],
        },
        { retries: 0 },
      );

      if (!res.ok) return { terms: fallback, source: "fallback" as const };
      const json = (await res.json()) as { choices: { message: { content: string } }[] };
      const raw = (json.choices?.[0]?.message?.content ?? "").trim();
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (t): t is { label: string; value: string } =>
            typeof t === "object" && t !== null && typeof (t as { label?: unknown }).label === "string" && typeof (t as { value?: unknown }).value === "string",
        ) &&
        parsed.length > 0
      ) {
        return { terms: parsed, source: "ai" as const };
      }
      return { terms: fallback, source: "fallback" as const };
    } catch {
      return { terms: fallback, source: "fallback" as const };
    }
  });

const DOC_TYPES = ["identity", "term_sheet", "specification", "certificate", "contract", "other"] as const;

function classifyByFilename(filename: string): (typeof DOC_TYPES)[number] {
  const n = filename.toLowerCase();
  if (/passport|id[\s_-]?card|driver|national[\s_-]?id|kyc/.test(n)) return "identity";
  if (/contract|agreement|sale/.test(n)) return "contract";
  if (/term[\s_-]?sheet/.test(n)) return "term_sheet";
  if (/cert/.test(n)) return "certificate";
  if (/spec/.test(n)) return "specification";
  return "other";
}

type DirectionGuess = "bid" | "offer" | null;

/** Filenames don't usually say "bid" or "offer" outright, but they often hint at which side of
 * the trade the document belongs to — a tender/RFQ/proposal reads as an opening bid, a quotation
 * or reply reads as a response to one. Used only as a fallback when AI isn't configured. */
function directionByFilename(filename: string): DirectionGuess {
  const n = filename.toLowerCase();
  if (/response|reply|quote|quotation|counter[\s_-]?offer|offer/.test(n)) return "offer";
  if (/rfq|tender|request[\s_-]?for|proposal|bid/.test(n)) return "bid";
  return null;
}

/** AI-assisted document classification for the compact Simple Mode bid wizard's upload step —
 * also guesses, from the same filename, whether the document reads as an opening bid proposal or
 * a response/offer to one, so a new deal's BID/OFF reference can be set from what's actually
 * uploaded rather than a side picked blind before any document exists. Falls back to filename
 * heuristics if AI isn't configured, so uploads never block on it. */
export const classifyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ filename: z.string().min(1).max(300) }).parse(data))
  .handler(async ({ data }) => {
    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    const fallbackType = classifyByFilename(data.filename);
    const fallbackDirection = directionByFilename(data.filename);
    if (!apiKey) return { docType: fallbackType, directionGuess: fallbackDirection, source: "heuristic" as const };

    try {
      // Filename heuristics below cover this completely, so it gives up at once on a busy
      // account rather than using up the few requests a free OpenAI account allows per minute.
      const { callAiChat } = await import("@/lib/lovableAi.server");
      const res = await callAiChat(
        apiKey,
        {
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: `Classify a trade-deal document by its filename alone. Respond with ONLY two lowercase words separated by a comma, nothing else: first, exactly one of ${DOC_TYPES.join(
                ", ",
              )} ("identity" means a personal or entity ID/KYC document); second, exactly one of bid, offer, unknown — "bid" if the filename reads like an opening proposal/tender/RFQ, "offer" if it reads like a response/quotation/reply to one, "unknown" if it's not clear.`,
            },
            { role: "user", content: data.filename },
          ],
        },
        { retries: 0 },
      );

      if (!res.ok) return { docType: fallbackType, directionGuess: fallbackDirection, source: "heuristic" as const };
      const json = (await res.json()) as { choices: { message: { content: string } }[] };
      const raw = (json.choices?.[0]?.message?.content ?? "").trim().toLowerCase();
      const [typeGuess, dirGuess] = raw.split(",").map((s) => s.trim());
      const docType = (DOC_TYPES as readonly string[]).includes(typeGuess ?? "")
        ? (typeGuess as (typeof DOC_TYPES)[number])
        : fallbackType;
      const directionGuess: DirectionGuess =
        dirGuess === "bid" || dirGuess === "offer" ? dirGuess : fallbackDirection;
      return { docType, directionGuess, source: "ai" as const };
    } catch {
      return { docType: fallbackType, directionGuess: fallbackDirection, source: "heuristic" as const };
    }
  });
