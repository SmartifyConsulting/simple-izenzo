import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { POI_COST, WAD_COST } from "@/lib/spine";

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const txInput = (data: unknown) => z.object({ transactionId: z.string().uuid() }).parse(data);

/** All AI searching runs on GPT-6 Astra. The two tiers differ by how hard it thinks and how many
 * scraped sources it reads — never by model quality. */
const AI_MODEL = "openai/gpt-6-astra";
const AI_PLUS_MODEL = "openai/gpt-6-astra";

/** Astra requires an explicit reasoning effort and rejects temperature/top_p. */
function aiPlusOptions(model: string, kind: "ai" | "ai_plus" = "ai_plus") {
  if (model !== "openai/gpt-6-astra") return {};
  return {
    reasoning_effort: (kind === "ai" ? "low" : "high") as "low" | "high",
    max_completion_tokens: kind === "ai" ? 2000 : 4000,
  };
}

/** How many open-web surfaces each tier reads through Bright Data. */
const SOURCE_LIMIT = { ai: 3, ai_plus: 6 } as const;

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

    const { data: screened } = await supabase
      .from("transaction_events")
      .select("id")
      .eq("transaction_id", tx.id)
      .eq("action", "media_scanned")
      .limit(1)
      .maybeSingle();
    if (!screened) throw new Error("Run the background screening (Social & News Media scan) before sealing the Proof of Intent");

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
        step: cleared ? "entry" : "wad",
      })
      .eq("id", tx.id);

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
};

/** Real listings already published in the Izenzo directory, used as grounding when the live web
 * cannot be read. Still real, named organisations — never invented. */
async function listingSources() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("responder_listings")
      .select("name, sector, jurisdiction, summary, source_url")
      .eq("published", true)
      .order("verified_at", { ascending: false, nullsFirst: false })
      .limit(40);
    return (data ?? []).map((r) => ({
      label: `Izenzo directory — ${r.name}`,
      url: r.source_url ?? "",
      text: [r.name, r.sector, r.jurisdiction, r.summary].filter(Boolean).join(" — "),
    }));
  } catch {
    return [];
  }
}

/** Published directory listings turned straight into candidates. Used when the model returns
 * nothing from the fallback sources, so a search still yields real named organisations. */
async function listingCandidates(limit = 6): Promise<CandidateResult[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("responder_listings")
      .select("name, sector, jurisdiction, summary, source_url")
      .eq("published", true)
      .order("verified_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    return (data ?? []).map((r) => ({
      name: r.name,
      jurisdiction: r.jurisdiction ?? undefined,
      sector: r.sector ?? undefined,
      rationale: r.summary
        ? `From the Izenzo directory: ${String(r.summary).slice(0, 160)}`
        : "From the Izenzo directory — the live web could not be read for this search.",
      sourceUrl: r.source_url ?? undefined,
    }));
  } catch {
    return [];
  }
}

/** Scrapes the open web for one query and turns the pages into grounding context for the model.
 * When the live web cannot be read, it falls back to the published Izenzo directory rather than
 * failing the whole search — but it never lets the model answer without real sources. */
async function groundOnWeb(query: string, kind: "ai" | "ai_plus") {
  const { brightDataConfigured, fetchSearchResults } = await import("@/lib/brightdata.server");
  let sources: { label: string; url: string; text: string }[] = [];
  let failures: { label: string; reason: string }[] = [];
  let webError: string | null = null;

  if (!(await brightDataConfigured())) {
    webError = "Live web search is not connected (add it in Admin → Integrations).";
  } else {
    try {
      const read = await fetchSearchResults(query, SOURCE_LIMIT[kind]);
      sources = read.sources;
      failures = read.failures;
      if (sources.length === 0) {
        const reason = failures[0]?.reason ? ` (${failures[0].reason})` : "";
        webError = `The live web could not be read for this search${reason}.`;
      }
    } catch (err) {
      webError = `The live web could not be read (${(err as Error).message}).`;
    }
  }

  if (sources.length === 0) {
    sources = await listingSources();
    if (sources.length === 0) {
      throw new Error(
        `${webError ?? "No sources could be read for this search."} There are no published directory listings to match against either.`,
      );
    }
    failures = [...failures, { label: "Live web search", reason: webError ?? "unavailable" }];
  }

  const context = sources
    .map((s, i) => `SOURCE ${i + 1} — ${s.label} — ${s.url}\n${s.text}`)
    .join("\n\n");

  return { sources, failures, context };
}


