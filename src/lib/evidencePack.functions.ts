import { createServerFn } from "@tanstack/react-start";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function sha256Hex(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildPdf(title: string, lines: string[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;

  page.drawText(title, { x: 50, y, size: 16, font: bold, color: rgb(0.1, 0.1, 0.3) });
  y -= 30;

  for (const line of lines) {
    if (y < 60) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
    const wrapped = line.length > 95 ? line.match(/.{1,95}(\s|$)/g) ?? [line] : [line];
    for (const w of wrapped) {
      page.drawText(w.trim(), { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
      y -= 16;
    }
  }
  return doc.save();
}

const issueInput = (data: unknown) =>
  z
    .object({
      sourceType: z.enum(["compliance_case", "funder_release"]),
      id: z.string().uuid(),
      supersedesPackId: z.string().uuid().optional(),
    })
    .parse(data);

export const issueEvidencePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(issueInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let storagePath: string;
    let pdfBytes: Uint8Array;

    if (data.sourceType === "compliance_case") {
      const { data: kase, error } = await supabase
        .from("compliance_cases")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (error || !kase) throw new Error("Case not found");
      if (!["closed_approved", "closed_rejected", "closed_no_action"].includes(kase.status)) {
        throw new Error("A pack can only be issued for a closed case");
      }
      const { data: events } = await supabase
        .from("compliance_case_events")
        .select("*")
        .eq("case_id", data.id)
        .order("created_at", { ascending: true });

      const lines = [
        `Case ID: ${kase.id}`,
        `Type: ${kase.case_type}`,
        `Priority: ${kase.priority}`,
        `Status: ${kase.status}`,
        `Title: ${kase.title}`,
        `Summary: ${kase.summary}`,
        `Final decision: ${kase.final_decision ?? "n/a"}`,
        `Final decision note: ${kase.final_decision_note ?? "n/a"}`,
        `Decided by: ${kase.decided_by ?? "n/a"}`,
        `Decided at: ${kase.decided_at ?? "n/a"}`,
        `Created at: ${kase.created_at}`,
        "",
        "Audit trail:",
        ...(events ?? []).map(
          (e) => `- ${e.created_at} · ${e.event_type} · ${e.previous_status ?? ""} -> ${e.new_status ?? ""} · ${e.note ?? ""}`,
        ),
        "",
        "This pack is an internal compliance record. It is not a public statement, legal advice, or a",
        "substitute for the underlying case data.",
      ];
      pdfBytes = await buildPdf(`Compliance Case Evidence Pack — ${kase.title}`, lines);
      storagePath = `compliance/${kase.id}/${crypto.randomUUID()}.pdf`;
    } else {
      const { data: release, error } = await supabase
        .from("funder_releases")
        .select("*, counterparties(name), funder_orgs(name)")
        .eq("id", data.id)
        .maybeSingle();
      if (error || !release) throw new Error("Release not found");
      if (release.revoked_at) throw new Error("Cannot issue a pack for a revoked release");

      const fields = (release.released_fields ?? {}) as Record<string, unknown>;
      const summary = (release.compliance_summary ?? {}) as Record<string, unknown>;
      const cpName = (release as { counterparties?: { name?: string } | null }).counterparties?.name ?? "Counterparty";
      const orgName = (release as { funder_orgs?: { name?: string } | null }).funder_orgs?.name ?? "Funder";

      const lines = [
        `Release ID: ${release.id}`,
        `Funder: ${orgName}`,
        `Counterparty: ${cpName}`,
        `Pack version: ${release.pack_version}`,
        `Consent basis: ${release.consent_basis}`,
        `Reason: ${release.reason}`,
        `Expiry: ${release.expiry}`,
        "",
        "Released fields:",
        ...Object.entries(fields)
          .filter(([, v]) => v)
          .map(([k]) => `- ${k}`),
        "",
        "Compliance summary:",
        ...Object.entries(summary).map(([k, v]) => `- ${k}: ${String(v)}`),
        "",
        "This pack contains only the fields, sections and summary explicitly released by an Izenzo",
        "admin to this funder org. It is not a compliance clearance, not legal advice, and not a",
        "substitute for the funder's own approval process.",
      ];
      pdfBytes = await buildPdf(`Funder Release Evidence Pack — ${cpName}`, lines);
      storagePath = `funder/${release.funder_org_id}/${release.id}/${crypto.randomUUID()}.pdf`;
    }

    const hash = await sha256Hex(pdfBytes);

    const { error: uploadError } = await supabase.storage
      .from("evidence-packs")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: packId, error: rpcError } = await supabase.rpc("admin_issue_evidence_pack", {
      p_source_type: data.sourceType,
      p_storage_path: storagePath,
      p_sha256_hash: hash,
      ...(data.sourceType === "compliance_case" ? { p_compliance_case_id: data.id } : { p_funder_release_id: data.id }),
      ...(data.supersedesPackId ? { p_supersedes_pack_id: data.supersedesPackId } : {}),
    });
    if (rpcError) throw new Error(rpcError.message);

    return { packId, storagePath, hash };
  });

const downloadInput = (data: unknown) => z.object({ packId: z.string().uuid() }).parse(data);

export const downloadEvidencePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(downloadInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error: logError } = await supabase.rpc("log_evidence_pack_download", { p_id: data.packId });
    if (logError) throw new Error(logError.message);

    const { data: pack, error } = await supabase
      .from("evidence_packs")
      .select("storage_path")
      .eq("id", data.packId)
      .maybeSingle();
    if (error || !pack) throw new Error("Pack not found");

    const { data: signed, error: signError } = await supabase.storage
      .from("evidence-packs")
      .createSignedUrl(pack.storage_path, 300);
    if (signError || !signed) throw new Error(signError?.message ?? "Could not create a download link");

    return { url: signed.signedUrl };
  });
