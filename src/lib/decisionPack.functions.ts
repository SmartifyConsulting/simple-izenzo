import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evidenceCompleteness, parseEvidenceRefs, type EvidenceRef } from "@/lib/confidence";

/**
 * AI+ is advisory, never the decision-maker.
 *
 * A DecisionPack is the only way AI+ output enters the record: a validated set of proposals,
 * each with a numeric probability between 0 and 1 (never Low/Medium/High), written to
 * `ai_proposals` and nowhere else. AI+ never touches the transaction spine
 * (Choice → Intent → POI → WaD → Execution → Finality); a person adopts or rejects each
 * proposal, and that adoption is its own attributed, timestamped, append-only event.
 */

const AI_PLUS_MODEL = "gpt-6-astra";

export const PROPOSAL_TYPES = [
  "counterparty",
  "pricing",
  "risk",
  "structure",
  "timing",
  "substitution",
  "bundle",
] as const;

export type ProposalType = (typeof PROPOSAL_TYPES)[number];

/** The stage of the spine that asked for advice. AI+ only ever reads these. */
export const STAGE_CONTEXTS = [
  "choice_made",
  "intent_confirmed",
  "poi_sealed",
  "wad_updated",
  "finality_recorded",
] as const;

export type StageContext = (typeof STAGE_CONTEXTS)[number];

const STAGE_LABEL: Record<StageContext, string> = {
  choice_made: "Choice",
  intent_confirmed: "Before Sealing Intent",
  poi_sealed: "After Sealing Proof of Intent",
  wad_updated: "Compliance Case",
  finality_recorded: "Finality",
};

const STAGE_BRIEF: Record<StageContext, string> = {
  choice_made:
    "A counterparty has just been chosen by a person. Advise on that choice: is the counterparty sound, is the pricing sane, what risks and structuring points matter, is the timing right, is a substitution or a bundle worth considering.",
  intent_confirmed:
    "Intent has been confirmed and the Proof of Intent is about to be sealed and become immutable. This is the last advisory word before that seal: name anything that should be settled first.",
  poi_sealed:
    "The Proof of Intent has been sealed and is now immutable. This advice is informational only: it cannot change, reopen or unwind the sealed record. Note what the sealed position means for the compliance and execution work still ahead.",
  wad_updated:
    "The Without a Doubt compliance case has changed. Give advisory input only — you cannot approve, reject, alter or bypass the WaD gate; a compliance officer decides.",
  finality_recorded:
    "Finality has been recorded and the transaction is complete. Close the loop with observations for the record only — nothing here can change the transaction.",
};

/** Which spine stage each advisory moment belongs to, in the client's DecisionPack vocabulary. */
const STAGE_FOR_CONTEXT: Record<StageContext, string> = {
  choice_made: "trading",
  intent_confirmed: "trading",
  poi_sealed: "trading",
  wad_updated: "compliance",
  finality_recorded: "finality",
};


const packInput = (data: unknown) =>
  z
    .object({
      transactionId: z.string().uuid(),
      stageContext: z.enum(STAGE_CONTEXTS),
    })
    .parse(data);

type RawProposal = {
  proposal_type?: string;
  probability?: unknown;
  summary?: string;
  rationale?: string;
  source_references?: unknown;
  /** What the advice rests on — each item says whether it is a document, a fact taken from one, the
   * bid record, a cited web page or general knowledge, and whether it is confirmed. */
  evidence?: unknown;
  addressed_to?: string;
  counterparty?: string | null;
};

type CleanProposal = {
  proposal_type: ProposalType;
  probability: number;
  output: string;
  rationale: string;
  source_references: unknown[];
  related_counterparty: string | null;
};

