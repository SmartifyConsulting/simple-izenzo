import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reads a counterparty's own public website (through Firecrawl) and asks AI to report a
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

    const { firecrawlConfigured, fetchPageText } = await import("@/lib/firecrawl.server");
    if (!(await firecrawlConfigured())) {
      throw new Error("Firecrawl is not connected yet. Add it under Admin → Integrations.");
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

    // 2) Not a platform org — best-effort open-web lookup, if Firecrawl and AI are both
    // configured. Silent no-op rather than a hard failure if either isn't (shortlisting itself
    // must never fail because enrichment couldn't run).
    const { firecrawlConfigured, fetchPageText } = await import("@/lib/firecrawl.server");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!(await firecrawlConfigured()) || !apiKey) return { source: "unavailable" as const };

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

/** Fires the moment a bidder finalizes their choice of counterparty. Three tiers, in order:
 *  1. Counterparty is a registered platform organisation, or a real email is already on file
 *     (from earlier enrichment / a literal read of their own website) — email that address
 *     directly, cc'ing the bidder.
 *  2. No real address, but a website/domain is known — AI proposes a handful of plausible
 *     addresses at that domain (info@, sales@, or a named contact's likely format if one was
 *     read off the page). These are never treated as confirmed: they go to bcc only, and the
 *     bidder becomes the visible "to" so the guesses never see each other. Nothing here invents a
 *     domain that doesn't exist — a guess only ever happens against a website that was actually
 *     found for this counterparty.
 *  3. No real address and no domain to guess against — the bidder is emailed directly instead of
 *     nothing going out at all, so they know to reach out themselves.
 */
