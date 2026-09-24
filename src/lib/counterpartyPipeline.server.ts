/** Server-only. Finds the counterparties a bid needs, in the order a careful person would:
 *
 *   bid + documents → understand the transaction → determine the required counterparty →
 *   search the public internet → identify real organisations → test each for relevance →
 *   reason over the evidence → return the counterparties.
 *
 * Every step is its own request, so what was understood, what was found and why each organisation
 * was kept or dropped are separate and checkable. */

import { bidTermTokens, redactBidTerms, stripBidTerms } from "@/lib/bidTerms";

type BriefCore = {
  transactionSummary: string;
  role: string;
  organisationTypes: string[];
  capabilities: string[];
  sectors: string[];
  geographies: string[];
  mustHave: string[];
  exclude: string[];
  searchQueries: string[];
};

/** `personSide` and `requiredSide` come from the transaction's direction, never from the model: a
 * seller's offer needs a BUYER, a buyer's bid needs a SUPPLIER. */
export type Brief = BriefCore & {
  personSide: "seller" | "buyer";
  requiredSide: "buyer" | "supplier";
};

export type PipelineCandidate = {
  name: string;
  jurisdiction?: string | undefined;
  sector?: string | undefined;
  score?: number | undefined;
  rationale?: string | undefined;
  sourceUrl?: string | undefined;
  evidence?: string | undefined;
};

export type PipelineInput = {
  apiKey: string | null;
  kind: "ai" | "ai_plus";
  chatModel: string;
  webModels: string[];
  /** When present, the public internet is searched through Tavily; otherwise OpenAI's own web search. */
  tavilyKey: string | null;
  txKey: string;
  direction: "bid" | "offer";
  commodity: string | null;
  quantity: string;
  price: string;
  incoterms: string | null;
  jurisdiction: string | null;
  region: string | null;
  terms: string | null;
  typedPrompt: string;
  docSummary: string;
  /** Used only if the understanding step cannot run. */
  fallbackSubject: string;
  ownOrgName: string;
  /** Attributes this pipeline run's real AI/search cost to a transaction/org, for the Admin →
   * Integrations Expense report — best-effort, optional. */
  transactionId?: string | null | undefined;
  orgId?: string | null | undefined;
};

export type PipelineResult = {
  brief: Brief;
  candidates: PipelineCandidate[];
  rejected: { name: string; reason: string }[];
  sources: { label: string; url: string }[];
  failures: { label: string; reason: string }[];
  model: string;
  webError: Error | null;
};

const list = (v: unknown, max = 8): string[] =>
  Array.isArray(v)
    ? v
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .slice(0, max)
    : [];

/** One JSON-answering request to the chat model. Throws with a plain reason on failure.
 *
 * Which service answers depends on the search: every search runs on the OpenAI account saved
 * under Admin → Integrations. */
async function chatJson(
  apiKey: string | null,

  model: string,
  effort: "low" | "medium" | "high",
  system: string,
  user: string,
  kind: "ai" | "ai_plus",
  operation: string,
  usage?: { transactionId?: string | null | undefined; orgId?: string | null | undefined },
): Promise<Record<string, unknown>> {
  const { callOpenAiChat, openAiFailureMessage } = await import("@/lib/openaiCall.server");
  const request = {
    model,
    reasoning_effort: kind === "ai_plus" ? "medium" : effort,
    max_completion_tokens: 16000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (!apiKey) {
    throw new Error("AI is not connected: add an OpenAI API key under Admin → Integrations.");
  }
  const res = await callOpenAiChat(apiKey, request, { retries: 2 });

  if (!res.ok) throw new Error(await openAiFailureMessage(res));

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  if (usage) {
    const { logAiUsage } = await import("@/lib/aiUsage.server");
    void logAiUsage({
      provider: "openai",
      operation,
      transactionId: usage.transactionId,
      orgId: usage.orgId,
      model,
      inputTokens: json.usage?.prompt_tokens ?? null,
      outputTokens: json.usage?.completion_tokens ?? null,
      totalTokens: json.usage?.total_tokens ?? null,
    });
  }
  const content = json.choices?.[0]?.message?.content ?? "";
  const body = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error("The analysis came back in a form that could not be read.");
  }
}