/** Nothing unvalidated is ever written: a bad type or an out-of-range probability is dropped. */
function validate(raw: RawProposal[], citedUrls: Set<string> = new Set()) {
  const clean: CleanProposal[] = [];

  const rejected: string[] = [];

  for (const r of raw) {
    const type = String(r.proposal_type ?? "").toLowerCase() as ProposalType;
    if (!PROPOSAL_TYPES.includes(type)) {
      rejected.push(`unknown proposal type "${r.proposal_type}"`);
      continue;
    }
    // Advice is for the user. Anything addressed to the counterparty — how a buyer should protect
    // itself when the user is the seller, say — is not what was asked for.
    if (String(r.addressed_to ?? "user").toLowerCase() === "counterparty") {
      rejected.push(`${type} advice was written for the counterparty, not the user`);
      continue;
    }
    // With structured evidence the score is worked out from it — how much of what the advice rests
    // on is confirmed — rather than trusting a number the model made up. Advice that arrives with a
    // plain number and plain-text references (the protected AI+ service) keeps that number.
    let evidenceRefs: EvidenceRef[] = [];
    let p: number;
    if (Array.isArray(r.evidence)) {
      evidenceRefs = parseEvidenceRefs(r.evidence).map((e) =>
        // A cited web page has to be one the market-data lookup actually returned.
        e.kind === "public_web" && (!e.url || !citedUrls.has(e.url)) ? { ...e, kind: "general_knowledge" as const, verified: false } : e,
      );
      p = Math.round(evidenceCompleteness(evidenceRefs) * 100) / 100;
    } else {
      p = typeof r.probability === "number" ? r.probability : Number(r.probability);
      if (!Number.isFinite(p) || p < 0 || p > 1) {
        rejected.push(`probability out of range for ${type}`);
        continue;
      }
    }
    const summary = String(r.summary ?? "").trim();
    if (!summary) {
      rejected.push(`empty proposal for ${type}`);
      continue;
    }
    // A recommendation without a stated reason is not usable advice: the person deciding has to
    // be able to see why it is being put to them, so an unexplained proposal is dropped.
    const rationale = String(r.rationale ?? "").trim();
    if (!rationale) {
      rejected.push(`no explanation given for ${type}`);
      continue;
    }
    const refs: unknown[] =
      evidenceRefs.length > 0
        ? evidenceRefs
        : Array.isArray(r.source_references)
          ? r.source_references.map((s) => String(s)).filter(Boolean).slice(0, 8)
          : [];
    const counterparty = String(r.counterparty ?? "").trim();
    clean.push({
      proposal_type: type,
      probability: p,
      output: summary,
      rationale,
      source_references: refs,
      related_counterparty: counterparty || null,
    });
  }
  return { clean, rejected };
}

type AiPlusTransaction = {
  id: string;
  org_id: string;
  counterparty_org_id: string | null;
  stage: string;
  step: string;
  title: string | null;
  commodity: string | null;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  currency: string | null;
  incoterms: string | null;
  jurisdiction: string | null;
};

/**
 * Asks the client's protected AI+ service for a DecisionPack over their own contract
 * (Appendix A out, Appendix B back), signed with the shared secret.
 *
 * Returns `null` whenever the integration is switched off or the call could not produce a valid
 * pack — the caller then uses the hosted model instead. This function never throws: an AI+ failure
 * is an advisory failure only, and must never interrupt a transaction or unwind a sealed record.
 *
 * Every attempt is recorded in `ai_plus_invocations` with its invocation, correlation and
 * idempotency identifiers, so a repeated call is recognisable as a repeat on both sides.
 */
