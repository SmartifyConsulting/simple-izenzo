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

    await supabase
      .from("organisations")
      .update({ credits: (org.credits ?? 0) - POI_COST })
      .eq("id", org.id);
    await supabase.from("credit_ledger").insert({
      org_id: org.id,
      delta: -POI_COST,
      reason: "Proof of Intent sealed",
      transaction_id: tx.id,
    });
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

    await supabase
      .from("organisations")
      .update({ credits: (org.credits ?? 0) - WAD_COST })
      .eq("id", org.id);
    await supabase.from("credit_ledger").insert({
      org_id: org.id,
      delta: -WAD_COST,
      reason: "WaD verification",
      transaction_id: tx.id,
    });

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

    const model = data.kind === "ai" ? "google/gemini-3.7-flash" : "openai/gpt-5.4";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
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
