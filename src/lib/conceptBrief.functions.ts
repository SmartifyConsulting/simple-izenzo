import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DocumentStorageClient } from "@/lib/documentParts.server";

/** Reads the signed legal agreements attached to a deal and writes the AI's interpretation of them
 * onto the transaction — what each party is expected to do, the terms, and the dates.
 *
 * Advisory only, the same as every other AI output here: it is a reading of the documents filed on
 * the deal, shown on the Concept step for both sides to work from. It is never a decision, and
 * nothing downstream treats it as one. Runs once, when the bidder continues past Without a Doubt.
 */
export const generateConceptBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    try {
      return await buildConceptBrief(supabase, data.transactionId);
    } catch (err) {
      // Leave the reason on the deal so the Concept step can say why there is nothing to read yet,
      // rather than showing an empty brief indefinitely.
      const reason = (err as Error).message || "The agreements could not be read.";
      await supabase
        .from("transactions")
        .update({ concept_brief_error: reason.slice(0, 500) } as never)
        .eq("id", data.transactionId);
      throw err;
    }
  });

type AuthedClient = {
  from: (t: string) => any;
} & DocumentStorageClient;

async function buildConceptBrief(supabase: AuthedClient, transactionId: string) {
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select(
      "id, org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, document_summary, search_prompt",
    )
    .eq("id", transactionId)
    .maybeSingle();
  if (txErr) throw new Error(txErr.message);
  if (!tx) throw new Error("You don't have access to this deal.");

  // Only the agreements matter here — this is the step immediately after they were signed, so the
  // brief is a reading of the contract, not of the original bid pack.
  const { data: docs, error: docErr } = await supabase
    .from("documents")
    .select("name, notes, storage_path")
    .eq("transaction_id", transactionId)
    .eq("notes", "Legal Agreement")
    .order("created_at", { ascending: true });
  if (docErr) throw new Error(docErr.message);
  if (!docs || docs.length === 0) {
    throw new Error("No legal agreements have been filed on this deal yet.");
  }

  const { loadOpenAiApiKey } = await import("@/lib/openai.server");
  const apiKey = await loadOpenAiApiKey();
  if (!apiKey) throw new Error("AI is not configured for this workspace.");

  const { buildDocumentParts } = await import("@/lib/documentParts.server");
  const { parts, unreadable } = await buildDocumentParts(supabase, docs);
  if (parts.length === 0) {
    throw new Error(
      "None of the legal agreements could be read — a PDF, Word, Excel or text file works best.",
    );
  }

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
    "These are the signed legal agreements for a trade deal. Read every one of them and set out what " +
    "they actually commit each party to, so both sides start execution from the same understanding of " +
    "the contract.\n" +
    'Reply with JSON only: {"parties": [{"party": string, "expected": string[]}], "terms": ' +
    '[{"term": string, "detail": string}], "dates": [{"milestone": string, "date": string}], ' +
    '"uncertainties": string[]}.\n' +
    "parties lists each party named in the agreements, with what that party is expected to do, " +
    "deliver or refrain from — one item per distinct obligation, in the agreement's own terms.\n" +
    "terms covers the commercial and legal terms: price and how it is calculated, quantity, quality " +
    "specifications, delivery and Incoterms, payment terms, duration, governing law, and any " +
    "liability, penalty or termination provision.\n" +
    "dates lists every dated milestone or deadline the agreements state, as the milestone and the " +
    "date exactly as written.\n" +
    "uncertainties lists anything genuinely ambiguous, contradictory or simply absent that the " +
    "parties will need to settle — leave it empty if the agreements are clear.\n" +
    "Every entry must come from what the agreements state. Where something is not stated, say " +
    '"Not stated" rather than supplying a typical or industry-standard figure, and never infer a ' +
    "party's obligation that the text does not place on them. Do not give legal advice or an " +
    "opinion on whether the agreement is sound — describe what it says.\n" +
    `Deal context, for reference only (the agreements are the authority):\n${dealContext}` +
    (unreadable.length > 0
      ? `\nNote: ${unreadable.join(", ")} could not be read — ${
          unreadable.length === 1 ? "it was" : "they were"
        } not reviewed, so say so in uncertainties rather than guessing at their contents.`
      : "");

  async function ask(extra: string) {
    const { callAiChat, aiChatFailureMessage } = await import("@/lib/aiChat.server");
    // Reading the agreements is the request that matters, so it gets the full retry budget, and it
    // goes to the OpenAI account saved under Admin → Integrations.
    const res = await callAiChat(
      apiKey!,
      {
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "You read signed trade contracts and state precisely what they commit each party to. " +
              "Reply with raw JSON only — no markdown fences, no commentary." +
              extra,
          },
          { role: "user", content: [{ type: "text", text: instruction + extra }, ...parts] },
        ],
      },
      { usage: { operation: "concept_brief", transactionId: tx.id, orgId: tx.org_id } },
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
    return (json.choices?.[0]?.message?.content ?? "").trim();
  }

  let parsed = parseConceptReply(await ask(""));
  if (parsed.rendered === "") {
    parsed = parseConceptReply(
      await ask("\nReply with nothing but the JSON object, starting with { and ending with }."),
    );
  }
  if (parsed.rendered === "")
    throw new Error("The agreements were read, but no interpretation came back.");

  const { error: upErr } = await supabase
    .from("transactions")
    .update({
      concept_brief: parsed.rendered,
      concept_brief_generated_at: new Date().toISOString(),
      concept_brief_error: null,
    } as never)
    .eq("id", tx.id);
  if (upErr) throw new Error(upErr.message);

  return { brief: parsed.rendered, unreadable };
}