async function tryProtectedAiPlus(args: {
  transaction: AiPlusTransaction;
  stageContext: StageContext;
  actorId: string;
}): Promise<{ clean: CleanProposal[]; rejected: string[]; model: string } | null> {
  const tx = args.transaction;
  const {
    loadAiPlusConfig,
    buildDecisionRequest,
    callAiPlus,
    canonicalBody,
    sha256Hex,
    mapCandidateType,
  } = await import("@/lib/aiPlus.server");

  const config = await loadAiPlusConfig();
  if (!config.enabled) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const invocationId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const eventAt = new Date().toISOString();
  // The same spine moment on the same transaction is always the same unit of work, so a retry
  // carries the same idempotency key and their side can recognise it rather than treat it as new.
  const idempotencyKey = `${tx.id}:${args.stageContext}`;

  const request = buildDecisionRequest({
    environment: config.environment,
    invocationId,
    transactionId: tx.id,
    orgId: tx.org_id,
    counterpartyOrgId: tx.counterparty_org_id ?? null,
    stage: STAGE_FOR_CONTEXT[args.stageContext],
    step: tx.step,
    eventType: args.stageContext,
    eventAt,
    attributes: {
      title: tx.title,
      commodity: tx.commodity,
      quantity: tx.quantity,
      unit: tx.unit,
      price: tx.price,
      currency: tx.currency,
      incoterms: tx.incoterms,
      jurisdiction: tx.jurisdiction,
    },
  });

  const requestHash = await sha256Hex(canonicalBody(request));

  // The retry key stands for one unit of work. If the same key has already been used for
  // materially different contents, the two disagree and the call is refused rather than sent —
  // their side would otherwise be asked to reconcile two different requests under one key.
  const { data: priorUse } = await supabaseAdmin
    .from("ai_plus_invocations")
    .select("id, request_hash")
    .eq("idempotency_key", idempotencyKey)
    .order("created_at", { ascending: false })
    .limit(1);
  const conflicting = (priorUse ?? [])[0];
  if (conflicting && conflicting.request_hash && conflicting.request_hash !== requestHash) {
    await supabaseAdmin.from("ai_plus_invocations").insert({
      transaction_id: tx.id,
      org_id: tx.org_id,
      invocation_id: invocationId,
      correlation_id: correlationId,
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      stage: STAGE_FOR_CONTEXT[args.stageContext] as never,
      step: tx.step,
      event_type: args.stageContext,
      status: "rejected",
    });
    console.error("AI+ idempotency key reused with different contents", correlationId);
    return null;
  }

  const { data: logRow } = await supabaseAdmin
    .from("ai_plus_invocations")
    .insert({
      transaction_id: tx.id,
      org_id: tx.org_id,
      invocation_id: invocationId,
      correlation_id: correlationId,
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      stage: STAGE_FOR_CONTEXT[args.stageContext] as never,
      step: tx.step,
      event_type: args.stageContext,
      status: "invoked",
    })
    .select("id")
    .maybeSingle();

  await supabaseAdmin.from("transaction_events").insert({
    transaction_id: tx.id,
    actor_id: args.actorId,
    stage: tx.stage as never,
    step: tx.step,
    action: "ai_plus_invoked",
    summary: "AI+ service invoked for advisory input",

    payload: {
      invocationId,
      correlationId,
      idempotencyKey,
      stageContext: args.stageContext,
      advisoryOnly: true,
    },
  });

  const started = Date.now();
  const result = await callAiPlus(config, request, idempotencyKey, correlationId);

  const finish = async (status: string, responseStatus: number | null) => {
    if (logRow?.id) {
      await supabaseAdmin
        .from("ai_plus_invocations")
        .update({
          status,
          response_status: responseStatus,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logRow.id);
    }
  };

  if (!result.ok) {
    await finish("failed", result.status);
    await supabaseAdmin.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: args.actorId,
      stage: tx.stage as never,
      step: tx.step,
      action: "ai_plus_failed",
      summary: "AI+ service did not return usable advice",
      payload: {
        invocationId,
        correlationId,
        idempotencyKey,
        stageContext: args.stageContext,
        responseStatus: result.status,
        error: result.error,
        latencyMs: Date.now() - started,
        advisoryOnly: true,
        transactionUnaffected: true,
      },
    });
    console.error("AI+ service call failed", correlationId, result.error);
    return null;
  }

  // A validated pack still goes through the same proposal validation as any other advice, so a
  // probability stays a number and an unexplained candidate is dropped rather than shown.
  const { clean, rejected } = validate(
    result.pack.candidates.map((c) => ({
      proposal_type: mapCandidateType(c.type),
      probability: c.probability,
      summary: c.label,
      rationale: c.rationale,
      source_references: c.source_refs,
      counterparty: c.type === "counterparty" ? c.label : null,
    })),
  );

  if (clean.length === 0) {
    await finish("rejected", result.status);
    console.error("AI+ pack held no usable candidates", correlationId, rejected.join("; "));
    return null;
  }

  await finish("completed", result.status);
  return { clean, rejected, model: result.pack.model };
}



