import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_FACT_FIELDS, isTransactionType, TRANSACTION_TYPES, type TransactionType } from "@/lib/transactionType";

/** Reads every document attached to a bid/offer — the ID photo by sight (OCR), and PDF / Word /
 * Excel / CSV / plain-text files as text — asks the AI to extract the deal's details, and saves a
 * bullet-point summary onto the transaction. Any ID number found is encrypted and stored in the
 * backend only; it never appears in the summary the other side reads. */
export const summarizeBidDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    try {
      return await readAndSummarize(supabase, data.transactionId);
    } catch (err) {
      // A read that fails must leave its reason on the deal, so the workspace can say why instead
      // of showing an empty summary for ever.
      const reason = (err as Error).message || "The documents could not be read.";
      await supabase
        .from("transactions")
        .update({ document_summary_error: reason.slice(0, 500) } as never)
        .eq("id", data.transactionId);
      throw err;
    }
  });

type AuthedClient = { from: (t: string) => any; storage: { from: (b: string) => any } };

async function readAndSummarize(supabase: AuthedClient, transactionId: string) {
  {
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, search_prompt")
      .eq("id", transactionId)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("You don't have access to this deal.");

    const { data: docs, error: docErr } = await supabase
      .from("documents")
      .select("name, notes, storage_path")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true });
    if (docErr) throw new Error(docErr.message);
    if (!docs || docs.length === 0) throw new Error("No documents to read yet.");

    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (!apiKey) throw new Error("AI is not configured for this workspace.");

    const { buildDocumentParts } = await import("@/lib/documentParts.server");
    const { parts, unreadable } = await buildDocumentParts(supabase, docs);

    if (parts.length === 0) {
      throw new Error(
        "None of the attached files contained readable content — attach a photo, PDF, Word, Excel, PowerPoint or text document.",
      );
    }

    const instruction =
      "These are the ID and supporting documents attached to a trade bid/offer. Read every one of them " +
      "(photos by sight, documents by their text) and write out the party's ask in their own terms.\n" +
      'Reply with JSON only: {"title": string, "summary_bullets": string[], "id_number": string|null, "facts": ' +
      '{"commodity": string|null, "quantity": number|null, "unit": string|null, "price": number|null, ' +
      '"currency": string|null, "incoterms": string|null, "jurisdiction": string|null, "side": "buy"|"sell"|null}, ' +
      '"transaction_type": string, "structured_facts": object}.\n' +
      `transaction_type is exactly one of ${TRANSACTION_TYPES.map((t) => `"${t}"`).join(", ")} — the kind of transaction ` +
      "these documents actually describe, not just what commodity field a generic bid form has. Use \"project_finance\" " +
      "for a power, energy or infrastructure project (a PPA, EPC contract, project financing, or similar), not just " +
      "any deal that happens to involve a physical commodity. Use \"other\" only when neither fits.\n" +
      "structured_facts is a flat object using ONLY these keys, one value per key, using null for a key that does not " +
      `belong to the classified transaction_type or is not stated in the documents:\n` +
      ALL_FACT_FIELDS.map((f) => `  ${f.key} (${f.type}): ${f.label} — ${f.hint}`).join("\n") +
      "\nFill only the keys belonging to the classified transaction_type; every other key must be null. Each filled " +
      "value must be the specific fact stated in the documents (a figure, date, term or name as written) — never a " +
      "guess, an assumption or a typical/industry-standard figure. Leave a key null rather than approximate it.\n" +
      "title is a concise, specific trade title of 4-10 words suitable for display under a bid ID. " +
      "Use the documents and Search Prompt, never a filename or a generic title such as New Bid. " +
      `Search Prompt: ${tx.search_prompt || "not provided"}.\n` +
      "summary_bullets is an ordered array of plain strings (no leading dash on any of them) laid out as " +
      "fixed sections, each a separate array entry:\n" +
      '1. One entry exactly "Proposal: <one clear sentence stating what is being asked for or offered>".\n' +
      '2. One entry exactly "Scope", immediately followed by one entry per concrete scope item, each of ' +
      'those prefixed with exactly two spaces then "- " (e.g. "  - <scope item>"). If the documents state no ' +
      'scope, still include the header followed by one entry "  - Not stated".\n' +
      '3. The same pattern for "Deliverables": a header entry "Deliverables" then "  - " prefixed entries, ' +
      'or "  - Not stated".\n' +
      '4. The same pattern for "Evaluation Criteria": a header entry "Evaluation Criteria" then "  - " ' +
      'prefixed entries, or "  - Not stated".\n' +
      '5. One final entry exactly "Due Date: <the date the documents state, or "Not stated">".\n' +
      "Never merge two of these sections into one entry, never add the \"- \" prefix to a header entry, and " +
      "never add extra top-level entries outside this structure — everything material that doesn't fit one " +
      "of these five sections still belongs inside the closest matching one (Scope is the default) rather " +
      "than as a loose bullet. Only state what the documents show, and say plainly when something isn't " +
      "stated — never guess.\n" +
      "facts repeats just the few details needed to search for a counterparty, in machine form: commodity as a " +
      "short plain name, numbers as numbers, currency as a 3-letter code, jurisdiction as a country or region " +
      "name, side as buy when the party wants to acquire and sell when they want to dispose. Use null for " +
      "anything the documents do not state — never guess.\n" +
      "Never put any identity/passport number inside the bullets or facts — put it only in id_number " +
      "(null when no ID number is visible)." +
      (unreadable.length > 0
        ? ` Note: ${unreadable.join(", ")} could not be read — mention ${unreadable.length === 1 ? "it was" : "they were"} not reviewed rather than guessing.`
        : "");

    // One retry with a stricter instruction, so a reply that came back in the wrong shape isn't
    // treated as an unreadable document.
    async function ask(extra: string) {
      const { callAiChat, aiChatFailureMessage } = await import("@/lib/aiChat.server");
      // Reading the documents is the request that matters, so it gets the full retry budget. It
      // goes to the OpenAI account saved under Admin → Integrations.
      const res = await callAiChat(
        apiKey!,
        {
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content:
                "You read trade documents (IDs, contracts, invoices, spec sheets, spreadsheets) and extract " +
                "deal details precisely. Reply with raw JSON only — no markdown fences, no commentary." +
                extra,
            },
            { role: "user", content: [{ type: "text", text: instruction + extra }, ...parts] },
          ],
        },
        { usage: { operation: "document_read", transactionId: tx.id, orgId: tx.org_id } },
      );
      if (!res.ok) {
        const message = await aiChatFailureMessage(res);
        const body = await res.clone().text().catch(() => "");
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


    let parsed = parseReply(await ask(""));
    if (parsed.bullets.length === 0) {
      parsed = parseReply(
        await ask(
          '\nReply with nothing but the JSON object, starting with { and ending with }. "summary_bullets" must contain at least three bullets.',
        ),
      );
    }
    const summary = parsed.bullets.map((b) => (b.startsWith("  - ") ? b : `• ${b}`)).join("\n");
    if (!summary) throw new Error("The document summary came back empty.");
    const generatedTitle = parsed.title?.slice(0, 120) ?? null;


    let idCipher: string | null = null;
    if (parsed.idNumber) {
      try {
        const { encryptSecrets } = await import("./integrationCrypto.server");
        idCipher = await encryptSecrets({ id_number: parsed.idNumber });
      } catch {
        // No encryption key configured — better to store nothing than to store it in the clear.
        idCipher = null;
      }
    }

    // The documents only fill blanks — anything the user typed themselves stays as they typed it.
    const facts = parsed.facts;
    const filled: Record<string, unknown> = {};
    // The transaction type and its structured facts are AI+ orchestration inputs, not a field the
    // user fills in, so they are always overwritten with the latest read rather than "fill blank
    // only" — a later document (an EPC contract added after the initial upload) should correct an
    // earlier misclassification, not be ignored because a type was already set.
    if (parsed.transactionType) filled["transaction_type"] = parsed.transactionType;
    if (parsed.structuredFacts) {
      filled["structured_facts"] = parsed.structuredFacts;
      filled["structured_facts_generated_at"] = new Date().toISOString();
    }
    if (!tx.commodity && facts.commodity) filled["commodity"] = facts.commodity;
    // A quantity or price of 0 is the "nothing entered yet" a new bid starts with, not a real value.
    const empty = (v: unknown) => v == null || Number(v) === 0;
    if (empty(tx.quantity) && facts.quantity != null) filled["quantity"] = facts.quantity;
    if (!tx.unit && facts.unit) filled["unit"] = facts.unit;
    if (empty(tx.price) && facts.price != null) filled["price"] = facts.price;
    if (facts.currency && (!tx.currency || tx.currency === "USD")) filled["currency"] = facts.currency;
    if (!tx.incoterms && facts.incoterms) filled["incoterms"] = facts.incoterms;
    if (!tx.jurisdiction && facts.jurisdiction) filled["jurisdiction"] = facts.jurisdiction;

    const { error: upErr } = await supabase
      .from("transactions")
      .update({
        document_summary: summary,
        document_summary_generated_at: new Date().toISOString(),
        document_summary_error: null,
        ...((tx.title === "New Bid" || tx.title === "New Offer") && generatedTitle
          ? { title: generatedTitle }
          : {}),
        ...filled,
        ...(idCipher ? { id_number_encrypted: idCipher } : {}),
      } as never)
      .eq("id", tx.id);
    if (upErr) throw new Error(upErr.message);

    // The bid/offer record itself starts out at price 0 and quantity 0 — carry what the documents
    // state into it too, or everything that reads that record (the AI+ advice included) sees an
    // offer with no commercial terms even though the uploaded document has them.
    try {
      const { data: bos } = await supabase
        .from("bid_offers")
        .select("id, price, quantity, unit, currency")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: true })
        .limit(1);
      const bo = (bos ?? [])[0] as
        | { id: string; price: number | null; quantity: number | null; unit: string | null; currency: string | null }
        | undefined;
      if (bo) {
        const patch: Record<string, unknown> = {};
        if (empty(bo.price) && facts.price != null) patch["price"] = facts.price;
        if (empty(bo.quantity) && facts.quantity != null) patch["quantity"] = facts.quantity;
        if (!bo.unit && facts.unit) patch["unit"] = facts.unit;
        if (facts.currency && (!bo.currency || bo.currency === "USD")) patch["currency"] = facts.currency;
        if (Object.keys(patch).length > 0) {
          await supabase.from("bid_offers").update(patch).eq("id", bo.id);
        }
      }
    } catch {
      // The summary is saved either way; a failure here only leaves the record's terms as they were.
    }

    return {
      summary,
      title: generatedTitle,
      facts,
      unreadable,
      transactionType: parsed.transactionType,
      structuredFacts: parsed.structuredFacts,
    };
  }
}


