import { createServerFn } from "@tanstack/react-start";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mutual diligence and dual signing between the two sides of a deal.
 *
 * Both sides run KYC and KYB on each other. Each check is either run and recorded, or switched
 * off — and switching one off always demands a written reason, which is kept with the record. Only
 * once both sides' checks are settled does the counterparty get the accept / challenge / opt-out
 * decision. Every state change is an attributed, timestamped record; nothing here touches the
 * sealed Proof of Intent, the WaD gate or any governance trigger.
 */

export type Side = "bidder" | "counterparty";
export type CheckState = "pending" | "passed" | "failed" | "waived";

export type DiligenceRow = {
  id: string;
  transaction_id: string;
  reviewer_side: Side;
  kyc_state: CheckState;
  kyb_state: CheckState;
  kyc_waiver_reason: string | null;
  kyb_waiver_reason: string | null;
  cleared_at: string | null;
  updated_at: string;
};

export type ResponseRow = {
  id: string;
  responder_side: Side;
  responder_name: string | null;
  response: "accepted" | "challenged" | "opted_out";
  message: string | null;
  created_at: string;
};

export type EngagementState = {
  side: Side | "observer";
  /** True once the counterparty has linked its own Izenzo account to this deal. */
  counterpartyLinked: boolean;
  counterpartyName: string | null;
  bidderName: string | null;
  diligence: DiligenceRow[];
  responses: ResponseRow[];
  /** Both sides' checks settled (passed or switched off with a reason) and none failed. */
  bothCleared: boolean;
  decided: "accepted" | "opted_out" | null;
};

const SETTLED: CheckState[] = ["passed", "waived"];

function isCleared(row: DiligenceRow | undefined) {
  return Boolean(row && SETTLED.includes(row.kyc_state) && SETTLED.includes(row.kyb_state));
}

/** Which side of this deal the caller is on — refuses anyone who is on neither. */
async function sideOf(
  supabase: any,
  userId: string,
  transactionId: string,
  options: { allowAdminObserver?: boolean } = {},
) {
  const { data: tx, error } = await supabase
    .from("transactions")
    .select("id, org_id, counterparty_org_id, title, reference, poi_sealed_at, created_by")
    .eq("id", transactionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tx) throw new Error("This deal is no longer available.");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("org_id, full_name").eq("id", userId).maybeSingle(),
    // A person can belong to more than one organisation, and their profile's own org_id is only
    // their default one — so membership, not that single field, decides which side they're on.
    supabase.from("org_members").select("org_id").eq("user_id", userId),
  ]);

  const myOrgs = new Set<string>(
    [
      (profile as { org_id?: string | null } | null)?.org_id ?? null,
      ...((memberships as { org_id: string }[] | null) ?? []).map((m) => m.org_id),
    ].filter(Boolean) as string[],
  );

  let side: Side | null = null;
  // The person who registered the deal is always on the bidder's side, even before their
  // organisation membership is in place.
  if (tx.created_by === userId || (tx.org_id && myOrgs.has(tx.org_id))) side = "bidder";
  else if (tx.counterparty_org_id && myOrgs.has(tx.counterparty_org_id)) side = "counterparty";
  if (!side && options.allowAdminObserver) {
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (isAdmin) {
      return {
        side: "observer" as const,
        tx: tx as {
          id: string;
          org_id: string;
          counterparty_org_id: string | null;
          title: string | null;
          reference: string | null;
          poi_sealed_at: string | null;
        },
        myName: (profile as { full_name?: string | null } | null)?.full_name ?? null,
      };
    }
  }
  if (!side) throw new Error("You're not a party to this deal.");

  return {
    side,
    tx: tx as {
      id: string;
      org_id: string;
      counterparty_org_id: string | null;
      title: string | null;
      reference: string | null;
      poi_sealed_at: string | null;
    },
    myName: (profile as { full_name?: string | null } | null)?.full_name ?? null,
  };
}

