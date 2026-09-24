import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RegistrationDocumentCheck = {
  checked: boolean;
  matches: boolean;
  reason: string;
};

/** Best-effort AI read of the already-uploaded Authority to Act / Proof of Residential Address
 * document, checking whether it plausibly belongs to the person registering — their name, their
 * ID/passport number, or their email address appearing anywhere in it. Never a hard identity
 * verification (that's Didit's job, later, at the WaD gate) — just a sanity check that catches the
 * wrong file being attached (someone else's bill, an unrelated PDF) before registration is marked
 * complete. Always resolves rather than throwing: if AI isn't configured or the document can't be
 * read, `checked` comes back false and the caller treats that as "nothing to flag". */
export const verifyRegistrationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        documentType: z.enum(["authority_to_act", "proof_of_residence"]),
        storagePath: z.string().min(1),
        fileName: z.string().min(1),
        fullName: z.string().trim().min(1),
        idNumber: z.string().trim().min(1),
        email: z.string().trim().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<RegistrationDocumentCheck> => {
    try {
      const { loadOpenAiApiKey } = await import("@/lib/openai.server");
      const apiKey = await loadOpenAiApiKey();
      if (!apiKey) {
        return { checked: false, matches: true, reason: "AI isn't connected — the check was skipped." };
      }

      const bucket = data.documentType === "authority_to_act" ? "authority-to-act" : "proof-of-residence";
      const { buildDocumentParts } = await import("@/lib/documentParts.server");
      const { parts, unreadable } = await buildDocumentParts(
        context.supabase,
        [{ name: data.fileName, storage_path: data.storagePath }],
        bucket,
      );
      if (parts.length === 0) {
        return {
          checked: false,
          matches: true,
          reason: unreadable.length > 0 ? `Could not read ${data.fileName} — the check was skipped.` : "The check was skipped.",
        };
      }

      const label = data.documentType === "authority_to_act" ? "Authority to Act" : "proof of residential address";
      const { callAiChat } = await import("@/lib/aiChat.server");
      const res = await callAiChat(
        apiKey,
        {
          model: "gpt-5-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                `You check whether an uploaded ${label} document plausibly belongs to the person registering it — look for their full name, their ID/passport number, or their email address appearing anywhere in the document (a name on a lease, an account holder's name on a utility bill, an addressee, a signatory, etc.). ` +
                "Match on ANY one of the three, not all three — most documents of this kind only carry a name, never an ID number or email. A close/partial name match (different capitalisation, a middle name omitted, a common misspelling) still counts as a match. " +
                'Reply with JSON only: {"matches": boolean, "reason": string (one plain sentence, under 30 words, naming what you found or why nothing matched)}.',
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Person registering:\nName: ${data.fullName}\nID/passport number: ${data.idNumber}${data.email ? `\nEmail: ${data.email}` : ""}\n\nDoes the attached document relate to this person?`,
                },
                ...parts,
              ],
            },
          ],
        },
        { usage: { operation: "registration_document_check", transactionId: null, orgId: null } },
      );
      if (!res.ok) {
        return { checked: false, matches: true, reason: "The check could not run — please review the document yourself." };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "";
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start < 0 || end <= start) {
        return { checked: false, matches: true, reason: "The check came back unreadable — please review the document yourself." };
      }
      const parsed = JSON.parse(content.slice(start, end + 1)) as { matches?: boolean; reason?: string };
      return {
        checked: true,
        matches: parsed.matches !== false,
        reason: String(parsed.reason ?? "").slice(0, 300) || (parsed.matches === false ? "Nothing in the document matched." : "Looks like a match."),
      };
    } catch (err) {
      return { checked: false, matches: true, reason: (err as Error).message || "The check could not run." };
    }
  });