export type DocumentFacts = {
  commodity: string | null;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  currency: string | null;
  incoterms: string | null;
  jurisdiction: string | null;
  side: "buy" | "sell" | null;
};

const EMPTY_FACTS: DocumentFacts = {
  commodity: null,
  quantity: null,
  unit: null,
  price: null,
  currency: null,
  incoterms: null,
  jurisdiction: null,
  side: null,
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[, ]/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
}

function readFacts(v: unknown): DocumentFacts {
  if (!v || typeof v !== "object") return EMPTY_FACTS;
  const f = v as Record<string, unknown>;
  const side = str(f["side"])?.toLowerCase();
  return {
    commodity: str(f["commodity"]),
    quantity: num(f["quantity"]),
    unit: str(f["unit"]),
    price: num(f["price"]),
    currency: str(f["currency"])?.toUpperCase().slice(0, 3) ?? null,
    incoterms: str(f["incoterms"]),
    jurisdiction: str(f["jurisdiction"]),
    side: side === "buy" || side === "sell" ? side : null,
  };
}

/** Reads `structured_facts` against the known field list, keeping only real keys and dropping
 * anything blank — the model is asked to null out fields that don't apply, but a defensive read
 * never trusts that it did. */
function readStructuredFacts(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object") return null;
  const src = v as Record<string, unknown>;
  const known = new Set(ALL_FACT_FIELDS.map((f) => f.key));
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(src)) {
    if (!known.has(k)) continue;
    const s = str(val);
    if (s) out[k] = s;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** The model is asked for raw JSON, but tolerate fenced JSON or a plain-prose fallback. */
function parseReply(raw: string): {
  title: string | null;
  bullets: string[];
  idNumber: string | null;
  facts: DocumentFacts;
  transactionType: TransactionType | null;
  structuredFacts: Record<string, string> | null;
} {
  const body = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const obj = JSON.parse(body) as {
      title?: unknown;
      summary_bullets?: unknown;
      id_number?: unknown;
      facts?: unknown;
      transaction_type?: unknown;
      structured_facts?: unknown;
    };
    const bullets = Array.isArray(obj.summary_bullets)
      ? obj.summary_bullets.map((b) => normalizeBulletLine(String(b))).filter(Boolean)
      : [];
    if (bullets.length > 0) {
      return {
        title: str(obj.title),
        bullets,
        idNumber: typeof obj.id_number === "string" && obj.id_number.trim() ? obj.id_number.trim() : null,
        facts: readFacts(obj.facts),
        transactionType: isTransactionType(obj.transaction_type) ? obj.transaction_type : null,
        structuredFacts: readStructuredFacts(obj.structured_facts),
      };
    }
  } catch {
    // fall through to prose handling
  }
  const bullets = body
    .split(/\n+/)
    .map((line) => normalizeBulletLine(line))
    .filter(Boolean);
  return { title: null, bullets, idNumber: null, facts: EMPTY_FACTS, transactionType: null, structuredFacts: null };
}

/** Keeps a "  - " sub-bullet marker intact (so the Live Workspace can still tell it apart from a
 * section header once every bullet is joined into one text blob) while still stripping whatever
 * dash/bullet character the model itself put on the line. */
function normalizeBulletLine(line: string): string {
  const isSub = /^\s{2,}[-•*]/.test(line);
  const text = line.replace(/^\s*[-•*]\s*/, "").trim();
  return text ? (isSub ? `  - ${text}` : text) : "";
}