async function loadState(supabase: any, userId: string, transactionId: string): Promise<EngagementState> {
  const { side, tx } = await sideOf(supabase, userId, transactionId, { allowAdminObserver: true });

  const [{ data: dil }, { data: res }, { data: cp }, { data: org }] = await Promise.all([
    supabase.from("engagement_diligence").select("*").eq("transaction_id", transactionId),
    supabase
      .from("engagement_responses")
      .select("id, responder_side, responder_name, response, message, created_at")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("counterparties")
      .select("name")
      .eq("transaction_id", transactionId)
      .eq("status", "chosen")
      .maybeSingle(),
    supabase.from("organisations").select("name").eq("id", tx.org_id).maybeSingle(),
  ]);

  const diligence = (dil ?? []) as DiligenceRow[];
  const responses = (res ?? []) as ResponseRow[];
  const byBidder = diligence.find((d) => d.reviewer_side === "bidder");
  const byCounterparty = diligence.find((d) => d.reviewer_side === "counterparty");

  const failed = diligence.some((d) => d.kyc_state === "failed" || d.kyb_state === "failed");
  const last = [...responses].reverse().find((r) => r.response !== "challenged");

  return {
    side,
    counterpartyLinked: Boolean(tx.counterparty_org_id),
    counterpartyName: (cp as { name?: string } | null)?.name ?? null,
    bidderName: (org as { name?: string } | null)?.name ?? null,
    diligence,
    responses,
    bothCleared: !failed && isCleared(byBidder) && isCleared(byCounterparty),
    decided: last ? (last.response as "accepted" | "opted_out") : null,
  };
}

export const getEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => loadState(context.supabase, context.userId, data.transactionId));

/** Records the outcome of one of this side's own two checks on the other side, or switches that
 * check off with a written reason. A reason is mandatory for "waived" — that is the whole point of
 * allowing a check to be disabled at all. */
export const setDiligenceState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionId: z.string().uuid(),
        check: z.enum(["kyc", "kyb"]),
        state: z.enum(["pending", "passed", "failed", "waived"]),
        reason: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { side, tx, myName } = await sideOf(supabase, userId, data.transactionId);

    if (data.state === "waived" && !(data.reason && data.reason.length >= 5)) {
      throw new Error("Switching a check off needs a written explanation of why.");
    }

    const patch: Record<string, unknown> = {
      transaction_id: data.transactionId,
      reviewer_side: side,
      updated_by: userId,
      [`${data.check}_state`]: data.state,
      [`${data.check}_waiver_reason`]: data.state === "waived" ? (data.reason ?? null) : null,
    };

    const { data: existing } = await supabase
      .from("engagement_diligence")
      .select("id")
      .eq("transaction_id", data.transactionId)
      .eq("reviewer_side", side)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("engagement_diligence")
        .update(patch as never)
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("engagement_diligence").insert(patch as never);
      if (error) throw new Error(error.message);
    }

    const label = data.check === "kyc" ? "KYC (people)" : "KYB (company)";
    const what =
      data.state === "waived"
        ? `switched off — ${data.reason}`
        : data.state === "passed"
          ? "recorded as passed"
          : data.state === "failed"
            ? "recorded as not passed"
            : "reset to not started";

    await supabase.from("transaction_events").insert({
      transaction_id: data.transactionId,
      actor_id: userId,
      stage: "compliance",
      step: "wad",
      action: data.state === "waived" ? "diligence_check_waived" : "diligence_check_recorded",
      summary: `${myName ?? "A party"} (${side}) — ${label} ${what}`,
      payload: { side, check: data.check, state: data.state, reason: data.reason ?? null },
    });

    const state = await loadState(supabase, userId, data.transactionId);

    // Once both sides are satisfied, the counterparty is told and gets the decision.
    if (state.bothCleared && !state.decided) {
      const { notifyTransactionOwner, notifyCounterpartyContact } = await import("@/lib/bidderNotify.server");
      const ref = tx.reference ? `${tx.reference} — ` : "";
      await notifyTransactionOwner({
        orgId: tx.org_id,
        transactionId: tx.id,
        title: "KYC and KYB are settled on both sides",
        body: `${ref}${tx.title ?? "This deal"}: both sides' checks are settled. The counterparty can now accept, challenge or opt out.`,
      });
      const { data: cp } = await supabase
        .from("counterparties")
        .select("contact_email")
        .eq("transaction_id", tx.id)
        .eq("status", "chosen")
        .maybeSingle();
      const email = (cp as { contact_email?: string | null } | null)?.contact_email;
      if (email) {
        await notifyCounterpartyContact({
          email,
          transactionId: tx.id,
          title: "Your KYC and KYB checks came back clear",
          body: `${ref}${tx.title ?? "This deal"}: the checks are settled on both sides. Open the deal to accept, challenge or opt out of the engagement.`,
        });
      }
    }

    return state;
  });