/**
 * Runs AI+ for one spine event and records the DecisionPack. Writes only to `ai_proposals`
 * and a `transaction_events` note — never to the transaction, execution or finality records.
 */
export const runDecisionPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(packInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (!apiKey) throw new Error("AI is not configured for this workspace.");

    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("Transaction not found");

    const { data: docs } = await supabase
      .from("documents")
      .select("name, doc_type, notes, created_at")
      .eq("transaction_id", tx.id)
      .order("created_at", { ascending: true });
    const newestDocAt = (docs ?? []).reduce<string | null>(
      (latest, d) => (d.created_at && (!latest || d.created_at > latest) ? d.created_at : latest),
      null,
    );

    // An already-answered pack for this event is returned rather than re-run, so a person is
    // never asked to decide the same advice twice.
    const { data: existing } = await supabase
      .from("ai_proposals")
      .select("*")
      .eq("transaction_id", tx.id)
      .eq("stage_context", data.stageContext)
      .is("superseded_by", null)
      .order("created_at", { ascending: true });
    if (existing && existing.length > 0) {
      const anyDecided = existing.some((p) => p.decided_at);
      // AI+ memory: documents uploaded after this advice was produced mean the advice was formed
      // on an out-of-date picture. If nobody has answered it yet, it is superseded and re-run
      // against everything now on file. A pack a person has already decided is never re-asked.
      const stale =
        !anyDecided &&
        Boolean(newestDocAt) &&
        existing.some((p) => p.created_at && newestDocAt! > p.created_at);
      if (!stale) {
        return { packId: existing[0]!.decision_pack_id, proposals: existing, reused: true };
      }
    }

    const { data: parties } = await supabase
      .from("counterparties")
      .select("name, jurisdiction, status, score, rating_band, notes")
      .eq("transaction_id", tx.id);
    const { data: bids } = await supabase
      .from("bid_offers")
      .select("direction, price, quantity, unit, currency, terms, status")
      .eq("transaction_id", tx.id);

    // AI+ memory of this bid: what the documents say, and what the person has already accepted
    // or rejected here, so later advice builds on the record instead of ignoring it.
    const { data: priorDecisions } = await supabase
      .from("ai_proposals")
      .select("proposal_type, output, decision, related_counterparty, stage_context")
      .eq("transaction_id", tx.id)
      .not("decided_at", "is", null)
      .order("decided_at", { ascending: true });


    // Whose side the advice is on: the person using the app. Their own offer to SELL needs advice
    // that makes it more executable and attractive to a buyer; their bid to BUY needs advice that
    // secures a supplier on good terms. The counterparty is never the one being advised.
    const reference = String((tx as { reference?: string | null }).reference ?? "").toUpperCase();
    const isSeller = reference.startsWith("OFF")
      ? true
      : reference.startsWith("BID")
        ? false
        : (bids ?? []).some((b) => b.direction === "offer");
    const userSide = isSeller ? "SELLER" : "BUYER";

    const { loadMarketContext } = await import("@/lib/marketData.server");
    const market = await loadMarketContext({ apiKey, commodity: tx.commodity ?? null, jurisdiction: tx.jurisdiction ?? null });
    const citedUrls = new Set((market?.sources ?? []).map((x) => x.url));

    const system = [
      "You are Izenzo AI+. You are advisory only: you never decide, never select, never adopt, and never change the transaction.",
      `YOUR USER IS THE ${userSide}${isSeller ? " — this is their OFFER TO SELL" : " — this is their BID TO BUY"}. Every recommendation is advice to the user, from the user's position: ${
        isSeller
          ? "how to make their offer more executable and more attractive to a buyer and to raise the chance it reaches Execution — for example obtaining independent verification of quality, securing any missing quantity, correcting delivery dates, clarifying Incoterms, and structuring payment security a buyer will accept. Do NOT write advice that protects a hypothetical buyer (what a buyer should insist on, avoid paying, or appoint); use a buyer's likely concerns only to tell the seller what to fix or offer."
          : "how to secure a reliable supplier on sound terms and protect the user as buyer — for example verifying quality and quantity, price against a benchmark, delivery and payment protections. Do NOT write advice to the supplier."
      }`,
      "Return STRICT JSON: {\"proposals\":[{\"proposal_type\":\"counterparty|pricing|risk|structure|timing|substitution|bundle\",\"addressed_to\":\"user\",\"summary\":\"one sentence: what the user should do\",\"rationale\":\"why\",\"evidence\":[{\"kind\":\"document|extracted_fact|bid_record|public_web|general_knowledge\",\"chain\":\"source → detail → fact\",\"verified\":true,\"url\":\"only for public_web\"}],\"counterparty\":\"the exact counterparty name this proposal is about, from the Counterparties list below, or null if it isn't about a specific one\"}]}",
      "\"rationale\" is mandatory and is the explanation the person reads before accepting or rejecting. Write two to four sentences in plain professional language that (1) state the specific evidence you are relying on, (2) explain the reasoning that leads from that evidence to the recommendation, and (3) say what it would improve or what risk it would avoid. Never write a bare restatement of the summary or an explanation that cites nothing on file.",
      "\"evidence\" lists every fact the advice rests on and says exactly where each comes from. kind: \"document\" = a named document on file; \"extracted_fact\" = a specific fact read out of a document; \"bid_record\" = a field of the bid/offer record; \"public_web\" = a page in the PUBLIC MARKET DATA section (give its url); \"general_knowledge\" = anything from your own knowledge. \"chain\" traces it from source to fact, for example \"Assay Certificate → sample ID CCA-260918-73 → Cu 99.94%\". \"verified\" is true only if that exact fact appears in the information below; anything from general knowledge is verified:false. Never invent a source, a sample ID or a figure.",
      "Do not give any probability or percentage of your own — confidence is worked out from how much of the evidence is verified.",
      "The user's own submitted terms (price, quantity, delivery terms) are the user's claims, not independently verified facts about the counterparty or the market. Use market prices only from the PUBLIC MARKET DATA section; if it is empty or holds no usable benchmark, say a contemporaneous benchmark could not be obtained instead of supplying a figure.",
      "A price or quantity shown as \"not recorded\" is a gap in the record, not a value of zero.",
      "Always set \"counterparty\" to the specific party's name whenever a proposal concerns one — never leave it null just because the type isn't \"counterparty\".",
      "Return between 2 and 6 proposals. No prose outside the JSON.",
    ].join("\n");

    const prompt = [
      STAGE_BRIEF[data.stageContext],
      "",
      `Transaction: ${tx.title}`,
      `Commodity: ${tx.commodity ?? "n/a"}`,
      `Quantity: ${tx.quantity ?? "n/a"} ${tx.unit ?? ""}`,
      `Price: ${tx.price ?? "n/a"} ${tx.currency}`,
      `Incoterms: ${tx.incoterms ?? "n/a"}`,
      `Jurisdiction: ${tx.jurisdiction ?? "n/a"}`,
      `Counterparties: ${JSON.stringify(parties ?? [])}`,
      `Bids/offers: ${JSON.stringify(
        (bids ?? []).map((b) => ({
          ...b,
          price: Number(b.price) > 0 ? b.price : "not recorded",
          quantity: Number(b.quantity) > 0 ? b.quantity : "not recorded",
        })),
      )}`,
      `Documents on file: ${JSON.stringify(docs ?? [])}`,
      `What the documents say (read by Izenzo): ${tx.document_summary ?? "not read yet"}`,
      market
        ? `PUBLIC MARKET DATA (retrieved ${market.retrievedAt} from the public internet — the only source for market prices):\n${market.text}`
        : `PUBLIC MARKET DATA: none could be retrieved just now.`,
      `Decisions this person has already made on earlier AI+ advice for this bid: ${JSON.stringify(priorDecisions ?? [])}`,
      "Take the document contents and those earlier decisions as settled context: do not repeat advice that was already rejected, and build on what was accepted.",
    ].join("\n");

    // The client's own protected AI+ service is tried first, but only when an administrator has
    // switched it on and saved its address and signing details. If it is off, unreachable, slow,
    // or replies with anything that does not satisfy the DecisionPack contract, the failure is
    // recorded and advice falls back to the hosted model. Either way the transaction is never
    // blocked and nothing already sealed is touched.
    const external = await tryProtectedAiPlus({
      transaction: tx as unknown as {
        id: string;
        org_id: string;
        counterparty_org_id: string | null;
        stage: string;
        step: string;
        title: string | null;
        commodity: string | null;
        quantity: number | null;
        unit: string | null;
        price: number | null;
        currency: string | null;
        incoterms: string | null;
        jurisdiction: string | null;
      },
      stageContext: data.stageContext,
      actorId: userId,
    });

    let clean: CleanProposal[];
    let rejected: string[];
    let model: string = AI_PLUS_MODEL;

    if (external) {
      clean = external.clean;
      rejected = external.rejected;
      model = external.model;
    } else {
      // A reasoning model spends part of its token budget thinking; too small a budget leaves the
      // visible answer empty, and it sometimes wraps its JSON in a code fence. So the budget is
      // generous, the reply is read leniently, and one unreadable/empty reply is retried at a lower
      // reasoning effort before giving up.
      const askOnce = async (effort: "high" | "medium"): Promise<string> => {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: AI_PLUS_MODEL,
            reasoning_effort: effort,
            max_completion_tokens: 16000,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
        });
        if (res.status === 429) {
          const body = await res.text().catch(() => "");
          const { isOpenAiQuotaExceeded } = await import("@/lib/openai.server");
          if (isOpenAiQuotaExceeded(body)) {
            const { alertLowFunds } = await import("@/lib/opsAlerts.server");
            void alertLowFunds("OpenAI", 429, body);
            throw new Error("AI credits are exhausted for this workspace — support has been notified.");
          }
          throw new Error("AI is busy right now. Please try again shortly.");
        }
        if (res.status === 403) {
          const body = await res.text();
          throw new Error(
            body.includes("credit_limit_reached")
              ? "The workspace AI spending limit has been reached, so AI+ cannot run. A workspace admin needs to raise the limit."
              : `AI+ analysis was blocked: ${body.slice(0, 300)}`,
          );
        }
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`AI+ analysis failed (${res.status}). ${body.slice(0, 300)}`);
        }

        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return json.choices?.[0]?.message?.content ?? "";
      };
      const readProposals = (content: string): RawProposal[] | null => {
        const body = content.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
        const start = body.indexOf("{");
        const end = body.lastIndexOf("}");
        if (start < 0 || end <= start) return null;
        try {
          const parsed = JSON.parse(body.slice(start, end + 1)) as { proposals?: RawProposal[] };
          return Array.isArray(parsed.proposals) ? parsed.proposals : null;
        } catch {
          return null;
        }
      };
      let raw = readProposals(await askOnce("high"));
      if (!raw || raw.length === 0) raw = readProposals(await askOnce("medium"));
      if (!raw) {
        throw new Error("AI+ returned an analysis that could not be read. Please run it again.");
      }
      const validated = validate(raw, citedUrls);
      clean = validated.clean;
      rejected = validated.rejected;
    }

    if (clean.length === 0)
      throw new Error("AI+ produced no valid proposals. Please run the analysis again.");

    const packId = crypto.randomUUID();
    const { data: inserted, error } = await supabase
      .from("ai_proposals")
      .insert(
        // related_counterparty predates the regenerated Supabase types (migration 0013) — cast
        // through unknown until types are regenerated after that migration runs.
        clean.map((c) => ({
          transaction_id: tx.id,
          // Their contract names the protected service's packs `ai_plus_decision_pack`; advice
          // from the hosted model keeps the existing `ai_plus` name so older records still read.
          kind: external ? "ai_plus_decision_pack" : "ai_plus",

          model,

          decision_pack_id: packId,
          stage_context: data.stageContext,
          proposal_type: c.proposal_type,
          probability: c.probability,
          output: c.output,
          rationale: c.rationale,
          source_references: c.source_references,
          related_counterparty: c.related_counterparty,
        })) as unknown as never[],
      )
      .select();
    if (error) throw new Error(error.message);

    // Any earlier, still-undecided advice for this same event is retired in favour of the pack
    // just produced, so the person is only ever shown one live set of recommendations.
    const supersededId = (inserted ?? [])[0]?.id;
    if (supersededId) {
      await supabase
        .from("ai_proposals")
        .update({ superseded_by: supersededId })
        .eq("transaction_id", tx.id)
        .eq("stage_context", data.stageContext)
        .is("superseded_by", null)
        .is("decided_at", null)
        .neq("decision_pack_id", packId);
    }

    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      stage: tx.stage,
      step: tx.step,
      action: "ai_plus_decision_pack",
      summary: `AI+ proposed ${clean.length} option${clean.length === 1 ? "" : "s"} for review`,
      payload: {
        packId,
        stageContext: data.stageContext,
        advisoryOnly: true,
        droppedByValidation: rejected,
      },
    });

    return { packId, proposals: inserted ?? [], reused: false };
  });

