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
      .select("id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, search_prompt")
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

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this workspace.");


    const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
    const PDF_EXT = /\.pdf$/i;
    const DOCX_EXT = /\.docx$/i;
    const XLSX_EXT = /\.xlsx$/i;
    const PPTX_EXT = /\.pptx$/i;
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
          // A whole PDF travels as base64, which is a third bigger again — past this size the
          // request is refused, so say the file was too big rather than failing the whole read.
          if (bytes.length > 8_000_000) {
            unreadable.push(`${name} (too large to read — over 8 MB)`);
            continue;
          }
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
        } else if (PPTX_EXT.test(name)) {
          const text = await pptxText(bytes);
          if (!text.trim()) {
            unreadable.push(`${name} (no readable text on the slides)`);
            continue;
          }
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
        "None of the attached files contained readable content — attach a photo, PDF, Word, Excel, PowerPoint or text document.",
      );
    }

    const instruction =
      "These are the ID and supporting documents attached to a trade bid/offer. Read every one of them " +
      "(photos by sight, documents by their text) and write out the party's ask in their own terms.\n" +
      'Reply with JSON only: {"title": string, "summary_bullets": string[], "id_number": string|null, "facts": ' +
      '{"commodity": string|null, "quantity": number|null, "unit": string|null, "price": number|null, ' +
      '"currency": string|null, "incoterms": string|null, "jurisdiction": string|null, "side": "buy"|"sell"|null}}.\n' +
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
                "deal details precisely. Reply with raw JSON only — no markdown fences, no commentary." +
                extra,
            },
            { role: "user", content: [{ type: "text", text: instruction + extra }, ...parts] },
          ],
        }),
      });
      if (res.status === 429) throw new Error("AI is busy right now. Please try again shortly.");
      if (res.status === 402) {
        const { alertLowFunds } = await import("@/lib/opsAlerts.server");
        void alertLowFunds("AI Gateway", 402);
        throw new Error("AI credits are exhausted for this workspace — support has been notified.");
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `The documents could not be read just now (${res.status}). ${body.slice(0, 300)}`.trim(),
        );
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
        document_summary_error: null,
        ...((tx.title === "New Bid" || tx.title === "New Offer") && generatedTitle
          ? { title: generatedTitle }
          : {}),
        ...filled,
        ...(idCipher ? { id_number_encrypted: idCipher } : {}),
      } as never)
      .eq("id", tx.id);
    if (upErr) throw new Error(upErr.message);

    return { summary, title: generatedTitle, facts, unreadable };
  }
}


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

/** Pulls the visible text out of a .pptx — every slide's text boxes, slide by slide. */
async function pptxText(bytes: Uint8Array): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const slidePaths = Object.keys(files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const n = (s: string) => Number(s.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return n(a) - n(b);
    });
  const out: string[] = [];
  for (const path of slidePaths) {
    const raw = files[path];
    if (!raw) continue;
    const xml = strFromU8(raw);
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((m) => xmlToText(m[1] ?? "").trim())
      .filter(Boolean)
      .join("\n");
    if (text) out.push(`[Slide ${out.length + 1}]\n${text}`);
  }
  return out.join("\n\n").slice(0, 200_000);
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
function parseReply(raw: string): { title: string | null; bullets: string[]; idNumber: string | null; facts: DocumentFacts } {
  const body = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const obj = JSON.parse(body) as { title?: unknown; summary_bullets?: unknown; id_number?: unknown; facts?: unknown };
    const bullets = Array.isArray(obj.summary_bullets)
      ? obj.summary_bullets.map((b) => normalizeBulletLine(String(b))).filter(Boolean)
      : [];
    if (bullets.length > 0) {
      return {
        title: str(obj.title),
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
    .map((line) => normalizeBulletLine(line))
    .filter(Boolean);
  return { title: null, bullets, idNumber: null, facts: EMPTY_FACTS };
}

/** Keeps a "  - " sub-bullet marker intact (so the Live Workspace can still tell it apart from a
 * section header once every bullet is joined into one text blob) while still stripping whatever
 * dash/bullet character the model itself put on the line. */
function normalizeBulletLine(line: string): string {
  const isSub = /^\s{2,}[-•*]/.test(line);
  const text = line.replace(/^\s*[-•*]\s*/, "").trim();
  return text ? (isSub ? `  - ${text}` : text) : "";
}