/** Accept, challenge or opt out. Only the counterparty may accept — that acceptance is what opens
 * the shared Business Docs frame for both sides. Either side may raise a challenge, and challenges
 * are a running, attributed thread until consensus is reached. */
export const respondToEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionId: z.string().uuid(),
        response: z.enum(["accepted", "challenged", "opted_out"]),
        message: z.string().trim().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { side, tx, myName } = await sideOf(supabase, userId, data.transactionId);
    const state = await loadState(supabase, userId, data.transactionId);

    if (data.response === "accepted") {
      if (side !== "counterparty") {
        throw new Error("Only the counterparty can accept the engagement.");
      }
      if (!state.bothCleared) {
        throw new Error("Both sides' KYC and KYB checks have to be settled before you can accept.");
      }
    }
    if (data.response === "challenged" && !(data.message && data.message.length >= 3)) {
      throw new Error("A challenge needs a message saying what you're challenging.");
    }
    if (state.decided === "opted_out") {
      throw new Error("This engagement has already been closed by an opt-out.");
    }

    const { error } = await supabase.from("engagement_responses").insert({
      transaction_id: data.transactionId,
      responder_user_id: userId,
      responder_name: myName,
      responder_side: side,
      response: data.response,
      message: data.message ?? null,
    } as never);
    if (error) throw new Error(error.message);

    const word =
      data.response === "accepted" ? "accepted" : data.response === "challenged" ? "raised a challenge on" : "opted out of";

    await supabase.from("transaction_events").insert({
      transaction_id: data.transactionId,
      actor_id: userId,
      stage: "trading",
      step: "choice",
      action: `engagement_${data.response}`,
      summary: `${myName ?? "A party"} (${side}) ${word} the engagement`,
      payload: { side, response: data.response, message: data.message ?? null },
    });

    const ref = tx.reference ? `${tx.reference} — ` : "";
    const { notifyTransactionOwner, notifyCounterpartyContact } = await import("@/lib/bidderNotify.server");
    const title =
      data.response === "accepted"
        ? "The counterparty accepted the engagement"
        : data.response === "challenged"
          ? "A challenge was raised on the engagement"
          : "A party opted out of the engagement";
    const body = `${ref}${tx.title ?? "This deal"}: ${myName ?? "A party"} ${word} the engagement.${
      data.message ? ` “${data.message}”` : ""
    }`;

    if (side === "counterparty") {
      await notifyTransactionOwner({ orgId: tx.org_id, transactionId: tx.id, title, body });
    } else {
      const { data: cp } = await supabase
        .from("counterparties")
        .select("contact_email")
        .eq("transaction_id", tx.id)
        .eq("status", "chosen")
        .maybeSingle();
      const email = (cp as { contact_email?: string | null } | null)?.contact_email;
      if (email) await notifyCounterpartyContact({ email, transactionId: tx.id, title, body });
    }

    return loadState(supabase, userId, data.transactionId);
  });

/* ---------- dual signing ---------- */

export type SignableDoc = {
  id: string;
  name: string;
  doc_type: string;
  created_at: string;
  sha256: string | null;
  storage_path: string | null;
  requires_signature: boolean;
  fully_signed_at: string | null;
  signed_pdf_path: string | null;
  signed_pdf_name: string | null;
  signatures: { signer_name: string; signer_side: Side; signed_at: string }[];
};

