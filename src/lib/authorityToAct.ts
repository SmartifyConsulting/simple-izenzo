import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/auth";

/** Files a copy of the signed-in user's Authority to Act onto a bid/offer, so the counterparty side
 * can see who is acting without it being attached by hand each time. Only called once the user has
 * attached a document of their own — a bid started from a typed description alone must not gain
 * a file the user never added. A copy, not a reference: the private `authority-to-act` bucket is
 * scoped to the profile's own folder, but a deal's documents must be readable by whoever the deal
 * is shared with, so the file is re-hosted under the deal's own storage. Skipped when this deal
 * already carries one. */
export async function fileAuthorityToAct(transactionId: string, profile: Profile | null) {
  if (!profile?.authority_to_act_path) return;
  try {
    const { data: existing } = await supabase
      .from("documents")
      .select("id")
      .eq("transaction_id", transactionId)
      .eq("doc_type", "authority-to-act")
      .limit(1);
    if (existing && existing.length > 0) return;

    const { data: blob, error: dlErr } = await supabase.storage
      .from("authority-to-act")
      .download(profile.authority_to_act_path);
    if (dlErr || !blob) return;
    const ext = profile.authority_to_act_path.split(".").pop() ?? "pdf";
    const path = `deals/${transactionId}/${Date.now()}-authority-to-act.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, blob, { contentType: blob.type || "application/octet-stream" });
    if (upErr) return;
    await supabase.from("documents").insert({
      transaction_id: transactionId,
      name: profile.authority_to_act_name ?? "Authority to Act",
      doc_type: "authority-to-act",
      notes: "Authority to Act",
      storage_path: path,
    } as never);
  } catch {
    // Best-effort only — a bid/offer must still be recorded even if this copy fails.
  }
}
