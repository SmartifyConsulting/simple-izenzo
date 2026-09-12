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
    if (!(await brightDataConfigured())) {
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

/** Runs the moment a candidate is shortlisted: if the counterparty's name matches a registered
 * platform organisation, its recorded website/contact email is copied straight over — no need to
 * go looking, it's already on file. Otherwise this does a best-effort open-web lookup (via Bright
 * Data) for the company's own website and reads its contact email/phone off that page, the same
 * way findCounterpartyContact does for a manually-supplied website — AI is told never to invent a
 * detail that isn't literally present on the page or already on file. */
export const enrichCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ counterpartyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cp, error } = await supabase
      .from("counterparties")
      .select("id, name, website, contact_email, phone")
      .eq("id", data.counterpartyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cp) throw new Error("Counterparty not found, or you don't have access to it.");
    const row = cp as unknown as {
      id: string;
      name: string;
      website: string | null;
      contact_email: string | null;
      phone: string | null;
    };
    // Already enriched — nothing to do.
    if (row.website || row.contact_email || row.phone) return { source: "already-on-file" as const };

    // 1) Already on the platform — use what's recorded on their own organisation profile.
    const { data: org } = await supabase
      .from("organisations")
      .select("website, primary_contact_email")
      .ilike("name", row.name)
      .maybeSingle();
    if (org?.website || org?.primary_contact_email) {
      const { error: upErr } = await supabase
        .from("counterparties")
        .update({ website: org.website ?? null, contact_email: org.primary_contact_email ?? null } as never)
        .eq("id", row.id);
      if (upErr) throw new Error(upErr.message);
      return { source: "platform-org" as const, website: org.website ?? null, email: org.primary_contact_email ?? null };
    }

    // 2) Not a platform org — best-effort open-web lookup, if Bright Data and AI are both
    // configured. Silent no-op rather than a hard failure if either isn't (shortlisting itself
    // must never fail because enrichment couldn't run).
    const { brightDataConfigured, fetchPageText } = await import("@/lib/brightdata.server");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!(await brightDataConfigured()) || !apiKey) return { source: "unavailable" as const };

    try {
      const searchText = await fetchPageText(
        `https://www.google.com/search?q=${encodeURIComponent(`${row.name} official website contact`)}`,
      );
      if (!searchText) return { source: "unavailable" as const };

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          messages: [
            {
              role: "system",
              content:
                "You read raw search-results page text for a company and report its most likely official " +
                "website URL. Only report a URL if you're confident it's that company's own site (not a " +
                "directory, news article or unrelated result) — otherwise say NONE. Respond with only the " +
                "URL, or the single word NONE. No other text.",
            },
            { role: "user", content: `Company: ${row.name}\n\nSearch results text:\n\n${searchText.slice(0, 6000)}` },
          ],
        }),
      });
      if (!res.ok) return { source: "unavailable" as const };
      const json = (await res.json()) as { choices: { message: { content: string } }[] };
      const url = (json.choices?.[0]?.message?.content ?? "").trim();
      if (!/^https?:\/\//.test(url)) return { source: "unavailable" as const };

      const pageText = await fetchPageText(url);
      if (!pageText) {
        await supabase.from("counterparties").update({ website: url } as never).eq("id", row.id);
        return { source: "web" as const, website: url, email: null, phone: null };
      }

      const contactRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          messages: [
            {
              role: "system",
              content:
                "You read raw web page text and report a contact email and/or phone number, if and only if " +
                "they are literally printed on the page. Never guess or construct either. Respond with exactly " +
                "two lines: `email: <address or NONE>` then `phone: <number or NONE>`. No other text.",
            },
            { role: "user", content: `Page text from ${url}:\n\n${pageText.slice(0, 12000)}` },
          ],
        }),
      });
      let email: string | null = null;
      let phone: string | null = null;
      if (contactRes.ok) {
        const contactJson = (await contactRes.json()) as { choices: { message: { content: string } }[] };
        const raw = contactJson.choices?.[0]?.message?.content ?? "";
        const emailMatch = raw.match(/email:\s*([^\s]+)/i)?.[1];
        const phoneMatch = raw.match(/phone:\s*(.+)/i)?.[1]?.trim();
        email = emailMatch && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailMatch) ? emailMatch : null;
        phone = phoneMatch && phoneMatch.toUpperCase() !== "NONE" ? phoneMatch : null;
      }

      const { error: upErr } = await supabase
        .from("counterparties")
        .update({ website: url, contact_email: email, phone } as never)
        .eq("id", row.id);
      if (upErr) throw new Error(upErr.message);
      return { source: "web" as const, website: url, email, phone };
    } catch {
      // Best-effort only — a lookup failure here should never surface as an error to the user.
      return { source: "unavailable" as const };
    }
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