/**
 * A person adopts or rejects one proposal. This is its own business event: authenticated,
 * attributed, timestamped, and appended to the log — the trail reads
 * "AI+ proposed X → <person> accepted X → time", never "system selected X".
 */
export const decideProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposalId: z.string().uuid(),
        decision: z.enum(["accepted", "rejected"]),
        note: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: proposal } = await supabase
      .from("ai_proposals")
      .select("*")
      .eq("id", data.proposalId)
      .maybeSingle();
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.decided_at) throw new Error("This proposal has already been decided");

    const decidedAt = new Date().toISOString();
    const { error } = await supabase
      .from("ai_proposals")
      .update({
        decision: data.decision,
        decided_by: userId,
        decided_at: decidedAt,
        adopted_by: data.decision === "accepted" ? userId : null,
        adopted_at: data.decision === "accepted" ? decidedAt : null,
      })
      .eq("id", proposal.id);
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const person = profile?.full_name || profile?.email || "A person";

    await supabase.from("transaction_events").insert({
      transaction_id: proposal.transaction_id,
      actor_id: userId,
      stage: "trading",
      step: "ai-plus",
      action: data.decision === "accepted" ? "proposal_accepted" : "proposal_rejected",
      summary: `AI+ proposed ${proposal.proposal_type ?? "an option"} → ${person} ${data.decision} it`,
      payload: {
        proposalId: proposal.id,
        packId: proposal.decision_pack_id,
        stageContext: proposal.stage_context,
        proposalType: proposal.proposal_type,
        probability: proposal.probability,
        decision: data.decision,
        note: data.note ?? null,
        decidedAt,
      },
    });

    // Once every proposal in this pack has a decision, file the whole pack — every option AI+
    // put forward and what was chosen for each — as an audit document against the deal, so the
    // reasoning behind the outcome is on the record, not just the outcome itself.
    const { data: packProposals } = proposal.decision_pack_id
      ? await supabase
          .from("ai_proposals")
          .select("*")
          .eq("decision_pack_id", proposal.decision_pack_id)
          .is("superseded_by", null)
      : { data: null };
    const pack = packProposals ?? [];
    const allDecided = pack.length > 0 && pack.every((p) => p.id === proposal.id || p.decided_at);
    if (allDecided) {
      const { data: tx } = await supabase
        .from("transactions")
        .select("title")
        .eq("id", proposal.transaction_id)
        .maybeSingle();
      const deciderIds = [...new Set(pack.map((p) => p.decided_by).filter((id): id is string => Boolean(id)))];
      const { data: deciders } = deciderIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", deciderIds)
        : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
      const nameOf = (id: string | null) => {
        const d = (deciders ?? []).find((p) => p.id === id);
        return d?.full_name || d?.email || "A person";
      };
      const stageContext = proposal.stage_context as StageContext;
      const body = [
        `IZENZO — AI+ DECISION AUDIT — ${STAGE_LABEL[stageContext]}`,
        "",
        ...pack
          .map((p, i) => [
            `${i + 1}. [${p.proposal_type ?? "option"}] ${p.output}`,
            p.rationale ? `   Why AI+ recommended this: ${p.rationale}` : null,
            Array.isArray(p.source_references) && p.source_references.length > 0
              ? `   Based on: ${parseEvidenceRefs(p.source_references).map((e) => `${e.chain}${e.verified ? "" : " (not verified)"}`).join("; ")}`
              : null,
            p.probability != null ? `   Evidence confirmed: ${Math.round(Number(p.probability) * 100)}%` : null,
            p.related_counterparty ? `   Counterparty: ${p.related_counterparty}` : null,
            `   Decision: ${(p.id === proposal.id ? data.decision : p.decision) ?? "—"} by ${nameOf(p.id === proposal.id ? userId : p.decided_by)} at ${p.id === proposal.id ? decidedAt : p.decided_at}`,
          ].filter((line): line is string => Boolean(line)).join("\n")),
      ].join("\n");
      const path = `deals/${proposal.transaction_id}/${Date.now()}-ai-plus-audit-${stageContext}.txt`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, new Blob([body], { type: "text/plain" }));
      if (!upErr) {
        await supabase.from("documents").insert({
          transaction_id: proposal.transaction_id,
          name: `AI+ Decisions — ${STAGE_LABEL[stageContext]} — ${tx?.title ?? ""}.txt`,
          doc_type: "audit",
          notes: "AI+ decision audit",
          storage_path: path,
        });
      }
    }

    return { decidedAt, decision: data.decision };
  });

