/** Turning the files attached to a deal into something the AI can read — shared by the bid-document
 * summary and the Concept brief, which both read the same legal agreements and must not drift into
 * two different implementations of "read this PDF". */

export type Part =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const PDF_EXT = /\.pdf$/i;
const DOCX_EXT = /\.docx$/i;
const XLSX_EXT = /\.xlsx$/i;
const PPTX_EXT = /\.pptx$/i;
const TEXT_EXT = /\.(txt|md|csv|tsv|json|rtf|log)$/i;

/** The slice of the Supabase client these readers need. Typed loosely on purpose: the storage
 * builder's own generics add nothing here, and the call sites pass the real client. */
export type DocumentStorageClient = {
  storage: { from: (bucket: string) => any };
};

export type DocumentRef = { name: string; notes?: string | null; storage_path?: string | null };

/** Reads every document the caller can see and returns the parts to send to the model, plus the
 * names of anything that could not be read so the prompt can say so rather than let the model guess
 * at a file it never saw. */
export async function buildDocumentParts(
  supabase: DocumentStorageClient,
  docs: DocumentRef[],
  /** Defaults to the shared "documents" bucket deal attachments live in — pass a different bucket
   * for documents stored elsewhere (e.g. "authority-to-act", "proof-of-residence"). */
  bucket = "documents",
): Promise<{ parts: Part[]; unreadable: string[] }> {
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
        .from(bucket)
        .createSignedUrl(d.storage_path, 300);
      if (signed?.signedUrl) {
        parts.push({ type: "image_url", image_url: { url: signed.signedUrl } });
        continue;
      }
      unreadable.push(name);
      continue;
    }

    const { data: blob, error: dlErr } = await supabase.storage
      .from(bucket)
      .download(d.storage_path);
    if (dlErr || !blob) {
      unreadable.push(name);
      continue;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());

    try {
      if (PDF_EXT.test(name)) {
        // A whole PDF travels as base64, a third bigger again — past this size the request is
        // refused, so say the file was too big rather than failing the whole read.
        if (bytes.length > 8_000_000) {
          unreadable.push(`${name} (too large to read — over 8 MB)`);
          continue;
        }
        parts.push({
          type: "file",
          file: { filename: name, file_data: `data:application/pdf;base64,${toBase64(bytes)}` },
        });
      } else if (DOCX_EXT.test(name)) {
        parts.push({ type: "text", text: `--- ${kind}: ${name} ---\n${await docxText(bytes)}` });
      } else if (XLSX_EXT.test(name)) {
        parts.push({ type: "text", text: `--- ${kind}: ${name} ---\n${await xlsxText(bytes)}` });
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

  return { parts, unreadable };
}

export function toBase64(bytes: Uint8Array) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

/** Pulls the visible text out of a .docx by unzipping it and stripping the WordprocessingML tags. */
export async function docxText(bytes: Uint8Array): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const doc = files["word/document.xml"];
  if (!doc) return "";
  return xmlToText(strFromU8(doc)).slice(0, 200_000);
}

/** Pulls the visible text out of a .pptx — every slide's text boxes, slide by slide. */
export async function pptxText(bytes: Uint8Array): Promise<string> {
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
export async function xlsxText(bytes: Uint8Array): Promise<string> {
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
      for (const cell of (row[1] ?? "").matchAll(
        /<c[^>]*?(?:\st="(\w+)")?[^>]*>([\s\S]*?)<\/c>/g,
      )) {
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

export function xmlToText(xml: string) {
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
