import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI+ is advisory, never the decision-maker.
 *
 * A DecisionPack is the only way AI+ output enters the record: a validated set of proposals,
 * each with a numeric probability between 0 and 1 (never Low/Medium/High), written to
 * `ai_proposals` and nowhere else. AI+ never touches the transaction spine
 * (Choice → Intent → POI → WaD → Execution → Finality); a person adopts or rejects each
 * proposal, and that adoption is its own attributed, timestamped, append-only event.
 */

const AI_PLUS_MODEL = "openai/gpt-6-astra";

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
  "wad_updated",
  "finality_recorded",
] as const;

export type StageContext = (typeof STAGE_CONTEXTS)[number];

const STAGE_BRIEF: Record<StageContext, string> = {
  choice_made:
    "A counterparty has just been chosen by a person. Advise on that choice: is the counterparty sound, is the pricing sane, what risks and structuring points matter, is the timing right, is a substitution or a bundle worth considering.",
  intent_confirmed:
    "Intent has been confirmed and the Proof of Intent is about to be sealed and become immutable. This is the last advisory word before that seal: name anything that should be settled first.",
  wad_updated:
    "The Without a Doubt compliance case has changed. Give advisory input only — you cannot approve, reject, alter or bypass the WaD gate; a compliance officer decides.",
  finality_recorded:
    "Finality has been recorded and the transaction is complete. Close the loop with observations for the record only — nothing here can change the transaction.",
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
};

/** Nothing unvalidated is ever written: a bad type or an out-of-range probability is dropped. */
function validate(raw: RawProposal[]) {
  const clean: {
    proposal_type: ProposalType;
    probability: number;
    output: string;
    rationale: string;
    source_references: string[];
  }[] = [];
  const rejected: string[] = [];

  for (const r of raw) {
    const type = String(r.proposal_type ?? "").toLowerCase() as ProposalType;
    if (!PROPOSAL_TYPES.includes(type)) {
      rejected.push(`unknown proposal type "${r.proposal_type}"`);
      continue;
    }
    const p = typeof r.probability === "number" ? r.probability : Number(r.probability);
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      rejected.push(`probability out of range for ${type}`);
      continue;
    }
    const summary = String(r.summary ?? "").trim();
    if (!summary) {
      rejected.push(`empty proposal for ${type}`);
      continue;
    }
    const refs = Array.isArray(r.source_references)
      ? r.source_references.map((s) => String(s)).filter(Boolean).slice(0, 8)
      : [];
    clean.push({
      proposal_type: type,
      probability: p,
      output: summary,
      rationale: String(r.rationale ?? "").trim(),
      source_references: refs,
    });
  }
  return { clean, rejected };
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
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this workspace.");

    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("Transaction not found");

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
      return { packId: existing[0]!.decision_pack_id, proposals: existing, reused: true };
    }

    const { data: parties } = await supabase
      .from("counterparties")
      .select("name, jurisdiction, status, score, rating_band, notes")
      .eq("transaction_id", tx.id);
    const { data: bids } = await supabase
      .from("bid_offers")
      .select("direction, price, quantity, unit, currency, terms, status")
      .eq("transaction_id", tx.id);
    const { data: docs } = await supabase
      .from("documents")
      .select("name, doc_type, notes")
      .eq("transaction_id", tx.id);

    const system = [
      "You are Izenzo AI+. You are advisory only: you never decide, never select, never adopt, and never change the transaction.",
      "Return STRICT JSON: {\"proposals\":[{\"proposal_type\":\"counterparty|pricing|risk|structure|timing|substitution|bundle\",\"probability\":0.0,\"summary\":\"one sentence\",\"rationale\":\"why, in plain professional language\",\"source_references\":[\"…\"]}]}",
      "probability is a number between 0 and 1 expressing how likely the proposal is to be the right course. Never use words like low, medium or high for it.",
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
      `Bids/offers: ${JSON.stringify(bids ?? [])}`,
      `Documents on file: ${JSON.stringify(docs ?? [])}`,
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_PLUS_MODEL,
        reasoning_effort: "high",
        max_completion_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI is busy right now. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    if (!res.ok) throw new Error("AI+ analysis failed");

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    let raw: RawProposal[] = [];
    try {
      const parsed = JSON.parse(content) as { proposals?: RawProposal[] };
      raw = Array.isArray(parsed.proposals) ? parsed.proposals : [];
    } catch {
      throw new Error("AI+ returned an analysis that could not be read. Please run it again.");
    }

    const { clean, rejected } = validate(raw);
    if (clean.length === 0)
      throw new Error("AI+ produced no valid proposals. Please run the analysis again.");

    const packId = crypto.randomUUID();
    const { data: inserted, error } = await supabase
      .from("ai_proposals")
      .insert(
        clean.map((c) => ({
          transaction_id: tx.id,
          kind: "ai_plus",
          model: AI_PLUS_MODEL,
          decision_pack_id: packId,
          stage_context: data.stageContext,
          proposal_type: c.proposal_type,
          probability: c.probability,
          output: c.output,
          rationale: c.rationale,
          source_references: c.source_references,
        })),
      )
      .select();
    if (error) throw new Error(error.message);

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