export const notifyChosenCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ counterpartyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
      website: string | null;
      contact_email: string | null;
    };

    const { data: tx } = await supabase
      .from("transactions")
      .select("title")
      .eq("id", cp.transaction_id)
      .maybeSingle();
    const dealName = tx?.title ?? "a trade";

    const { data: bidderProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();
    const bidderEmail = bidderProfile?.email ?? null;

    let toEmail: string | null = cp.contact_email;
    let website = cp.website;
    let onPlatform = false;

    // Tier 1a: a registered platform organisation by this name — a real address, not a guess.
    if (!toEmail) {
      const { data: org } = await supabase
        .from("organisations")
        .select("website, primary_contact_email")
        .ilike("name", cp.name)
        .maybeSingle();
      if (org?.primary_contact_email) {
        toEmail = org.primary_contact_email;
        onPlatform = true;
      }
      if (!website) website = org?.website ?? null;
    }

    const { firecrawlConfigured, fetchPageText } = await import("@/lib/firecrawl.server");
    const apiKey = process.env["LOVABLE_API_KEY"];
    const canSearch = (await firecrawlConfigured()) && Boolean(apiKey);
    let pageText: string | null = null;

    // Tier 1b: no website on file at all yet — a quick best-effort search for one, the same way
    // enrichCounterparty does, so there's at least a domain to try before giving up.
    if (!toEmail && !website && canSearch) {
      try {
        const searchText = await fetchPageText(
          `https://www.google.com/search?q=${encodeURIComponent(`${cp.name} official website contact`)}`,
        );
        if (searchText) {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3.8-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "You read raw search-results page text for a company and report its most likely " +
                    "official website URL. Only report a URL if you're confident it's that company's own " +
                    "site — otherwise say NONE. Respond with only the URL, or the single word NONE.",
                },
                { role: "user", content: `Company: ${cp.name}\n\nSearch results text:\n\n${searchText.slice(0, 6000)}` },
              ],
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as { choices: { message: { content: string } }[] };
            const url = (json.choices?.[0]?.message?.content ?? "").trim();
            if (/^https?:\/\//.test(url)) website = url;
          }
        }
      } catch {
        // Best-effort only.
      }
    }

    // Tier 1c: a website is known — read it for a literal, verbatim email before ever guessing.
    if (!toEmail && website && canSearch) {
      try {
        pageText = await fetchPageText(website);
        if (pageText) {
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
                    "literally printed on the page. Never guess, infer, or construct an address. Respond " +
                    "with only the email address, or the single word NONE.",
                },
                { role: "user", content: `Page text from ${website}:\n\n${pageText.slice(0, 12000)}` },
              ],
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as { choices: { message: { content: string } }[] };
            const raw = (json.choices?.[0]?.message?.content ?? "").trim();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) toEmail = raw;
          }
        }
      } catch {
        // Best-effort only.
      }
    }

    if (toEmail || website) {
      await supabase
        .from("counterparties")
        .update({ website: website ?? undefined, contact_email: toEmail ?? undefined } as never)
        .eq("id", cp.id);
    }

    // Tier 2: still no confirmed address, but there's a domain to try — ask AI to propose a
    // handful of plausible formats. These are guesses, never treated as confirmed, and only ever
    // go into bcc.
    let guessedEmails: string[] = [];
    if (!toEmail && website && apiKey) {
      try {
        const domain = new URL(website).hostname.replace(/^www\./, "");
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.8-flash",
            messages: [
              {
                role: "system",
                content:
                  "You propose plausible email addresses at a given company domain, following common " +
                  "corporate conventions (info@, sales@, contact@, trade@) and, only if the page text " +
                  "names a specific person to contact, a firstname.lastname@ guess for them too. These " +
                  "are guesses, not confirmed addresses — never claim certainty. Return 2 to 4 addresses, " +
                  "one per line, nothing else. No prose, no numbering.",
              },
              {
                role: "user",
                content: `Domain: ${domain}\nCompany: ${cp.name}${
                  pageText ? `\n\nPage text (for a named contact, if any):\n\n${pageText.slice(0, 4000)}` : ""
                }`,
              },
            ],
          }),
        });
        if (res.status === 402) {
          const { alertLowFunds } = await import("@/lib/opsAlerts.server");
          void alertLowFunds("AI Gateway", 402);
        } else if (res.ok) {
          const json = (await res.json()) as { choices: { message: { content: string } }[] };
          const raw = json.choices?.[0]?.message?.content ?? "";
          guessedEmails = raw
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l) && l.toLowerCase().endsWith(`@${domain}`))
            .slice(0, 4);
        }
      } catch {
        // Best-effort only — a guessing failure should never block recording the choice.
      }
    }

    const { loadResendCreds, sendEmail, renderBrandedEmail } = await import("@/lib/resend.server");
    let creds;
    try {
      creds = await loadResendCreds();
    } catch {
      return { sent: false, reason: "email-not-connected" as const };
    }

    if (toEmail) {
      // Tier 1: a real, confirmed address — send it there directly, cc the bidder.
      await sendEmail(creds, {
        to: toEmail,
        ...(bidderEmail ? { cc: [bidderEmail] } : {}),
        subject: `${cp.name}, there's an interested party on Izenzo`,
        html: renderBrandedEmail(
          `<p>Hello,</p>` +
            `<p>A bidder on the Izenzo Trading Gateway has chosen <strong>${cp.name}</strong> as the ` +
            `counterparty for ${dealName}.</p>` +
            (onPlatform
              ? `<p>Sign in to your Izenzo account to see the details and respond.</p>`
              : `<p>Izenzo is a trading platform with hash-sealed Proof of Intent and independent ` +
                `verification at every step. You don't have an account yet — create one to see the ` +
                `details and respond.</p><p><a href="https://izenzo.co.za/">Create your account</a></p>`) +
            `<p>If you weren't expecting this, you can ignore this email.</p>`,
        ),
      });
      await supabase
        .from("counterparties")
        .update({ invited_at: new Date().toISOString() } as never)
        .eq("id", cp.id);
      return { sent: true, method: onPlatform ? ("platform" as const) : ("web" as const), to: toEmail };
    }

    if (!bidderEmail) return { sent: false, reason: "no-contact-and-no-bidder-email" as const };

    if (guessedEmails.length > 0) {
      // Tier 2: no confirmed address — bidder is the visible recipient, guesses are bcc'd so they
      // never see each other.
      await sendEmail(creds, {
        to: bidderEmail,
        bcc: guessedEmails,
        subject: `Reaching out to ${cp.name} on your behalf`,
        html: renderBrandedEmail(
          `<p>Hello,</p>` +
            `<p>We couldn't confirm a published contact address for <strong>${cp.name}</strong>, so — to ` +
            `give this the best chance of reaching them — we've sent a best-effort outreach for ` +
            `${dealName} to ${guessedEmails.length} likely address${guessedEmails.length === 1 ? "" : "es"} ` +
            `at their domain, blind copied on this message so you can see exactly what went out.</p>` +
            `<p>These are educated guesses, not confirmed contacts — delivery isn't guaranteed, so it's ` +
            `worth following up directly if you know another way to reach them.</p>`,
        ),
      });
      return { sent: true, method: "guessed" as const, guessed: guessedEmails };
    }

    // Tier 3: nothing at all to go on — the bidder is told rather than silence.
    await sendEmail(creds, {
      to: bidderEmail,
      subject: `We couldn't find contact details for ${cp.name}`,
      html: renderBrandedEmail(
        `<p>Hello,</p>` +
          `<p>You've chosen <strong>${cp.name}</strong> as the counterparty for ${dealName}, but we ` +
          `couldn't find a registered account, a website, or a published contact address for them.</p>` +
          `<p>You'll need to reach out to them directly through another channel.</p>`,
      ),
    });
    return { sent: true, method: "bidder-only" as const };
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

    const { loadResendCreds, sendEmail, renderBrandedEmail } = await import("@/lib/resend.server");
    const creds = await loadResendCreds();

    const dealName = tx?.title ?? "a trade";
    await sendEmail(creds, {
      to: cp.contact_email,
      subject: `${cp.name}, there's an interested party on Izenzo`,
      html: renderBrandedEmail(
        `<p>Hello,</p>` +
        `<p>A bidder on the Izenzo Trading Gateway has shortlisted <strong>${cp.name}</strong> as a potential counterparty for ${dealName}.</p>` +
        `<p>Izenzo is a trading platform with hash-sealed Proof of Intent and independent verification at every step. ` +
        `You don't have an account yet — create one to see the details and respond.</p>` +
        `<p><a href="https://izenzo.co.za/">Create your account</a></p>` +
        `<p>If you weren't expecting this, you can ignore this email.</p>`,
      ),
    });

    const { error: upErr } = await supabase
      .from("counterparties")
      .update({ invited_at: new Date().toISOString() } as never)
      .eq("id", cp.id);
    if (upErr) throw new Error(upErr.message);

    return { sent: true };
  });
