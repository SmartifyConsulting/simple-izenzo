import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** AI+ for INTERPOL cases. Advisory only: it proposes leads (stored undecided) and drafts a
 * closing summary. Every accept/reject is a separate, attributed human decision. */

async function ask(system: string, user: string, usage: { transactionId: string; orgId: string }) {
  const { loadOpenAiApiKey } = await import("@/lib/openai.server");
  const apiKey = await loadOpenAiApiKey();
  const { callAiChat, aiChatFailureMessage } = await import("@/lib/aiChat.server");
  const res = await callAiChat(
    apiKey,
    {
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: system + " Reply with raw JSON only — no markdown fences." },
        { role: "user", content: user },
      ],
    },
    { usage: { operation: "case_ai", ...usage } },
  );
  if (!res.ok) throw new Error(await aiChatFailureMessage(res));
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (json.choices?.[0]?.message?.content ?? "").trim().replace(/^```(json)?|```$/g, "");
  return JSON.parse(text) as Record<string, unknown>;
}

async function loadCase(supabase: any, transactionId: string) {
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, org_id, reference, title, search_prompt, jurisdiction")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx) throw new Error("You don't have access to this case.");
  const [{ data: ev }, { data: leads }] = await Promise.all([
    supabase.from("case_evidence").select("file_name, source, note, created_at").eq("transaction_id", transactionId),
    supabase.from("case_leads").select("direction, title, decision").eq("transaction_id", transactionId),
  ]);
  const ctx = [
    `Case ${tx.reference}: ${tx.title}`,
    tx.search_prompt ? `Starting evidence: ${tx.search_prompt}` : "",
    tx.jurisdiction ? `Jurisdiction: ${tx.jurisdiction}` : "",
    `Logged evidence:\n${(ev ?? []).map((e: any) => `- ${e.file_name ?? "note"} (${e.source ?? "unknown source"}): ${e.note ?? ""}`).join("\n") || "none yet"}`,
    `Existing leads:\n${(leads ?? []).map((l: any) => `- [${l.direction}] ${l.title} — ${l.decision ?? "undecided"}`).join("\n") || "none"}`,
  ].join("\n");
  return { tx, ctx };
}

export const analyseCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { tx, ctx } = await loadCase(context.supabase, data.transactionId);
    const out = await ask(
      "You assist law-enforcement investigators. You propose investigative leads; you never decide.",
      'Propose 4-6 new leads not already listed. JSON: {"leads":[{"direction":"backward"|"forward"|"lateral","title":string,"reason":string,"evidence_basis":string,"expected_result":string,"effect":"strengthens"|"weakens"|"neutral","authority_required":string}]}. ' +
        "backward = trace origin, forward = follow proceeds/outcome, lateral = linked entities. authority_required names the legal instrument (warrant, subpoena, MLAT, consent, none).\n" +
        ctx,
      { transactionId: tx.id, orgId: tx.org_id },
    );
    const leads = z
      .array(
        z.object({
          direction: z.enum(["backward", "forward", "lateral"]),
          title: z.string(),
          reason: z.string().optional(),
          evidence_basis: z.string().optional(),
          expected_result: z.string().optional(),
          effect: z.string().optional(),
          authority_required: z.string().optional(),
        }),
      )
      .parse(out["leads"] ?? []);
    if (leads.length === 0) throw new Error("AI+ returned no leads — try again after adding evidence.");
    const { error } = await context.supabase
      .from("case_leads")
      .insert(leads.map((l) => ({ ...l, transaction_id: tx.id })) as never);
    if (error) throw new Error(error.message);
    return { count: leads.length };
  });

export const draftCaseSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { tx, ctx } = await loadCase(context.supabase, data.transactionId);
    const out = await ask(
      "You draft neutral case-closure summaries for investigators to review and edit.",
      'JSON: {"summary": string} — 120-200 words: what was alleged, evidence logged, leads accepted/rejected, open questions. State only what the record shows.\n' +
        ctx,
      { transactionId: tx.id, orgId: tx.org_id },
    );
    return { summary: String(out["summary"] ?? "") };
  });
