import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Generates a short, tailored planning questionnaire for the Concept sub-step — the same handful
 * of framing questions any new initiative gets asked (problem, proposal, audience, outcomes,
 * requirements, risks, strategic fit), but worded against this specific bid/offer rather than
 * generically. Runs once per deal, the same way generateConceptBrief does; the answers are a
 * separate, lightweight shared field on the transaction (no AI involved in saving them). */
export const generateConceptQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    try {
      return await buildConceptQuestions(supabase, data.transactionId);
    } catch (err) {
      const reason = (err as Error).message || "The questionnaire could not be generated.";
      await supabase
        .from("transactions")
        .update({ concept_questions_error: reason.slice(0, 500) } as never)
        .eq("id", data.transactionId);
      throw err;
    }
  });

type AuthedClient = { from: (t: string) => any };

async function buildConceptQuestions(supabase: AuthedClient, transactionId: string) {
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, search_prompt")
    .eq("id", transactionId)
    .maybeSingle();
  if (txErr) throw new Error(txErr.message);
  if (!tx) throw new Error("You don't have access to this deal.");

  const { loadOpenAiApiKey } = await import("@/lib/openai.server");
  const apiKey = await loadOpenAiApiKey();
  if (!apiKey) throw new Error("AI is not configured for this workspace.");

  const dealContext = [
    `Deal: ${tx.title}`,
    tx.commodity ? `Commodity: ${tx.commodity}` : null,
    tx.quantity ? `Quantity: ${tx.quantity} ${tx.unit ?? ""}`.trim() : null,
    tx.price ? `Price: ${tx.price} ${tx.currency ?? ""}`.trim() : null,
    tx.incoterms ? `Incoterms: ${tx.incoterms}` : null,
    tx.jurisdiction ? `Jurisdiction: ${tx.jurisdiction}` : null,
    tx.search_prompt ? `The parties' own description of the deal: ${tx.search_prompt}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const instruction =
    "This is the Concept stage of executing a trade deal that has just been sealed — both parties " +
    "need to think through what they are actually undertaking before execution proceeds. Write 5 to 7 " +
    "short, plain-English planning questions tailored to this specific deal, in the spirit of (but not " +
    "copied verbatim from) these example questions:\n" +
    "What problem or opportunity exists? What are we proposing? Who is it for? What outcomes are we " +
    "trying to achieve? What would broadly be required? What are the obvious constraints or risks? " +
    "Is the idea aligned with the organisation's strategy?\n" +
    "Ground each question in the deal's own commodity, quantity, terms and jurisdiction where that " +
    "makes it more specific — otherwise keep it general enough for either party to answer.\n" +
    'Reply with JSON only: {"questions": string[]}, nothing else.\n' +
    `Deal context:\n${dealContext}`;

  const { callAiChat, aiChatFailureMessage } = await import("@/lib/aiChat.server");
  const res = await callAiChat(
    apiKey,
    {
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You write short, plain-English planning questions for people about to execute a trade " +
            "deal. Reply with raw JSON only — no markdown fences, no commentary.",
        },
        { role: "user", content: instruction },
      ],
    },
    { usage: { operation: "concept_questions", transactionId: tx.id, orgId: tx.org_id } },
  );
  if (!res.ok) {
    const message = await aiChatFailureMessage(res);
    const body = await res
      .clone()
      .text()
      .catch(() => "");
    const { isOpenAiQuotaExceeded } = await import("@/lib/openai.server");
    if (isOpenAiQuotaExceeded(body)) {
      const { alertLowFunds } = await import("@/lib/opsAlerts.server");
      void alertLowFunds("OpenAI", res.status, body);
    }
    throw new Error(message);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (json.choices?.[0]?.message?.content ?? "").trim();
  const body = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let questions: string[] = [];
  try {
    const obj = JSON.parse(body) as { questions?: unknown };
    questions = Array.isArray(obj.questions)
      ? obj.questions.map((q) => String(q).trim()).filter(Boolean).slice(0, 10)
      : [];
  } catch {
    questions = [];
  }
  if (questions.length === 0) throw new Error("The questionnaire was generated, but came back empty.");

  const { error: upErr } = await supabase
    .from("transactions")
    .update({
      concept_questions: questions,
      concept_questions_generated_at: new Date().toISOString(),
      concept_questions_error: null,
    } as never)
    .eq("id", tx.id);
  if (upErr) throw new Error(upErr.message);

  return { questions };
}
