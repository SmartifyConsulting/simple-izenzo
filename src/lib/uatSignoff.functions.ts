import { createServerFn } from "@tanstack/react-start";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The only three people who may sign this document — checked here, server-side, not just in the
 * form. Casing is normalised for a forgiving match, but the stored name is always this exact,
 * canonical spelling. */
export const AUTHORIZED_SIGNERS = ["David Davies", "James Davies", "Daniel Davies"] as const;
export type AuthorizedSigner = (typeof AUTHORIZED_SIGNERS)[number];

export function matchAuthorizedSigner(name: string): AuthorizedSigner | null {
  const typed = name.trim().toLowerCase();
  return AUTHORIZED_SIGNERS.find((s) => s.toLowerCase() === typed) ?? null;
}

export const PROJECT_NAME = "Izenzo Trading Gateway";

/** The key functionality a signer is confirming, as far as Step 2 (GRC/Compliance) — not the
 * whole five-step pipeline. Shown as a tick-list in the modal and carried into the signed PDF, so
 * the signature is against something concrete rather than a bare acceptance statement. */
export const UAT_CHECKLIST: string[] = [
  "Register a Bid or Offer",
  "Upload deal documents (AI reads and summarises them)",
  "AI + AI+ search surfaces counterparties",
  "Choose a counterparty",
  "Online screening completes",
  "Confirm Intent",
  "Seal Intent (Proof of Intent)",
  "Without a Doubt (WaD) compliance clears",
  "Business documents filed",
];

export const DOCUMENT_INTRO = [
  "This document confirms User Acceptance Testing (UAT) sign-off for the Izenzo Trading Gateway",
  "platform, covering the workflow through Step 1 (Trading) and Step 2 (Compliance & Governance).",
  "",
  "By signing below, the authorised signer confirms that each item on the checklist below has been",
  "reviewed and found to work as expected, and that the project is accepted to this point, pending",
  "any items separately logged for follow-up.",
];

const DOCUMENT_BODY = [
  ...DOCUMENT_INTRO,
  "",
  "Key functionality checklist (Step 1-2):",
  ...UAT_CHECKLIST.map((item) => `  [x] ${item}`),
  "",
  "This signed document serves as the definitive record of project acceptance to this point.",
];

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

async function buildSignedPdf(opts: {
  signerName: string;
  signedAt: Date;
  signatureImageBytes: Uint8Array;
}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  let y = 790;

  page.drawText(`UAT Sign-Off — ${PROJECT_NAME}`, { x: 50, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.3) });
  y -= 36;

  for (const line of DOCUMENT_BODY) {
    if (line === "") {
      y -= 10;
      continue;
    }
    page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
  }

  // Signature block.
  y -= 30;
  page.drawLine({ start: { x: 50, y: y + 10 }, end: { x: 545, y: y + 10 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 10;
  page.drawText("Electronic Signature", { x: 50, y, size: 13, font: bold, color: rgb(0.1, 0.1, 0.3) });
  y -= 22;
  page.drawText(`Signed by: ${opts.signerName}`, { x: 50, y, size: 11, font, color: rgb(0, 0, 0) });
  y -= 8;

  const sigImage = await doc.embedPng(opts.signatureImageBytes);
  const sigDims = sigImage.scaleToFit(220, 70);
  y -= sigDims.height;
  page.drawImage(sigImage, { x: 50, y, width: sigDims.width, height: sigDims.height });
  y -= 6;

  page.drawText(`Date Signed: ${fmtDate(opts.signedAt)}`, { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;
  page.drawText(`Time Signed: ${fmtTime(opts.signedAt)}`, { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;
  page.drawText("Status: SIGNED", { x: 50, y, size: 10, font: bold, color: rgb(0.05, 0.45, 0.2) });
  y -= 20;
  page.drawText(
    "This document has been electronically signed via the Izenzo Trading Gateway UAT sign-off workflow.",
    { x: 50, y, size: 8, font, color: rgb(0.45, 0.45, 0.45) },
  );

  return doc.save();
}

const signInput = (data: unknown) =>
  z
    .object({
      signerName: z.string().min(1),
      // A PNG data URL of the on-screen cursive signature preview — rendered client-side from the
      // same Great Vibes font shown in the modal, so the PDF's signature matches exactly what the
      // signer saw and confirmed. No drawing pad, no external e-sign provider.
      signatureImageDataUrl: z.string().startsWith("data:image/png;base64,"),
    })
    .parse(data);

export const signUatDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(signInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const signer = matchAuthorizedSigner(data.signerName);
    if (!signer) {
      throw new Error("That name is not an authorised signer for this document.");
    }

    // Defense in depth — the real enforcement is the unique constraint on signer_name, which
    // still applies even if two requests race each other.
    const { data: existing } = await (supabase.from("uat_signoffs" as never) as any)
      .select("id")
      .eq("signer_name", signer)
      .maybeSingle();
    if (existing) {
      throw new Error(`This document has already been signed by ${signer}.`);
    }

    const base64 = data.signatureImageDataUrl.split(",")[1] ?? "";
    const signatureImageBytes = new Uint8Array(Buffer.from(base64, "base64"));

    const signedAt = new Date();
    const pdfBytes = await buildSignedPdf({ signerName: signer, signedAt, signatureImageBytes });

    const slug = signer.toLowerCase().replace(/\s+/g, "-");
    const pdfPath = `uat-signoffs/${slug}-${Date.now()}.pdf`;
    const pdfName = `${PROJECT_NAME.replace(/\s+/g, "-")}-${signer.replace(/\s+/g, "-")}-SIGNED.pdf`;

    const { error: upErr } = await supabase.storage
      .from("uat-signoffs")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: row, error: insErr } = await (supabase.from("uat_signoffs" as never) as any)
      .insert({
        signer_name: signer,
        signed_at: signedAt.toISOString(),
        pdf_path: pdfPath,
        pdf_name: pdfName,
        created_by: userId,
      })
      .select()
      .single();
    // A unique-violation here means someone else's request won the race to sign as this person —
    // the PDF we just uploaded is simply orphaned (harmless), and the real signed record is theirs.
    if (insErr) throw new Error(`This document has already been signed by ${signer}.`);

    return {
      signerName: signer,
      signedAt: signedAt.toISOString(),
      pdfPath,
      pdfName,
      id: (row as { id: string }).id,
    };
  });