export const listSignableDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await sideOf(supabase, userId, data.transactionId, { allowAdminObserver: true });

    const { data: docs, error } = await supabase
      .from("documents")
      .select("*")
      .eq("transaction_id", data.transactionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: sigs } = await supabase
      .from("document_signatures")
      .select("document_id, signer_name, signer_side, signed_at")
      .eq("transaction_id", data.transactionId);

    return (docs ?? []).map((d: any) => ({
      ...d,
      signatures: (sigs ?? [])
        .filter((s: any) => s.document_id === d.id)
        .map((s: any) => ({ signer_name: s.signer_name, signer_side: s.signer_side, signed_at: s.signed_at })),
    })) as SignableDoc[];
  });

/** Marks a shared document as one both sides must sign before it becomes part of the deal record. */
export const setDocumentNeedsSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ documentId: z.string().uuid(), transactionId: z.string().uuid(), required: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await sideOf(supabase, userId, data.transactionId);
    const { error } = await supabase
      .from("documents")
      .update({ requires_signature: data.required } as never)
      .eq("id", data.documentId)
      .eq("transaction_id", data.transactionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function wrap(text: string, max: number, size: number, font: any): string[] {
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

/** The tidy PDF record that lands in Bid Information once both sides have signed: what was signed,
 * its fingerprint, and both signatures with their UTC timestamps on one page. */
async function buildSignedRecordPdf(opts: {
  docName: string;
  docType: string;
  sha256: string | null;
  reference: string | null;
  title: string | null;
  signatures: { signer_name: string; signer_side: Side; signed_at: string }[];
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595, 842]);
  let y = 780;

  page.drawText("Signed Document Record", { x: 50, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.3) });
  y -= 14;
  page.drawText("Izenzo Trading Gateway", { x: 50, y, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
  y -= 30;

  const rows: [string, string][] = [
    ["Deal", `${opts.reference ? `${opts.reference} — ` : ""}${opts.title ?? ""}`.trim() || "—"],
    ["Document", opts.docName],
    ["Type", opts.docType],
    ["Fingerprint (SHA-256)", opts.sha256 ?? "—"],
  ];
  for (const [k, v] of rows) {
    page.drawText(k, { x: 50, y, size: 10, font: bold, color: rgb(0.2, 0.2, 0.2) });
    for (const line of wrap(v, 350, 10, font)) {
      page.drawText(line, { x: 190, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
    }
    y -= 4;
  }

  y -= 16;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 24;
  page.drawText("Signatures", { x: 50, y, size: 13, font: bold, color: rgb(0.1, 0.1, 0.3) });
  y -= 24;

  for (const sig of opts.signatures) {
    const at = new Date(sig.signed_at);
    page.drawText(sig.signer_name, { x: 50, y, size: 12, font: bold, color: rgb(0, 0, 0) });
    y -= 14;
    page.drawText(
      `${sig.signer_side === "bidder" ? "Bidder" : "Counterparty"} · signed ${at.toISOString().replace("T", " ").slice(0, 19)} UTC`,
      { x: 50, y, size: 9.5, font, color: rgb(0.35, 0.35, 0.35) },
    );
    y -= 24;
  }

  y -= 6;
  page.drawText("Status: SIGNED BY BOTH PARTIES", { x: 50, y, size: 11, font: bold, color: rgb(0.05, 0.45, 0.2) });
  y -= 20;
  for (const line of wrap(
    "Each signature above was applied inside the Izenzo Trading Gateway by an authenticated party to this deal, against this single shared record, and cannot be altered afterwards.",
    495,
    8.5,
    font,
  )) {
    page.drawText(line, { x: 50, y, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
    y -= 11;
  }

  return pdf.save();
}

/** This side's digital signature on one shared document. Once both sides have signed, a tidy PDF
 * record is produced and the document is stamped as fully signed, which is what puts it into the
 * Bid Information archive as a finished, openable record. */
export const signDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        documentId: z.string().uuid(),
        transactionId: z.string().uuid(),
        signerName: z.string().trim().min(2).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { side, tx } = await sideOf(supabase, userId, data.transactionId);

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("*")
      .eq("id", data.documentId)
      .eq("transaction_id", data.transactionId)
      .maybeSingle();
    if (docErr) throw new Error(docErr.message);
    if (!doc) throw new Error("That document is not part of this deal.");
    if ((doc as any).fully_signed_at) throw new Error("This document is already signed by both parties.");

    const { error: sigErr } = await supabase.from("document_signatures").insert({
      document_id: data.documentId,
      transaction_id: data.transactionId,
      signer_user_id: userId,
      signer_name: data.signerName,
      signer_side: side,
    } as never);
    if (sigErr) {
      throw new Error(
        sigErr.code === "23505" ? "You have already signed this document." : sigErr.message,
      );
    }

    await supabase.from("transaction_events").insert({
      transaction_id: data.transactionId,
      actor_id: userId,
      stage: "execution",
      step: "business-docs",
      action: "document_signed",
      summary: `${data.signerName} (${side}) signed ${(doc as any).name}`,
      payload: { document_id: data.documentId, side, signer_name: data.signerName },
    });

    const { data: sigs } = await supabase
      .from("document_signatures")
      .select("signer_name, signer_side, signed_at")
      .eq("document_id", data.documentId)
      .order("signed_at", { ascending: true });

    const list = (sigs ?? []) as { signer_name: string; signer_side: Side; signed_at: string }[];
    const bothSigned =
      list.some((s) => s.signer_side === "bidder") && list.some((s) => s.signer_side === "counterparty");

    if (bothSigned) {
      const bytes = await buildSignedRecordPdf({
        docName: (doc as any).name,
        docType: (doc as any).doc_type,
        sha256: (doc as any).sha256 ?? null,
        reference: tx.reference,
        title: tx.title,
        signatures: list,
      });
      const safe = String((doc as any).name).replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `deals/${data.transactionId}/signed/${Date.now()}-${safe}.pdf`;
      const pdfName = `${safe.replace(/\.[^.]+$/, "")}-SIGNED.pdf`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const signedAt = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("documents")
        .update({ fully_signed_at: signedAt, signed_pdf_path: path, signed_pdf_name: pdfName } as never)
        .eq("id", data.documentId);
      if (updErr) throw new Error(updErr.message);

      // Filed as its own record so it appears in the Bid Information archive as a finished,
      // openable PDF alongside everything else on the deal.
      await supabase.from("documents").insert({
        transaction_id: data.transactionId,
        name: pdfName,
        doc_type: "certificate",
        notes: `Signed by both parties — ${(doc as any).name}`,
        version: 1,
        sha256: (doc as any).sha256 ?? null,
        storage_path: path,
        fully_signed_at: signedAt,
      } as never);



      await supabase.from("transaction_events").insert({
        transaction_id: data.transactionId,
        actor_id: userId,
        stage: "execution",
        step: "business-docs",
        action: "document_fully_signed",
        summary: `${(doc as any).name} is signed by both parties and filed in Bid Information`,
        payload: { document_id: data.documentId, signed_pdf_path: path },
      });

      const ref = tx.reference ? `${tx.reference} — ` : "";
      const { notifyTransactionOwner, notifyCounterpartyContact } = await import("@/lib/bidderNotify.server");
      const title = `${(doc as any).name} is now signed by both parties`;
      const body = `${ref}${tx.title ?? "This deal"}: the signed record is filed in Bid Information and can be opened or downloaded.`;
      await notifyTransactionOwner({ orgId: tx.org_id, transactionId: tx.id, title, body });
      const { data: cp } = await supabase
        .from("counterparties")
        .select("contact_email")
        .eq("transaction_id", tx.id)
        .eq("status", "chosen")
        .maybeSingle();
      const email = (cp as { contact_email?: string | null } | null)?.contact_email;
      if (email) await notifyCounterpartyContact({ email, transactionId: tx.id, title, body });
    }

    return { bothSigned };
  });
