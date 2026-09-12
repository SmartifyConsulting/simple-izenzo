import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reads every document attached to a bid/offer — the ID photo by sight (OCR), and PDF / Word /
 * Excel / CSV / plain-text files as text — asks the AI to extract the deal's details, and saves a
 * bullet-point summary onto the transaction. Any ID number found is encrypted and stored in the
 * backend only; it never appears in the summary the other side reads. */
export const summarizeBidDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("You don't have access to this deal.");

    const { data: docs, error: docErr } = await supabase
      .from("documents")
      .select("name, notes, storage_path")
      .eq("transaction_id", data.transactionId)
      .order("created_at", { ascending: true });
    if (docErr) throw new Error(docErr.message);
    if (!docs || docs.length === 0) throw new Error("No documents to read yet.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this workspace.");

    const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
    const PDF_EXT = /\.pdf$/i;
    const DOCX_EXT = /\.docx$/i;
    const XLSX_EXT = /\.xlsx$/i;
    const TEXT_EXT = /\.(txt|md|csv|tsv|json|rtf|log)$/i;

    type Part =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
      | { type: "file"; file: { filename: string; file_data: string } };

    const parts: Part[] = [];
    const unreadable: string[] = [];

    for (const d of docs) {
      if (!d.storage_path) continue;
      const name = d.name;
      const kind = (d.notes as string | null) ?? "Document";

      if (IMAGE_EXT.test(name)) {
        // Images go by signed link so the gateway reads them directly instead of this server
        // re-encoding every photo.
        const { data: signed } = await supabase.storage
          .from("documents")
          .createSignedUrl(d.storage_path, 300);
        if (signed?.signedUrl) {
          parts.push({ type: "image_url", image_url: { url: signed.signedUrl } });
          continue;
        }
        unreadable.push(name);
        continue;
      }

      const { data: blob, error: dlErr } = await supabase.storage
        .from("documents")
        .download(d.storage_path);
      if (dlErr || !blob) {
        unreadable.push(name);
        continue;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());

      try {
        if (PDF_EXT.test(name)) {
          parts.push({
            type: "file",
            file: { filename: name, file_data: `data:application/pdf;base64,${toBase64(bytes)}` },
          });
        } else if (DOCX_EXT.test(name)) {
          const text = await docxText(bytes);
          parts.push({ type: "text", text: `--- ${kind}: ${name} ---\n${text}` });
        } else if (XLSX_EXT.test(name)) {
          const text = await xlsxText(bytes);
          parts.push({ type: "text", text: `--- ${kind}: ${name} ---\n${text}` });
        } else if (TEXT_EXT.test(name)) {
          const text = new TextDecoder().decode(bytes).slice(0, 200_000);
          parts.push({ type: "text", text: `--- ${kind}: ${name} ---\n${text}` });
        } else {
          unreadable.push(name);
        }
      } catch {
        unreadable.push(name);
      }
    }

    if (parts.length === 0) {
      throw new Error(
        "None of the attached files contained readable content — attach a photo, PDF, Word, Excel or text document.",
      );
    }

    const instruction =
      "These are the ID and supporting documents attached to a trade bid/offer. Read every one of them " +
      "(photos by sight, documents by their text) and write out the party's ask in their own terms.\n" +
      'Reply with JSON only: {"summary_bullets": string[], "id_number": string|null, "facts": ' +
      '{"commodity": string|null, "quantity": number|null, "unit": string|null, "price": number|null, ' +
      '"currency": string|null, "incoterms": string|null, "jurisdiction": string|null, "side": "buy"|"sell"|null}}.\n' +
      "summary_bullets is 5-12 short bullet points, each a complete statement without a leading dash, covering " +
      "everything material to the exchange that the documents actually state: what is wanted or offered, " +
      "quantities and units, prices and currency, grades/specifications, delivery terms, timing, payment terms, " +
      "conditions, and who the party is. Do not force the documents into a fixed shape — if a document states " +
      "something material that none of these words cover, say it anyway. Only state what the documents show, " +
      "and say plainly when something isn't stated.\n" +
      "facts repeats just the few details needed to search for a counterparty, in machine form: commodity as a " +
      "short plain name, numbers as numbers, currency as a 3-letter code, jurisdiction as a country or region " +
      "name, side as buy when the party wants to acquire and sell when they want to dispose. Use null for " +
      "anything the documents do not state — never guess.\n" +
      "Never put any identity/passport number inside the bullets or facts — put it only in id_number " +
      "(null when no ID number is visible)." +
      (unreadable.length > 0
        ? ` Note: ${unreadable.join(", ")} could not be read — mention ${unreadable.length === 1 ? "it was" : "they were"} not reviewed rather than guessing.`
        : "");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content:
              "You read trade documents (IDs, contracts, invoices, spec sheets, spreadsheets) and extract " +
              "deal details precisely. Reply with raw JSON only — no markdown fences, no commentary.",
          },
          { role: "user", content: [{ type: "text", text: instruction }, ...parts] },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI is busy right now. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`The documents could not be read just now (${res.status}). ${body.slice(0, 300)}`.trim());
    }
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const raw = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!raw) throw new Error("The document summary came back empty.");

    const parsed = parseReply(raw);
    const summary = parsed.bullets.map((b) => `• ${b}`).join("\n");
    if (!summary) throw new Error("The document summary came back empty.");

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
    if (!tx.commodity && facts.commodity) filled["commodity"] = facts.commodity;
    if (tx.quantity == null && facts.quantity != null) filled["quantity"] = facts.quantity;
    if (!tx.unit && facts.unit) filled["unit"] = facts.unit;
    if (tx.price == null && facts.price != null) filled["price"] = facts.price;
    if (facts.currency && (!tx.currency || tx.currency === "USD")) filled["currency"] = facts.currency;
    if (!tx.incoterms && facts.incoterms) filled["incoterms"] = facts.incoterms;
    if (!tx.jurisdiction && facts.jurisdiction) filled["jurisdiction"] = facts.jurisdiction;

    const { error: upErr } = await supabase
      .from("transactions")
      .update({
        document_summary: summary,
        document_summary_generated_at: new Date().toISOString(),
        ...filled,
        ...(idCipher ? { id_number_encrypted: idCipher } : {}),
      } as never)
      .eq("id", tx.id);
    if (upErr) throw new Error(upErr.message);

    return { summary, facts, unreadable };
  });