const GROUNDING_RULES =
  "You are given the visible text of real web and marketplace search pages. Only return organisations that actually appear in that text. Never invent a company. For each one, set sourceUrl to the URL of the SOURCE block it came from.";

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
        sector: c["sector"] ? String(c["sector"]).slice(0, 200) : undefined,
        score: typeof c["score"] === "number" ? c["score"] : undefined,
        rationale: c["rationale"] ? String(c["rationale"]).slice(0, 500) : undefined,
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
    { label: "Izenzo AI read", points: read, max: 15, note: c.rationale ?? "No note" },
  ];

  return { total: components.reduce((sum, k) => sum + k.points, 0), components };
}

/** Pulls the searchable subject out of a document summary when nobody typed a commodity — the
 * first substantial line of the bullet summary, stripped of bullet marks and filler, capped so the
 * web query stays a query rather than a paragraph. */
function keywordsFromSummary(summary: string): string {
  const line = summary
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .find((l) => l.length > 8 && !/^not stated/i.test(l));
  if (!line) return "";
  return line
    .replace(/[.,;:]/g, " ")
    .split(/\s+/)
    .slice(0, 12)
    .join(" ")
    .slice(0, 160)
    .trim();
}

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
    const { supabase } = context;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

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
    // What is actually being traded: the typed commodity when there is one, otherwise whatever the
    // uploaded documents said. The bid's own title ("New Bid") is never a search term — searching on
    // it is what used to return nothing.
    const docSummary = (tx.document_summary as string | null) ?? "";
    const typedPrompt = ((tx as { search_prompt?: string | null }).search_prompt ?? "").trim();
    const subject =
      tx.commodity?.trim() || typedPrompt.slice(0, 160) || keywordsFromSummary(docSummary);
    if (!subject) {
      throw new Error(
        "There is nothing to search on yet — add the commodity, or attach a document that says what is being traded.",
      );
    }
    const searchQuery = [subject, wantedSide, data.region ?? tx.jurisdiction ?? ""]
      .filter(Boolean)
      .join(" ");
    const { sources, failures, context: grounding } = await groundOnWeb(searchQuery, data.kind);

    const system =
      data.kind === "ai"
        ? `You are the Izenzo counterparty search assistant. ${GROUNDING_RULES} Given a bid or offer, pick the organisations in the sources that could transact on these terms. You never decide and never contact anyone — you only propose candidates for a person to review. Respond with ONLY a JSON array, each item: {"name":string,"jurisdiction":string,"sector":string,"score":number 0-100,"rationale":string under 40 words,"sourceUrl":string}. No prose outside the array.`
        : `You are Izenzo AI+, a deeper counterparty search. ${GROUNDING_RULES} Pick the best-matched organisations in the sources, weighing jurisdiction fit, sector fit and deal size. You never decide and never contact anyone. Respond with ONLY a JSON array, each item: {"name":string,"jurisdiction":string,"sector":string,"score":number 0-100,"rationale":string under 40 words covering fit and any risk notes,"sourceUrl":string}. No prose outside the array.`;

    const prompt = [
      `Commodity: ${tx.commodity ?? "n/a"}`,
      `Quantity: ${tx.quantity ?? "n/a"} ${tx.unit ?? ""}`,
      `Price: ${tx.price ?? "n/a"} ${tx.currency}`,
      `Incoterms: ${tx.incoterms ?? "n/a"}`,
      `Jurisdiction: ${tx.jurisdiction ?? "n/a"}`,
      data.region ? `Preferred counterparty region: ${data.region}` : "",
      typedPrompt ? `What the submitter is looking for (their own words):\n${typedPrompt.slice(0, 2000)}` : "",
      docSummary ? `What the attached documents say:\n${docSummary.slice(0, 4000)}` : "",
      latestBid
        ? `Latest ${latestBid.direction}: ${latestBid.price ?? "n/a"} ${latestBid.currency} for ${latestBid.quantity ?? "n/a"} ${latestBid.unit ?? ""}. Terms: ${latestBid.terms ?? "n/a"}`
        : "",
      "Propose 4-6 candidates, all from the sources below.",
      "",
      grounding,
    ]
      .filter(Boolean)
      .join("\n");

    const model = data.kind === "ai" ? AI_MODEL : AI_PLUS_MODEL;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        ...aiPlusOptions(model, data.kind),
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI is busy right now. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    if (!res.ok) throw new Error("AI request failed");
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const output = json.choices?.[0]?.message?.content ?? "";
    let candidates = parseCandidates(output);
    if (candidates.length === 0) candidates = await listingCandidates(6);
    if (candidates.length === 0)
      throw new Error(
        "No matching organisations were found in the sources that were read, and the directory has no published listings to fall back on.",
      );

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
      const scored = scoreCandidate(c, {
        subject,
        region: scoreRegion,
        verified: verifiedNames.has(c.name.toLowerCase()),
      });
      return {
        transaction_id: tx.id,
        name: c.name,
        jurisdiction: c.jurisdiction ?? null,
        sector: c.sector ?? null,
        score: scored.total,
        source,
        rationale: c.rationale ?? null,
        status: "surfaced",
        // Evidence lives in media_flags so the source page can be opened next to the name, along
        // with the breakdown behind the percentage.
        media_flags: {
          ...(c.sourceUrl ? { evidence: [{ url: c.sourceUrl, source: "web_search" }] } : {}),
          scoring: { total: scored.total, components: scored.components },
        },
      };
    });
    const { data: inserted, error } = await supabase.from("counterparties").insert(rows).select();
    if (error) throw error;

    // Publish each web-found name to the public Responder directory as an unclaimed listing,
    // keeping the page it was found on as evidence. Private per-bid rows above stay untouched.
    // Names already listed are skipped, so an existing (or claimed) listing is never overwritten.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: already } = await supabaseAdmin
        .from("responder_listings")
        .select("name")
        .in("name", candidates.map((c) => c.name));
      const taken = new Set((already ?? []).map((r) => r.name.toLowerCase()));
      const fresh = candidates.filter((c) => !taken.has(c.name.toLowerCase()));
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



    return {
      candidates: inserted ?? [],
      model,
      sourcesRead: sources.map((s) => ({ label: s.label, url: s.url })),
      sourcesSkipped: failures.map((f) => ({ label: f.label, reason: f.reason })),
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
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const counterpart = data.role === "buyer" ? "suppliers/sellers" : "buyers";
    const { sources, failures, context: grounding } = await groundOnWeb(
      `${data.query} ${counterpart}`,
      data.kind,
    );

    const system =
      data.kind === "ai"
        ? `You are the Izenzo counterparty search assistant. ${GROUNDING_RULES} The user is a ${data.role} searching for ${counterpart}. Pick the organisations in the sources that match their search. You never decide and never contact anyone — you only propose candidates for a person to review. Respond with ONLY a JSON array, each item: {"name":string,"jurisdiction":string,"sector":string,"score":number 0-100,"rationale":string under 40 words,"sourceUrl":string}. No prose outside the array.`
        : `You are Izenzo AI+, a deeper counterparty search. ${GROUNDING_RULES} The user is a ${data.role} searching for ${counterpart}. Pick the best-matched organisations in the sources, weighing jurisdiction fit, sector fit and plausibility. You never decide and never contact anyone. Respond with ONLY a JSON array, each item: {"name":string,"jurisdiction":string,"sector":string,"score":number 0-100,"rationale":string under 40 words covering fit and any risk notes,"sourceUrl":string}. No prose outside the array.`;

    const prompt = `Search: "${data.query}"\nRole: ${data.role}\nPropose 4-6 candidates, all from the sources below.\n\n${grounding}`;

    const model = data.kind === "ai" ? AI_MODEL : AI_PLUS_MODEL;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        ...aiPlusOptions(model, data.kind),
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI is busy right now. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    if (!res.ok) throw new Error("AI request failed");
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const output = json.choices?.[0]?.message?.content ?? "";
    let candidates = parseCandidates(output);
    if (candidates.length === 0) candidates = await listingCandidates(6);

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

    // Preferred path: Bright Data's remote browser, which renders JavaScript-only sites.
    const { brightDataConfigured, fetchPageText } = await import("@/lib/brightdata.server");
    if (await brightDataConfigured()) {
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
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

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

    const model = data.kind === "ai" ? AI_MODEL : AI_PLUS_MODEL;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        ...aiPlusOptions(model, data.kind),
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI is busy right now. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    if (!res.ok) throw new Error("AI request failed");
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
    const apiKey = process.env["LOVABLE_API_KEY"];
    const fallbackType = classifyByFilename(data.filename);
    const fallbackDirection = directionByFilename(data.filename);
    if (!apiKey) return { docType: fallbackType, directionGuess: fallbackDirection, source: "heuristic" as const };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.7-flash",
          messages: [
            {
              role: "system",
              content: `Classify a trade-deal document by its filename alone. Respond with ONLY two lowercase words separated by a comma, nothing else: first, exactly one of ${DOC_TYPES.join(
                ", ",
              )} ("identity" means a personal or entity ID/KYC document); second, exactly one of bid, offer, unknown — "bid" if the filename reads like an opening proposal/tender/RFQ, "offer" if it reads like a response/quotation/reply to one, "unknown" if it's not clear.`,
            },
            { role: "user", content: data.filename },
          ],
        }),
      });
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
