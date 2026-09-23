import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const ARROW_REPLACEMENTS: Record<string, string> = {
  "←": "<-",
  "→": "->",
  "↔": "<->",
  "⇐": "<=",
  "⇒": "=>",
  "⇔": "<=>",
};

/** pdf-lib's standard fonts only support the WinAnsi encoding (~Windows-1252) — a Unicode arrow,
 * emoji or other symbol outside that range throws at render time instead of just looking wrong.
 * AI-generated text (a rationale, an evidence chain) is the likeliest source of one of these, so
 * every piece of text handed to this module is sanitised through here first. Characters kept: the
 * dashes, quotes, ellipsis and bullet the layout below already deliberately uses. */
export function sanitizeForPdf(text: string): string {
  return text
    .replace(/[←→↔⇐⇒⇔]/g, (ch) => ARROW_REPLACEMENTS[ch] ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x00-\x7E -ÿ–—•]/g, "");
}

function wrap(text: string, max: number, size: number, font: Awaited<ReturnType<PDFDocument["embedFont"]>>): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (line && font.widthOfTextAtSize(cand, size) > max) {
      lines.push(line);
      line = w;
    } else line = cand;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** A neatly laid-out, Izenzo-branded PDF for the certificates and records the app files against a
 * deal (Confirmation of Intent, Proposal, Proof of Intent, Without a Doubt) — the same look as the
 * signed-document record, so every filed record reads as an actual issued document, not a plain
 * text dump opened raw by the browser. `lines` are pre-formatted body lines: an empty string adds
 * a blank line, and a line shaped "Label: value" is rendered as a label/value pair. */
export async function buildBrandedCertificatePdf(opts: {
  heading: string;
  lines: string[];
  fingerprint?: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 780;

  const newPageIfNeeded = () => {
    if (y < 90) {
      page = pdf.addPage([595, 842]);
      y = 780;
    }
  };

  page.drawText(sanitizeForPdf(opts.heading), { x: 50, y, size: 17, font: bold, color: rgb(0.1, 0.1, 0.3) });
  y -= 15;
  page.drawText("Izenzo Trading Gateway", { x: 50, y, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
  y -= 12;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.75, color: rgb(0.1, 0.1, 0.3) });
  y -= 26;

  for (const rawLine of opts.lines) {
    newPageIfNeeded();
    if (rawLine === "") {
      y -= 10;
      continue;
    }
    const raw = sanitizeForPdf(rawLine);
    const sep = raw.indexOf(": ");
    const looksLikeField = sep > 0 && sep < 28 && !/^\s|^\s*[•\-]/.test(raw);
    const looksIndented = /^\s|^\s*[•\-]/.test(raw);
    if (looksLikeField) {
      const label = raw.slice(0, sep);
      const value = raw.slice(sep + 2);
      page.drawText(label, { x: 50, y, size: 10, font: bold, color: rgb(0.2, 0.2, 0.2) });
      for (const line of wrap(value, 340, 10, font)) {
        page.drawText(line, { x: 200, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
        y -= 14;
      }
    } else if (looksIndented) {
      for (const line of wrap(raw.trim(), 480, 9.5, font)) {
        page.drawText(line, { x: 62, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 13;
      }
    } else {
      for (const line of wrap(raw, 495, 11, bold)) {
        page.drawText(line, { x: 50, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.3) });
        y -= 16;
      }
    }
    y -= 3;
  }

  if (opts.fingerprint) {
    newPageIfNeeded();
    y -= 8;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 20;
    page.drawText("Fingerprint (SHA-256)", { x: 50, y, size: 9, font: bold, color: rgb(0.2, 0.2, 0.2) });
    y -= 13;
    page.drawText(sanitizeForPdf(opts.fingerprint), { x: 50, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
    y -= 16;
  }

  newPageIfNeeded();
  y -= 8;
  for (const line of wrap(
    "This record was produced inside the Izenzo Trading Gateway and reflects the state of this deal at the moment it was filed.",
    495,
    8.5,
    font,
  )) {
    page.drawText(line, { x: 50, y, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
    y -= 11;
  }

  return pdf.save();
}