function toBase64(bytes: Uint8Array) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

/** Pulls the visible text out of a .docx by unzipping it and stripping the WordprocessingML tags. */
async function docxText(bytes: Uint8Array): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const doc = files["word/document.xml"];
  if (!doc) return "";
  return xmlToText(strFromU8(doc)).slice(0, 200_000);
}

/** Pulls the cell values out of a .xlsx — shared strings plus any inline/number cells. */
async function xlsxText(bytes: Uint8Array): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const sharedRaw = files["xl/sharedStrings.xml"];
  const shared = sharedRaw
    ? [...strFromU8(sharedRaw).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlToText(m[1] ?? ""))
    : [];

  const out: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) continue;
    const sheet = strFromU8(content);
    for (const row of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const cell of (row[1] ?? "").matchAll(/<c[^>]*?(?:\st="(\w+)")?[^>]*>([\s\S]*?)<\/c>/g)) {
        const type = cell[1];
        const inner = cell[2] ?? "";
        const value = xmlToText(inner);
        if (!value) continue;
        cells.push(type === "s" ? (shared[Number(value)] ?? "") : value);
      }
      if (cells.length > 0) out.push(cells.join(" | "));
    }
  }
  return out.join("\n").slice(0, 200_000);
}

function xmlToText(xml: string) {
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The few machine-readable details the counterparty search needs, all optional. */
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

/** The model is asked for raw JSON, but tolerate fenced JSON or a plain-prose fallback. */
function parseReply(raw: string): { bullets: string[]; idNumber: string | null; facts: DocumentFacts } {
  const body = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const obj = JSON.parse(body) as { summary_bullets?: unknown; id_number?: unknown; facts?: unknown };
    const bullets = Array.isArray(obj.summary_bullets)
      ? obj.summary_bullets.map((b) => String(b).replace(/^[-•*]\s*/, "").trim()).filter(Boolean)
      : [];
    if (bullets.length > 0) {
      return {
        bullets,
        idNumber: typeof obj.id_number === "string" && obj.id_number.trim() ? obj.id_number.trim() : null,
        facts: readFacts(obj.facts),
      };
    }
  } catch {
    // fall through to prose handling
  }
  const bullets = body
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  return { bullets, idNumber: null, facts: EMPTY_FACTS };
}