// AI and AI+ run side by side for the same bid and would each repeat the understanding step, so the
// first request's answer is shared with the second.
const briefCache = new Map<string, Promise<BriefCore>>();

function cacheKey(input: PipelineInput): string {
  const raw = JSON.stringify([
    input.txKey,
    input.direction,
    input.commodity,
    input.quantity,
    input.price,
    input.incoterms,
    input.jurisdiction,
    input.region,
    input.terms,
    input.typedPrompt,
    input.docSummary,
  ]);
  let h = 5381;
  for (let i = 0; i < raw.length; i += 1) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return `${input.txKey}:${h}`;
}

/** Steps 1–2: what the transaction actually is, and who is needed on the other side. */
async function understand(input: PipelineInput): Promise<BriefCore> {
  const side =
    input.direction === "bid"
      ? "This party is placing a BID — they are the BUYER (they want to buy or procure), so the counterparty must be a SUPPLIER, seller or service provider."
      : "This party is placing an OFFER — they are the SELLER (they want to sell or supply), so the counterparty must be a BUYER, procurer or off-taker — NOT another seller of the same thing.";
  const system =
    "You analyse a trade bid or offer and its supporting documents to work out who the person needs on the other side. " +
    "First understand the transaction itself: what is being bought, sold or procured, how much, on what terms, and where. " +
    "Then determine the required counterparty: their role, the kinds of organisation that would fit, the capabilities they must have, the sectors and places that matter, the hard requirements, and what would rule an organisation out. " +
    "Then write 3 to 5 web search queries that would find real organisations like that. " +
    "If the person's own typed text or documents name a specific organisation (not a product, standard or generic term), " +
    "always include that exact name on its own as one of the queries, so a named target is actually looked up rather than only paraphrased into generic capability terms. " +
    "The counterparty must be on the OPPOSITE side of the trade from this person: if the person is SELLING, the counterparty is a BUYER, importer, off-taker, refiner, processor, manufacturer or trader who takes delivery; if the person is BUYING, the counterparty is a SUPPLIER. " +
    "Organisations on the SAME side as the person (other sellers of the same product when the person sells; other buyers when the person buys) are competitors, not counterparties — list what would identify them in exclude. " +
    "The person's own quantity, price and delivery terms are requirements to match against; they are never facts about any organisation. " +
    "Stay strictly within what the bid and documents say; do not invent requirements. " +
    'Reply with JSON only: {"transactionSummary":string,"role":string,"organisationTypes":string[],"capabilities":string[],"sectors":string[],"geographies":string[],"mustHave":string[],"exclude":string[],"searchQueries":string[]}.';
  const user = [
    side,
    `Commodity / subject: ${input.commodity ?? "n/a"}`,
    `Quantity: ${input.quantity}`,
    `Price: ${input.price}`,
    `Incoterms: ${input.incoterms ?? "n/a"}`,
    `Jurisdiction: ${input.jurisdiction ?? "n/a"}`,
    input.region ? `Preferred counterparty region: ${input.region}` : "",
    input.terms ? `Terms: ${input.terms}` : "",
    input.typedPrompt ? `What the person typed (their own words):\n${input.typedPrompt.slice(0, 2000)}` : "",
    input.docSummary ? `What the supporting documents say:\n${input.docSummary.slice(0, 6000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const r = await chatJson(input.apiKey, input.chatModel, "low", system, user, input.kind, "counterparty_search_understand", input);
    const brief: BriefCore = {
      transactionSummary: String(r["transactionSummary"] ?? "").slice(0, 800),
      role: String(r["role"] ?? "").slice(0, 300),
      organisationTypes: list(r["organisationTypes"]),
      capabilities: list(r["capabilities"]),
      sectors: list(r["sectors"]),
      geographies: list(r["geographies"]),
      mustHave: list(r["mustHave"]),
      exclude: list(r["exclude"]),
      searchQueries: list(r["searchQueries"], 5),
    };
    if (brief.role || brief.capabilities.length > 0) return brief;
  } catch {
    // Fall through to a plain brief from what was typed, so the search still runs.
  }
  const subject = input.fallbackSubject;
  return {
    transactionSummary: subject,
    role: input.direction === "bid" ? "supplier" : "buyer",
    organisationTypes: [],
    capabilities: subject ? [subject] : [],
    sectors: [],
    geographies: [input.region ?? input.jurisdiction ?? ""].filter(Boolean),
    mustHave: [],
    exclude: [],
    searchQueries: subject ? [`${subject} ${input.direction === "bid" ? "suppliers" : "buyers"}`] : [],
  };
}

const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

/** The registrable part of a hostname ("shop.example.co.za" → "example.co.za"), so a sub-page,
 * sub-domain or redirect of a page the search really read still counts as that same page's site.
 * Insisting on a letter-for-letter hostname match threw away legitimate finds. */
const siteOf = (u: string): string => {
  const host = hostOf(u);
  if (!host) return "";
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const twoLevelSuffix = /^(co|com|org|net|gov|edu|ac|co)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
  return parts.slice(twoLevelSuffix ? -3 : -2).join(".");
};

function parseArray(raw: string): Record<string, unknown>[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      : [];
  } catch {
    return [];
  }
}

const SIDE_AND_PROVENANCE_RULES =
  "The brief's requiredSide says which side of the trade the counterparty must be on: 'buyer' means organisations that BUY, import, process, refine, trade in or take delivery of the product; 'supplier' means organisations that SELL or supply it. " +
  "Organisations on the SAME side as the requester (personSide) are competitors and must not be returned. " +
  "Anything shown as [requester's term] is the requester's own quantity, price or delivery term: it is a requirement to match against, never a fact about any organisation — do not attribute it to one, and never quote it as evidence. Evidence must come only from that organisation's own page. ";

const searchInstructions = (maxOrgs: number) =>
  "You find real organisations that could be the counterparty described in the brief, using web search. " +
  "Run several searches, starting from the query ideas given and adding your own. " +
  "Only report organisations you actually found on pages you searched — never from memory, never invented. " +
  "Report operating organisations that act in the required counterparty role in the brief, not directories, news articles, job boards or lists. " +
  SIDE_AND_PROVENANCE_RULES +
  "For each one give: name, jurisdiction, sector, evidence (one or two concrete facts from that organisation's own page showing it acts in the required role) and sourceUrl (the page address). " +
  `Return up to ${maxOrgs} organisations as a JSON array only, or [] if none qualify. ` +
  'Each item: {"name":string,"jurisdiction":string,"sector":string,"evidence":string,"sourceUrl":string}.';

/** Step 3 through OpenAI's own web search, which also names the organisations it found. */
async function searchWithOpenAi(input: PipelineInput, briefText: string, maxOrgs: number) {
  const { webSearch } = await import("@/lib/openaiWebSearch.server");
  if (!input.apiKey) {
    throw new Error("Internet search is unavailable: connect Tavily, or add an OpenAI key in Admin → Integrations.");
  }
  return webSearch({
    apiKey: input.apiKey,

    models: input.webModels,
    effort: input.kind === "ai" ? "low" : "medium",
    instructions:
      "You find real organisations that could be the counterparty described in the brief, using web search. " +
      "Run several searches, starting from the query ideas given and adding your own. " +
      "Only report organisations you actually found on pages you searched — never from memory, never invented. " +
      "Report operating organisations that act in the required counterparty role in the brief, not directories, news articles, job boards or lists. " +
      SIDE_AND_PROVENANCE_RULES +
      "For each one give: name, jurisdiction, sector, evidence (one or two concrete facts from that organisation's own page showing it acts in the required role) and sourceUrl (the page address). " +
      `Return up to ${maxOrgs} organisations as a JSON array only, or [] if none qualify. ` +
      'Each item: {"name":string,"jurisdiction":string,"sector":string,"evidence":string,"sourceUrl":string}.',
    input: `Required counterparty brief:\n${briefText}`,
    usage: { operation: "counterparty_search_web", transactionId: input.transactionId, orgId: input.orgId },
  });
}

/** Step 3 through Tavily: the brief's queries are searched on the public internet, then the chat
 * model names the real organisations those pages are about. */
async function searchWithTavily(input: PipelineInput, brief: Brief, briefText: string, maxOrgs: number) {
  const { tavilySearch } = await import("@/lib/tavily.server");
  const queries = (brief.searchQueries.length > 0
    ? brief.searchQueries
    : [`${brief.capabilities.join(" ")} ${brief.role}`.trim()]
  ).slice(0, input.kind === "ai" ? 5 : 6);

  const settled = await Promise.allSettled(
    queries.map((q) =>
      tavilySearch(input.tavilyKey as string, q, {
        depth: input.kind === "ai" ? "basic" : "advanced",
        max: 8,
        usage: { operation: "counterparty_search_tavily", transactionId: input.transactionId, orgId: input.orgId },
      }),
    ),
  );
  const pages = new Map<string, { title: string; url: string; content: string }>();
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const page of r.value) if (!pages.has(page.url)) pages.set(page.url, page);
  }
  if (pages.size === 0) {
    const failed = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (failed) throw failed.reason instanceof Error ? failed.reason : new Error("The internet search failed.");
    return { text: "[]", sources: [], model: input.chatModel, pageText: {} as Record<string, string> };
  }
  const list = [...pages.values()].slice(0, 30);

  const r = await chatJson(
    input.apiKey,
    input.chatModel,
    input.kind === "ai" ? "low" : "medium",
    "You identify real organisations from public internet search results. Given a brief of the counterparty needed and the pages found, name the operating organisations that offer or need what the brief describes. " +
      "Only name organisations the pages are actually about or clearly mention as offering it — never from memory, never invented. " +
      "Skip directories, news articles, job boards, lists and aggregators themselves. " +
      SIDE_AND_PROVENANCE_RULES +
      "For each: name, jurisdiction, sector, evidence (one or two concrete facts taken from that page showing it acts in the required role) and sourceUrl (the address of the page you took the evidence from — it must be one of the pages given). " +
      `Return up to ${maxOrgs}. ` +
      'Reply with JSON only: {"organisations":[{"name":string,"jurisdiction":string,"sector":string,"evidence":string,"sourceUrl":string}]}, with an empty array if none qualify.',
    `Brief:\n${briefText}\n\nPages:\n${list
      .map((pg, i) => `${i + 1}. ${pg.title} — ${pg.url}\n${pg.content}`)
      .join("\n\n")}`,
      input.kind,
      "counterparty_search_identify",
      input,
    );
  return {
    text: JSON.stringify(Array.isArray(r["organisations"]) ? r["organisations"] : []),
    sources: list.map((pg) => ({ url: pg.url, title: pg.title })),
    model: input.chatModel,
    pageText: Object.fromEntries(list.map((pg) => [pg.url, `${pg.title} ${pg.content}`])) as Record<string, string>,
  };
}

export async function findCounterparties(input: PipelineInput): Promise<PipelineResult> {
  // Steps 1–2 — understand the transaction, determine the required counterparty.
  const key = cacheKey(input);
  let pending = briefCache.get(key);
  if (!pending) {
    pending = understand(input);
    briefCache.set(key, pending);
    setTimeout(() => briefCache.delete(key), 120_000);
  }
  const core = await pending;
  const brief: Brief = {
    ...core,
    personSide: input.direction === "bid" ? "buyer" : "seller",
    requiredSide: input.direction === "bid" ? "supplier" : "buyer",
  };
  // What the requester submitted is matched against, never repeated back as a claim about anyone.
  const bidTokens = bidTermTokens([
    input.quantity,
    input.price,
    input.incoterms,
    input.terms,
    input.typedPrompt,
    input.docSummary,
  ]);

  const empty = (extra: Partial<PipelineResult>): PipelineResult => ({
    brief,
    candidates: [],
    rejected: [],
    sources: [],
    failures: [],
    model: input.chatModel,
    webError: null,
    ...extra,
  });

  // Steps 3–4 — search the public internet and identify real organisations. The first pass ("ai")
  // is Tavily-only now — no falling back to OpenAI's own (slower) web-search tool for it, even
  // without a Tavily key. The deeper "ai_plus" pass still falls back to OpenAI's web search when
  // Tavily isn't configured.
  const briefText = redactBidTerms(JSON.stringify(brief, null, 2), bidTokens);
  const maxOrgs = input.kind === "ai" ? 5 : 8;
  let web: { text: string; sources: { url: string; title: string }[]; model: string; pageText?: Record<string, string> };
  try {
    if (input.tavilyKey) {
      web = await searchWithTavily(input, brief, briefText, maxOrgs);
    } else if (input.kind === "ai") {
      throw new Error("Internet search is unavailable: connect Tavily under Admin → Integrations.");
    } else {
      web = await searchWithOpenAi(input, briefText, maxOrgs);
    }
  } catch (err) {
    return empty({
      failures: [{ label: "Internet search", reason: (err as Error).message }],
      webError: err as Error,
    });
  }

  const citedSites = new Set(web.sources.map((s) => siteOf(s.url)).filter(Boolean));
  const found = parseArray(web.text)
    .map((c) => ({
      name: String(c["name"] ?? "").trim().slice(0, 200),
      jurisdiction: c["jurisdiction"] ? String(c["jurisdiction"]).slice(0, 200) : undefined,
      sector: c["sector"] ? String(c["sector"]).slice(0, 200) : undefined,
      evidence: c["evidence"] ? String(c["evidence"]).slice(0, 600) : undefined,
      sourceUrl:
        typeof c["sourceUrl"] === "string" && /^https?:\/\//.test(c["sourceUrl"]) ? c["sourceUrl"].slice(0, 500) : undefined,
    }))
    .filter((c) => c.name.length > 0);

  const rejected: { name: string; reason: string }[] = [];
  const own = input.ownOrgName.trim().toLowerCase();
  const grounded: PipelineCandidate[] = [];
  const seen = new Set<string>();
  for (const c of found) {
    const dedupeKey = c.name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (own && dedupeKey === own) {
      rejected.push({ name: c.name, reason: "The bidder's own organisation." });
      continue;
    }
    // Real means it was found: a page that the search actually read has to back the claim.
    if (!c.sourceUrl || !c.evidence) {
      rejected.push({ name: c.name, reason: "No page or evidence was given for it." });
      continue;
    }
    if (citedSites.size > 0 && !citedSites.has(siteOf(c.sourceUrl))) {
      rejected.push({ name: c.name, reason: "Its page was not among those the search read." });
      continue;
    }
    grounded.push(c);
  }

  const common = { brief, rejected, sources: web.sources.map((s) => ({ label: s.title || s.url, url: s.url })), model: web.model };
  if (grounded.length === 0) return empty({ ...common });

  // Steps 5–6 — test each organisation against the brief, and reason over its evidence.
  let verdicts: Record<string, unknown>[] = [];
  try {
    const r = await chatJson(
      input.apiKey,
      input.chatModel,
      input.kind === "ai" ? "low" : "medium",
      "You test candidate organisations against a required-counterparty brief, using only the evidence supplied. " +
        'For each candidate decide "relevant": true only if the evidence shows it is a real operating organisation that acts in the required counterparty role (see requiredSide in the brief), meets every hard requirement it can be judged on, and is not something the brief rules out. ' +
        "A candidate on the SAME side as the requester (personSide) is a competitor: mark it not relevant. " +
        "Anything shown as [requester's term] is the requester's own quantity, price or delivery term — never a fact about a candidate; judge and write only from the candidate's own evidence. " +
        'Also give "operatesAs" ("buyer", "seller", "both" or "unclear" — what the evidence shows the organisation does with this product) and "showsRequiredRole" (true only if the evidence itself shows it acting in the required role). ' +
        'Give "score" 0-100 for how well it fits, and "rationale": one or two plain sentences, under 45 words, naming the specific evidence and how it meets the need. ' +
        "Never mention AI, searching, Izenzo, sources or scoring in the rationale. " +
        'If not relevant, give "reason" saying why. ' +
        'Reply with JSON only: {"results":[{"name":string,"relevant":boolean,"operatesAs":string,"showsRequiredRole":boolean,"score":number,"rationale":string,"reason":string}]} with one entry per candidate.',
      `Brief:\n${briefText}\n\nCandidates:\n${grounded
        .map((c, i) => `${i + 1}. ${c.name} (${c.jurisdiction ?? "place unknown"}, ${c.sector ?? "sector unknown"})\n   Evidence: ${c.evidence}\n   Page: ${c.sourceUrl}`)
        .join("\n")}`,
      input.kind,
      "counterparty_search_reason",
      input,
    );
    verdicts = Array.isArray(r["results"]) ? (r["results"] as Record<string, unknown>[]) : [];
  } catch {
    verdicts = [];
  }

  const verdictByName = new Map(verdicts.map((v) => [String(v["name"] ?? "").trim().toLowerCase(), v]));
  const kept: PipelineCandidate[] = [];
  for (const c of grounded) {
    const v = verdictByName.get(c.name.toLowerCase());
    if (!v) {
      // The test could not run for this one: it stays only if it was grounded above, unscored.
      const evidence = stripBidTerms(c.evidence, bidTokens, web.pageText?.[c.sourceUrl ?? ""]);
      if (!evidence) {
        rejected.push({ name: c.name, reason: "Its evidence only repeated the requester's own terms." });
        continue;
      }
      kept.push({ ...c, evidence, rationale: evidence });
      continue;
    }
    if (v["relevant"] !== true) {
      rejected.push({ name: c.name, reason: String(v["reason"] ?? "Not relevant to what is needed.").slice(0, 300) });
      continue;
    }
    // The counterparty has to be on the opposite side of the trade — never a competitor. Only a
    // clear reading of the wrong side disqualifies: "unclear" or "both" is not evidence of being a
    // competitor, and for general goods most supplier pages read that way.
    const operatesAs = String(v["operatesAs"] ?? "").toLowerCase();
    const wrongSide =
      (brief.requiredSide === "buyer" && operatesAs === "seller") ||
      (brief.requiredSide === "supplier" && operatesAs === "buyer");
    if (wrongSide || (v["showsRequiredRole"] === false && operatesAs !== "both" && operatesAs !== "unclear")) {
      rejected.push({
        name: c.name,
        reason: `Not shown acting as a ${brief.requiredSide} — it is on the same side as the requester.`,
      });
      continue;
    }
    const score = typeof v["score"] === "number" ? Math.max(0, Math.min(100, v["score"])) : undefined;
    // The requester's own terms are stripped from anything said about this organisation unless its
    // own page carries them.
    const source = web.pageText?.[c.sourceUrl ?? ""];
    const evidence = stripBidTerms(c.evidence, bidTokens, source);
    if (!evidence) {
      rejected.push({ name: c.name, reason: "Its evidence only repeated the requester's own terms." });
      continue;
    }
    kept.push({
      ...c,
      score,
      evidence,
      rationale: stripBidTerms(String(v["rationale"] ?? "").trim().slice(0, 500), bidTokens, source) ?? evidence,
    });
  }

  return { ...empty({ ...common }), candidates: kept };
}
