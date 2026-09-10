import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reads every document attached to a bid/offer (ID front/back, plus any other documents),
 * asks the AI to extract the deal's details and write a detailed summary, and saves that summary
 * onto the transaction — associated with whichever side (bidder or responder) recorded it. Runs
 * right after documents are uploaded, since the Submit a Bid/Offer form no longer collects the
 * commodity/quantity/price itself. */
export const summarizeBidDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, title")
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

    // Short-lived signed links so the AI gateway can read the private files directly, rather than
    // this server reading and re-encoding every page itself.
    const attachments: { kind: string; name: string; url: string }[] = [];
    for (const d of docs) {
      if (!d.storage_path) continue;
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(d.storage_path, 300);
      if (signed?.signedUrl) {
        attachments.push({ kind: (d.notes as string | null) ?? "Document", name: d.name, url: signed.signedUrl });
      }
    }
    if (attachments.length === 0) throw new Error("Could not open the uploaded documents.");

    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      {
        type: "text",
        text:
          "These are the ID and supporting documents attached to a trade bid/offer. Read them and extract:\n" +
          "- the commodity or asset being traded\n" +
          "- quantity and unit, if stated\n" +
          "- price and currency, if stated\n" +
          "- delivery/incoterms or timing, if stated\n" +
          "- the bidder's identity as shown on the ID document(s)\n" +
          "Then write a detailed plain-prose summary (4-8 sentences) covering all of the above. " +
          "Only state what the documents actually show — never invent figures or terms that aren't there; " +
          "say plainly when something isn't stated.",
      },
      ...attachments.map((a) => ({ type: "image_url" as const, image_url: { url: a.url } })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content:
              "You read trade documents (IDs, contracts, invoices, spec sheets) and extract deal details " +
              "precisely. Plain prose, no headings, no bullet points, no markdown.",
          },
          { role: "user", content },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI is busy right now. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    if (!res.ok) throw new Error("The documents could not be read just now.");
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const summary = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!summary) throw new Error("The document summary came back empty.");

    const { error: upErr } = await supabase
      .from("transactions")
      .update({
        document_summary: summary,
        document_summary_generated_at: new Date().toISOString(),
      } as never)
      .eq("id", tx.id);
    const missingColumn =
      upErr?.code === "42703" || upErr?.code === "PGRST204" || Boolean(upErr?.message?.includes("schema cache"));
    if (upErr && !missingColumn) throw new Error(upErr.message);

    return { summary };
  });
