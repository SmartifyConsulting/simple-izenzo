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
    .replace(/[^\x00-\x7E -ÿ–—•]/g, "");
}

/** The Izenzo mark that heads every certificate this module produces — the icon + wordmark lockup
 * on a light card, not the plain wordmark used elsewhere, since that one is cut for a dark
 * background and renders invisible on a certificate's white page. Resolved from
 * `public/izenzo-logo-certificate.png`, whether this runs on the client (bundler URL) or on the
 * server (read off disk) — and never fatal: a certificate without its logo is still a valid
 * certificate, so a load failure just leaves the heading as plain text. */
const CERTIFICATE_LOGO_URL = "/izenzo-logo-certificate.png";
let logoBytesPromise: Promise<Uint8Array | null> | null = null;

async function loadCertificateLogoBytes(): Promise<Uint8Array | null> {
  if (!logoBytesPromise) {
    logoBytesPromise = (async () => {
      try {
        if (typeof window === "undefined") {
          const { readFile } = await import("node:fs/promises");
          const { join } = await import("node:path");
          return new Uint8Array(await readFile(join(process.cwd(), "public", "izenzo-logo-certificate.png")));
        }
        const res = await fetch(CERTIFICATE_LOGO_URL);
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
      } catch {
        return null;
      }
    })();
  }
  return logoBytesPromise;
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

const PAGE_W = 595;
const PAGE_H = 842;
// Double border: two concentric hairline rectangles a few points apart, matching the on-screen
// certificate card's `border-double`.
const OUTER_MARGIN = 36;
const INNER_MARGIN = 41;
// Content sits with its own breathing room inside the double border.
const CONTENT_X = 64;
const CONTENT_W = PAGE_W - CONTENT_X * 2;
const CONTENT_TOP = PAGE_H - 60;
const CONTENT_BOTTOM = 70;

/** A neatly laid-out, Izenzo-branded PDF for the certificates and records the app files against a
 * deal (Confirmation of Intent, Proposal, Proof of Intent, Without a Doubt) — styled to match the
 * same double-bordered certificate card shown on screen (logo, centred heading, a two-column field
 * grid, a seal line at the foot) rather than a plain top-to-bottom text dump. `lines` are
 * pre-formatted body lines: an empty string adds a blank line, and a line shaped "Label: value" is
 * laid into the field grid — consecutive field lines share rows, two to a row, the same way the
 * on-screen card's own grid does; anything else (a section header, an indented bullet) breaks the
 * grid and prints full width. */
export async function buildBrandedCertificatePdf(opts: {
  heading: string;
  lines: string[];
  fingerprint?: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = CONTENT_TOP;
  let pageStarted = false;

  const drawFrame = () => {
    page.drawRectangle({
      x: OUTER_MARGIN,
      y: OUTER_MARGIN,
      width: PAGE_W - OUTER_MARGIN * 2,
      height: PAGE_H - OUTER_MARGIN * 2,
      borderColor: rgb(0.1, 0.1, 0.3),
      borderWidth: 1.25,
    });
    page.drawRectangle({
      x: INNER_MARGIN,
      y: INNER_MARGIN,
      width: PAGE_W - INNER_MARGIN * 2,
      height: PAGE_H - INNER_MARGIN * 2,
      borderColor: rgb(0.1, 0.1, 0.3),
      borderWidth: 0.5,
    });
  };

  // Logo at top-left of the content area, then a divider spanning it — the same "logo, border-b"
  // header the on-screen card uses, rather than a plain heading row.
  const drawLetterhead = async () => {
    const logoBytes = await loadCertificateLogoBytes();
    let drewLogo = false;
    if (logoBytes) {
      try {
        const logo = await pdf.embedPng(logoBytes);
        const logoHeight = 26;
        const logoWidth = (logo.width / logo.height) * logoHeight;
        page.drawImage(logo, { x: CONTENT_X, y: y - logoHeight + 6, width: logoWidth, height: logoHeight });
        drewLogo = true;
      } catch {
        drewLogo = false;
      }
    }
    if (!drewLogo) {
      page.drawText("Izenzo", { x: CONTENT_X, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.3) });
    }
    y -= 30;
    page.drawLine({
      start: { x: CONTENT_X, y },
      end: { x: CONTENT_X + CONTENT_W, y },
      thickness: 0.75,
      color: rgb(0.82, 0.82, 0.82),
    });
    y -= 22;
  };

  const newPageIfNeeded = async (needed = 90) => {
    if (y - needed < CONTENT_BOTTOM) {
      drawFrame();
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = CONTENT_TOP;
      await drawLetterhead();
    }
  };

  const startPage = async () => {
    if (pageStarted) return;
    pageStarted = true;
    await drawLetterhead();
  };
  await startPage();

  // Centred, bold, uppercase heading — the certificate's own title, same treatment as the card.
  const headingSize = 15;
  const headingText = sanitizeForPdf(opts.heading).toUpperCase();
  const headingWidth = bold.widthOfTextAtSize(headingText, headingSize);
  page.drawText(headingText, {
    x: CONTENT_X + (CONTENT_W - headingWidth) / 2,
    y,
    size: headingSize,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 30;

  // The two-column field grid: label (small, muted) over value (medium), auto-flowing row-major
  // the same way the on-screen `dl` grid does — two cells per row, filled left then right.
  const colGap = 24;
  const colW = (CONTENT_W - colGap) / 2;
  let col: 0 | 1 = 0;
  let rowHeight = 0;

  const flushRow = () => {
    if (col === 1) {
      y -= rowHeight;
      col = 0;
    }
    rowHeight = 0;
  };

  for (const rawLine of opts.lines) {
    if (rawLine === "") {
      flushRow();
      y -= 8;
      continue;
    }
    const raw = sanitizeForPdf(rawLine);
    const sep = raw.indexOf(": ");
    const looksLikeField = sep > 0 && sep < 28 && !/^\s|^\s*[•\-]/.test(raw);
    const looksIndented = /^\s|^\s*[•\-]/.test(raw);

    if (looksLikeField) {
      await newPageIfNeeded(50);
      const label = raw.slice(0, sep);
      const value = raw.slice(sep + 2);
      const cellX = CONTENT_X + (col === 0 ? 0 : colW + colGap);
      page.drawText(label.toUpperCase(), {
        x: cellX,
        y,
        size: 7.5,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      const valueLines = wrap(value, colW, 10, bold);
      valueLines.forEach((line, i) => {
        page.drawText(line, { x: cellX, y: y - 13 - i * 13, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
      });
      const cellHeight = 13 + valueLines.length * 13 + 6;
      rowHeight = Math.max(rowHeight, cellHeight);
      if (col === 0) {
        col = 1;
      } else {
        y -= rowHeight;
        col = 0;
        rowHeight = 0;
      }
      continue;
    }

    // A header or an indented bullet breaks the grid — flush whatever's mid-row, then print full
    // width below it.
    flushRow();
    await newPageIfNeeded(40);
    if (looksIndented) {
      for (const line of wrap(raw.trim(), CONTENT_W - 12, 9.5, font)) {
        page.drawText(line, { x: CONTENT_X + 12, y, size: 9.5, font, color: rgb(0.25, 0.25, 0.25) });
        y -= 13;
      }
    } else {
      for (const line of wrap(raw, CONTENT_W, 11, bold)) {
        page.drawText(line, { x: CONTENT_X, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.3) });
        y -= 16;
      }
    }
    y -= 4;
  }
  flushRow();

  if (opts.fingerprint) {
    await newPageIfNeeded(50);
    y -= 6;
    page.drawLine({
      start: { x: CONTENT_X, y },
      end: { x: CONTENT_X + CONTENT_W, y },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 20;
    // Centred, small, monospace-ish — the certificate's own seal/serial line.
    const sealLabel = "SEAL";
    const sealText = sanitizeForPdf(opts.fingerprint);
    const sealLabelWidth = bold.widthOfTextAtSize(sealLabel, 7.5);
    page.drawText(sealLabel, {
      x: CONTENT_X + (CONTENT_W - sealLabelWidth) / 2,
      y,
      size: 7.5,
      font: bold,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 12;
    const sealWidth = font.widthOfTextAtSize(sealText, 8);
    page.drawText(sealText, {
      x: CONTENT_X + Math.max(0, (CONTENT_W - sealWidth) / 2),
      y,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 18;
  }

  await newPageIfNeeded(30);
  y -= 6;
  for (const line of wrap(
    "This record was produced inside the Izenzo Trading Gateway and reflects the state of this deal at the moment it was filed.",
    CONTENT_W,
    8,
    font,
  )) {
    page.drawText(line, { x: CONTENT_X, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    y -= 11;
  }

  drawFrame();
  return pdf.save();
}
