import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reads a counterparty's own public website (through Bright Data) and asks AI to report a
 * contact email — but only one that's literally printed on the page. AI is explicitly told never
 * to invent or guess an address; if the site doesn't show one, this comes back empty rather than
 * fabricating a contact. Nothing here submits anything to the counterparty's own site — it only
 * reads it. */
export const findCounterpartyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ counterpartyId: z.string().uuid(), website: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cp, error } = await supabase
      .from("counterparties")
      .select("id, name")
      .eq("id", data.counterpartyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cp) throw new Error("Counterparty not found, or you don't have access to it.");

    const { brightDataConfigured, fetchPageText } = await import("@/lib/brightdata.server");
    if (!brightDataConfigured()) {
      throw new Error("Bright Data is not connected yet. Add it under Admin → Integrations.");
    }
    const pageText = await fetchPageText(data.website);
    if (!pageText) throw new Error("Could not read that website.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this workspace.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content:
              "You read raw web page text and report a contact email address, if and only if one is " +
              "literally printed on the page. Never guess, infer, or construct an address (e.g. from a " +
              "name and domain) — if no email appears verbatim in the text, say NONE. Respond with only " +
              "the email address, or the single word NONE. No other text.",
          },
          { role: "user", content: `Page text from ${data.website}:\n\n${pageText.slice(0, 12000)}` },
        ],
      }),
    });
    if (!res.ok) throw new Error("Could not read that website's contact details just now.");
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const raw = (json.choices?.[0]?.message?.content ?? "").trim();
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null;

    const { error: upErr } = await supabase
      .from("counterparties")
      .update({ website: data.website, contact_email: email } as never)
      .eq("id", cp.id);
    if (upErr) throw new Error(upErr.message);

    return { email };
  });

/** Sends an invite email (via Resend) to a counterparty that isn't signed up on the platform yet,
 * letting them know a bidder is interested and inviting them to create an account. */
export const inviteCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ counterpartyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cpRow, error } = await supabase
      .from("counterparties")
      .select("*")
      .eq("id", data.counterpartyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cpRow) throw new Error("Counterparty not found, or you don't have access to it.");
    const cp = cpRow as unknown as {
      id: string;
      name: string;
      transaction_id: string;
      contact_email: string | null;
    };
    if (!cp.contact_email) throw new Error("No contact email on file for this counterparty yet.");

    const { data: tx } = await supabase
      .from("transactions")
      .select("title, reference")
      .eq("id", cp.transaction_id)
      .maybeSingle();

    const { loadResendCreds, sendEmail } = await import("@/lib/resend.server");
    const creds = await loadResendCreds();

    const dealName = tx?.title ?? "a trade";
    await sendEmail(creds, {
      to: cp.contact_email,
      subject: `${cp.name}, there's an interested party on Izenzo`,
      html:
        `<p>Hello,</p>` +
        `<p>A bidder on the Izenzo Trading Gateway has shortlisted <strong>${cp.name}</strong> as a potential counterparty for ${dealName}.</p>` +
        `<p>Izenzo is a trading platform with hash-sealed Proof of Intent and independent verification at every step. ` +
        `You don't have an account yet — create one to see the details and respond.</p>` +
        `<p><a href="https://izenzo.co.za/">Create your account</a></p>` +
        `<p>If you weren't expecting this, you can ignore this email.</p>`,
    });

    const { error: upErr } = await supabase
      .from("counterparties")
      .update({ invited_at: new Date().toISOString() } as never)
      .eq("id", cp.id);
    if (upErr) throw new Error(upErr.message);

    return { sent: true };
  });