/** Reads the pack for one spine event without running AI+. */
export const getDecisionPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(packInput)
  .handler(async ({ data, context }) => {
    const { data: proposals } = await context.supabase
      .from("ai_proposals")
      .select("*")
      .eq("transaction_id", data.transactionId)
      .eq("stage_context", data.stageContext)
      .is("superseded_by", null)
      .order("probability", { ascending: false });
    return { proposals: proposals ?? [] };
  });

/**
 * Sends one spine moment to the client's protected AI+ service.
 *
 * This is the interface's other four moments — Intent confirmed, POI sealed, WaD changed and
 * Finality recorded — invoked from the same authenticated server path that records them, as
 * their pack requires. It is advisory in every case and informational only after sealing and
 * after Finality: it never writes Choice, Intent, POI, WaD, Execution or Finality state, and it
 * returns quietly when the integration is switched off, unreachable or non-conformant.
 */
export const emitAiPlusSpineEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(packInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // RLS decides whether this person may see the transaction at all, so a caller in one
    // organisation can never raise an invocation for another organisation's deal.
    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) return { invoked: false as const };

    const external = await tryProtectedAiPlus({
      transaction: tx as unknown as AiPlusTransaction,
      stageContext: data.stageContext,
      actorId: userId,
    });
    if (!external) return { invoked: false as const };

    const packId = crypto.randomUUID();
    await supabase.from("ai_proposals").insert(
      external.clean.map((c) => ({
        transaction_id: tx.id,
        kind: "ai_plus_decision_pack",
        model: external.model,
        decision_pack_id: packId,
        stage_context: data.stageContext,
        proposal_type: c.proposal_type,
        probability: c.probability,
        output: c.output,
        rationale: c.rationale,
        source_references: c.source_references,
        related_counterparty: c.related_counterparty,
      })) as unknown as never[],
    );

    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      stage: tx.stage,
      step: tx.step,
      action: "ai_plus_decision_pack",
      summary: `AI+ recorded ${external.clean.length} advisory note${external.clean.length === 1 ? "" : "s"} at ${STAGE_LABEL[data.stageContext]}`,
      payload: { packId, stageContext: data.stageContext, advisoryOnly: true },
    });

    return { invoked: true as const, packId };
  });