type Party = { party: string; expected: string[] };
type Term = { term: string; detail: string };
type Milestone = { milestone: string; date: string };

function strList(v: unknown): string[] {
  return Array.isArray(v)
    ? v
        .map((x) => String(x).trim())
        .filter(Boolean)
        .slice(0, 40)
    : [];
}

/** Renders the model's structure into the plain-text sections the Concept step displays. Stored
 * rendered rather than raw, so the panel never has to know the model's JSON shape — and a reply in
 * the wrong shape degrades to whatever structure it did return instead of showing nothing. */
function parseConceptReply(raw: string): { rendered: string } {
  const body = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(body) as Record<string, unknown>;
  } catch {
    // Not JSON — the prose it did return is still a usable reading, so show it as written.
    return { rendered: body };
  }

  const parties: Party[] = Array.isArray(obj["parties"])
    ? (obj["parties"] as unknown[])
        .map((p) => {
          const o = (p ?? {}) as Record<string, unknown>;
          return { party: String(o["party"] ?? "").trim(), expected: strList(o["expected"]) };
        })
        .filter((p) => p.party)
    : [];

  const terms: Term[] = Array.isArray(obj["terms"])
    ? (obj["terms"] as unknown[])
        .map((t) => {
          const o = (t ?? {}) as Record<string, unknown>;
          return { term: String(o["term"] ?? "").trim(), detail: String(o["detail"] ?? "").trim() };
        })
        .filter((t) => t.term || t.detail)
    : [];

  const dates: Milestone[] = Array.isArray(obj["dates"])
    ? (obj["dates"] as unknown[])
        .map((d) => {
          const o = (d ?? {}) as Record<string, unknown>;
          return {
            milestone: String(o["milestone"] ?? "").trim(),
            date: String(o["date"] ?? "").trim(),
          };
        })
        .filter((d) => d.milestone || d.date)
    : [];

  const uncertainties = strList(obj["uncertainties"]);

  const out: string[] = [];

  if (parties.length > 0) {
    out.push("What each party is expected to do");
    for (const p of parties) {
      out.push(p.party);
      if (p.expected.length === 0) out.push("  - Not stated");
      else for (const e of p.expected) out.push(`  - ${e}`);
    }
  }

  if (terms.length > 0) {
    if (out.length > 0) out.push("");
    out.push("Terms");
    for (const t of terms)
      out.push(`  - ${t.term ? `${t.term}: ` : ""}${t.detail || "Not stated"}`);
  }

  if (dates.length > 0) {
    if (out.length > 0) out.push("");
    out.push("Dates");
    for (const d of dates)
      out.push(`  - ${d.milestone ? `${d.milestone}: ` : ""}${d.date || "Not stated"}`);
  }

  if (uncertainties.length > 0) {
    if (out.length > 0) out.push("");
    out.push("To settle between the parties");
    for (const u of uncertainties) out.push(`  - ${u}`);
  }

  return { rendered: out.join("\n").trim() };
}
