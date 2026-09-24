import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nameKey } from "@/lib/dedupeOrgs";
import { ADMIN_EMAIL } from "@/lib/bidderNotify.server";

const CONTACT_MODELS = ["gpt-5-mini", "gpt-5"];

type AuthedClient = { from: (t: string) => any };

/** Finds a registered platform organisation by name, ignoring case, punctuation and the company
 * suffix (Ltd, Pty, Inc, Group…) that make two spellings of the same company look different —
 * the same normalisation the org-dedupe logic already uses. A raw exact match here meant a real
 * registered organisation like "SeedAxis (Pty) Ltd" was never found for a counterparty AI had
 * named just "SeedAxis": the platform lookup was skipped entirely and it fell through to a web
 * search for a company that didn't need one. Narrows the query with a wildcard on the name's
 * first significant word (cheap, indexable) then confirms the match with the exact normalised
 * key so an unrelated company sharing that first word is never picked up. */
export async function findRegisteredOrg(
  supabase: AuthedClient,
  name: string,
): Promise<{ website: string | null; primary_contact_email: string | null } | null> {
  const key = nameKey(name);
  const firstWord = key.split(" ")[0];
  if (!firstWord) return null;
  const { data } = await supabase
    .from("organisations")
    .select("name, website, primary_contact_email")
    .ilike("name", `%${firstWord}%`)
    .limit(25);
  const rows = (data ?? []) as { name: string; website: string | null; primary_contact_email: string | null }[];
  const match = rows.find((o) => nameKey(o.name) === key);
  return match ? { website: match.website, primary_contact_email: match.primary_contact_email } : null;
}

type DealFields = {
  title: string | null;
  reference: string | null;
  commodity: string | null;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  currency: string | null;
  incoterms: string | null;
  jurisdiction: string | null;
} | null;

const GENERIC_TITLES = new Set(["new bid", "new offer"]);

/** A short, honest snapshot of the deal — reference, requirement summary, commodity, quantity,
 * price, Incoterms, jurisdiction — so the first email a counterparty ever gets from Izenzo actually
 * says what's on offer, not just that "someone is interested". A field the bidder hasn't recorded
 * yet is left out rather than shown as a blank or a zero. `referenceUrl`, when given, makes the
 * reference row a link straight into the deal instead of plain text. */
function dealSnapshotHtml(tx: DealFields, referenceUrl?: string): string {
  if (!tx) return "";
  const rows: [string, string][] = [];
  if (tx.reference) {
    rows.push([
      "Reference",
      referenceUrl ? `<a href="${referenceUrl}" style="color:#0d9488;">${tx.reference}</a>` : tx.reference,
    ]);
  }
  if (tx.title && !GENERIC_TITLES.has(tx.title.trim().toLowerCase())) rows.push(["Requirement", tx.title]);
  if (tx.commodity) rows.push(["Commodity", tx.commodity]);
  if (Number(tx.quantity) > 0) rows.push(["Quantity", `${tx.quantity} ${tx.unit ?? ""}`.trim()]);
  if (Number(tx.price) > 0) rows.push(["Price", `${tx.currency ?? ""} ${tx.price}`.trim()]);
  if (tx.incoterms) rows.push(["Incoterms", tx.incoterms]);
  if (tx.jurisdiction) rows.push(["Jurisdiction", tx.jurisdiction]);
  if (rows.length === 0) return "";
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-collapse:collapse;">` +
    rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:4px 0;color:#6b7280;font-size:12px;width:110px;vertical-align:top;">${label}</td>` +
          `<td style="padding:4px 0;color:#111827;font-size:13px;font-weight:600;">${value}</td></tr>`,
      )
      .join("") +
    `</table>`
  );
}

/** A single, brand-styled call-to-action link, so the first email a counterparty gets from
 * Izenzo reads like an invitation to a real platform rather than a plain text link. */
function ctaButtonHtml(url: string, label: string): string {
  return (
    `<p style="margin:20px 0;">` +
    `<a href="${url}" style="display:inline-block;background:#14b8a6;color:#0d0f14;font-weight:700;` +
    `font-size:14px;padding:11px 22px;border-radius:9999px;text-decoration:none;">${label}</a>` +
    `</p>`
  );
}

/** The account CTA for outreach emails: one button, both paths. The destination page itself
 * (behind an authenticated route) already sends a signed-out visitor to sign in and bounces them
 * back afterwards, and the same sign-in screen offers creating an account instead — so a single
 * link genuinely serves both an existing user and a brand-new one. The line under the button says
 * so explicitly, since the recipient can't see that redirect happen before they click. */
function accountCtaHtml(url: string): string {
  return (
    ctaButtonHtml(url, "View this opportunity") +
    `<p style="margin:-12px 0 20px;color:#6b7280;font-size:12px;">Already have an Izenzo account? The button ` +
    `above takes you straight to sign in. New here? You can create a free account in a couple of minutes — ` +
    `either way, you'll land on this opportunity next.</p>`
  );
}

/** Finds a company's own official website through the same public-search stack the rest of the
 * app uses for counterparty search — Tavily when an admin has configured it, OpenAI's own web
 * search otherwise. Never invents a domain; NONE (from either source) means none was confirmed. */
async function findOfficialWebsite(
  name: string,
  apiKey: string,
  tavilyKey: string | null,
  usage?: { transactionId?: string | null | undefined; orgId?: string | null | undefined },
): Promise<string | null> {
  try {
    if (tavilyKey) {
      const { tavilySearch } = await import("@/lib/tavily.server");
      const results = await tavilySearch(tavilyKey, `${name} official website`, {
        max: 5,
        timeoutMs: 20_000,
        usage: usage && { operation: "enrich_website_tavily", ...usage },
      });
      if (results.length === 0) return null;
      const { callAiChat } = await import("@/lib/aiChat.server");
      const res = await callAiChat(
        apiKey,
        {
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content:
                "You are given public search results for a company and report its own official website " +
                "URL — never a directory, marketplace listing, news article, social profile or unrelated " +
                "result, and only a URL that actually appears in the results below. Respond with only the " +
                "URL, or the single word NONE.",
            },
            {
              role: "user",
              content: `Company: ${name}\n\nResults:\n${results
                .map((r) => `${r.url}\n${r.title}\n${r.content}`)
                .join("\n\n")}`,
            },
          ],
        },
        { usage: usage && { operation: "enrich_website_judge", ...usage } },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const url = (json.choices?.[0]?.message?.content ?? "").trim();
      return /^https?:\/\//.test(url) ? url : null;
    }

    const { webSearch } = await import("@/lib/openaiWebSearch.server");
    const r = await webSearch({
      apiKey,
      instructions:
        "Find the company's own official website through web search. Reply with only its URL, or the " +
        "single word NONE if you can't confirm one — never a directory, marketplace, news or social result.",
      input: `Company: ${name}`,
      models: CONTACT_MODELS,
      usage: usage && { operation: "enrich_website_web", ...usage },
    });
    const url = r.text.trim();
    return /^https?:\/\//.test(url) ? url : null;
  } catch {
    // Best-effort only — a lookup failure here must never surface as an error to the caller.
    return null;
  }
}

/** Reads a known website — through Tavily's own extracted page text when configured, OpenAI's web
 * search otherwise — for a contact email and/or phone number literally published on it. Never
 * guesses or constructs either; NONE means nothing was found, not that nothing exists. */
async function readContactFromSite(
  name: string,
  website: string,
  apiKey: string,
  tavilyKey: string | null,
  usage?: { transactionId?: string | null | undefined; orgId?: string | null | undefined },
): Promise<{ email: string | null; phone: string | null }> {
  try {
    let pageText = "";
    if (tavilyKey) {
      const domain = new URL(website).hostname.replace(/^www\./, "");
      const { tavilySearch } = await import("@/lib/tavily.server");
      const results = await tavilySearch(tavilyKey, "contact email phone", {
        includeDomains: [domain],
        max: 5,
        timeoutMs: 20_000,
        usage: usage && { operation: "enrich_contact_tavily", ...usage },
      });
      pageText = results.map((r) => `${r.url}\n${r.content}`).join("\n\n");
    }
    if (!pageText.trim()) {
      const { webSearch } = await import("@/lib/openaiWebSearch.server");
      const r = await webSearch({
        apiKey,
        instructions:
          "You read a company's own official website through web search and report a contact email " +
          "and/or phone number, if and only if one is literally published on their own site. Never guess, " +
          "infer or construct either.",
        input: `Company: ${name}\nWebsite: ${website}`,
        models: CONTACT_MODELS,
        usage: usage && { operation: "enrich_contact_web", ...usage },
      });
      pageText = r.text;
    }
    if (!pageText.trim()) return { email: null, phone: null };

    const { callAiChat } = await import("@/lib/aiChat.server");
    const res = await callAiChat(
      apiKey,
      {
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "You read text gathered from a company's own website and report a contact email and/or " +
              "phone number, if and only if literally present in the text. Never guess or construct " +
              "either. Respond with exactly two lines: `email: <address or NONE>` then `phone: <number or " +
              "NONE>`. No other text.",
          },
          { role: "user", content: pageText.slice(0, 12000) },
        ],
      },
      { usage: usage && { operation: "enrich_contact_judge", ...usage } },
    );
    if (!res.ok) return { email: null, phone: null };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const emailMatch = raw.match(/email:\s*([^\s]+)/i)?.[1];
    const phoneMatch = raw.match(/phone:\s*(.+)/i)?.[1]?.trim();
    const email = emailMatch && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailMatch) ? emailMatch : null;
    const phone = phoneMatch && phoneMatch.toUpperCase() !== "NONE" ? phoneMatch : null;
    return { email, phone };
  } catch {
    return { email: null, phone: null };
  }
}

/** Reads a counterparty's own public website for a contact email — but only one that's literally
 * printed on the page. Never invents or guesses an address; comes back null rather than
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
      .select("id, name, transaction_id")
      .eq("id", data.counterpartyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cp) throw new Error("Counterparty not found, or you don't have access to it.");

    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (!apiKey) throw new Error("AI is not configured for this workspace.");
    const { loadTavilyApiKey } = await import("@/lib/tavily.server");
    const tavilyKey = await loadTavilyApiKey();

    const { email } = await readContactFromSite(cp.name, data.website, apiKey, tavilyKey, {
      transactionId: cp.transaction_id,
    });

    const { error: upErr } = await supabase
      .from("counterparties")
      .update({ website: data.website, contact_email: email } as never)
      .eq("id", cp.id);
    if (upErr) throw new Error(upErr.message);

    return { email };
  });

/** Runs the moment a candidate is shortlisted: if the counterparty's name matches a registered
 * platform organisation, its recorded website/contact email is copied straight over — no need to
 * go looking, it's already on file. Otherwise this does a best-effort public-search lookup for
 * the company's own website and reads its contact email/phone off that, the same way
 * findCounterpartyContact does for a manually-supplied website — AI is told never to invent a
 * detail that isn't literally present on the page or already on file. */
export const enrichCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ counterpartyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cp, error } = await supabase
      .from("counterparties")
      .select("id, name, transaction_id, website, contact_email, phone")
      .eq("id", data.counterpartyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cp) throw new Error("Counterparty not found, or you don't have access to it.");
    const row = cp as unknown as {
      id: string;
      name: string;
      transaction_id: string;
      website: string | null;
      contact_email: string | null;
      phone: string | null;
    };
    // Already enriched — nothing to do.
    if (row.website || row.contact_email || row.phone) return { source: "already-on-file" as const };

    // 1) Already on the platform — use what's recorded on their own organisation profile.
    const org = await findRegisteredOrg(supabase, row.name);
    if (org?.website || org?.primary_contact_email) {
      const { error: upErr } = await supabase
        .from("counterparties")
        .update({ website: org.website ?? null, contact_email: org.primary_contact_email ?? null } as never)
        .eq("id", row.id);
      if (upErr) throw new Error(upErr.message);
      // A registered platform account is the one thing today that stands in for "verified" — a
      // real, known account rather than an unconfirmed web claim. Notify the bidder (and Admin).
      try {
        const { data: tx } = await supabase
          .from("transactions")
          .select("org_id, title, reference")
          .eq("id", row.transaction_id)
          .maybeSingle();
        if (tx?.org_id) {
          const { notifyBidder } = await import("@/lib/bidderNotify.server");
          await notifyBidder({
            orgId: tx.org_id,
            transactionId: row.transaction_id,
            title: `${row.name} is a verified Izenzo account`,
            body: `${tx.reference ? `${tx.reference} — ` : ""}${tx.title ?? "Your deal"}: ${row.name} matched a registered organisation already on Izenzo.`,
            kind: "counterparty_verified",
          });
        }
      } catch {
        // Notification only — never blocks enrichment itself.
      }
      return { source: "platform-org" as const, website: org.website ?? null, email: org.primary_contact_email ?? null };
    }

    // 2) Not a platform org — best-effort public-search lookup. Silent no-op rather than a hard
    // failure if AI isn't configured (shortlisting itself must never fail because enrichment
    // couldn't run).
    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    if (!apiKey) return { source: "unavailable" as const };
    const { loadTavilyApiKey } = await import("@/lib/tavily.server");
    const tavilyKey = await loadTavilyApiKey();

    const enrichUsage = { transactionId: row.transaction_id };
    const website = await findOfficialWebsite(row.name, apiKey, tavilyKey, enrichUsage);
    if (!website) return { source: "unavailable" as const };

    const { email, phone } = await readContactFromSite(row.name, website, apiKey, tavilyKey, enrichUsage);
    const { error: upErr } = await supabase
      .from("counterparties")
      .update({ website, contact_email: email, phone } as never)
      .eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
    return { source: "web" as const, website, email, phone };
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
      .select("title, reference, org_id, commodity, quantity, unit, price, currency, incoterms, jurisdiction")
      .eq("id", cp.transaction_id)
      .maybeSingle();
    const dealName = tx?.title ?? "a trade";
    const claimUrl = `https://api.trade.izenzo.co.za/counterparty/claim?cp=${cp.id}`;
    const dealDetailsHtml = dealSnapshotHtml(tx, claimUrl);

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
      const org = await findRegisteredOrg(supabase, cp.name);
      if (org?.primary_contact_email) {
        toEmail = org.primary_contact_email;
        onPlatform = true;
      }
      if (!website) website = org?.website ?? null;
    }

    const { loadOpenAiApiKey } = await import("@/lib/openai.server");
    const apiKey = await loadOpenAiApiKey();
    const { loadTavilyApiKey } = await import("@/lib/tavily.server");
    const tavilyKey = apiKey ? await loadTavilyApiKey() : null;
    const canSearch = Boolean(apiKey);

    // Tier 1b: no website on file at all yet — a quick best-effort search for one, the same way
    // enrichCounterparty does, so there's at least a domain to try before giving up.
    if (!toEmail && !website && canSearch) {
      website = await findOfficialWebsite(cp.name, apiKey!, tavilyKey, { transactionId: cp.transaction_id });
    }

    // Tier 1c: a website is known — read it for a literal, verbatim email before ever guessing.
    if (!toEmail && website && canSearch) {
      const { email } = await readContactFromSite(cp.name, website, apiKey!, tavilyKey, { transactionId: cp.transaction_id });
      if (email) toEmail = email;
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
        const { callAiChat } = await import("@/lib/aiChat.server");
        const res = await callAiChat(
          apiKey,
          {
            model: "gpt-5-mini",
            messages: [
              {
                role: "system",
                content:
                  "You propose plausible email addresses at a given company domain, following common " +
                  "corporate conventions (info@, sales@, contact@, trade@). These are guesses, not " +
                  "confirmed addresses — never claim certainty. Return 2 to 4 addresses, one per line, " +
                  "nothing else. No prose, no numbering.",
              },
              { role: "user", content: `Domain: ${domain}\nCompany: ${cp.name}` },
            ],
          },
          { usage: { operation: "outreach_email_guess", transactionId: cp.transaction_id } },
        );
        if (res.status === 402) {
          const { alertLowFunds } = await import("@/lib/opsAlerts.server");
          void alertLowFunds("OpenAI", 402);
        } else if (res.ok) {
          const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
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
      // Tier 1: a real, confirmed address — send it there directly, cc the bidder. The link goes
      // straight to the claim page: signing in (or creating an account, if they don't have one
      // yet) links their organisation to this specific deal and opens the same workspace,
      // restricted to their view of it.
      await sendEmail(creds, {
        to: toEmail,
        ...(bidderEmail ? { cc: [bidderEmail] } : {}),
        usage: { operation: "outreach_email", transactionId: cp.transaction_id },
        subject: `${cp.name}, you've been matched to a live opportunity on Izenzo`,
        html: renderBrandedEmail(
          `<p>Hello,</p>` +
            `<p>Good news — a verified party on the Izenzo Trading Gateway has selected <strong>${cp.name}</strong> ` +
            `as a potential counterparty for the opportunity below. The reference above links straight to it ` +
            `once you're signed in.</p>` +
            dealDetailsHtml +
            `<p>Izenzo is a governed trading platform: every match carries a hash-sealed Proof of Intent ` +
            `and independent verification at every step, so both sides can move with confidence.</p>` +
            accountCtaHtml(claimUrl) +
            `<p>Regards,<br>Izenzo</p>`,
        ),
      });
      await supabase
        .from("counterparties")
        .update({ invited_at: new Date().toISOString() } as never)
        .eq("id", cp.id);
      // The counterparty side gets the same news in the app, not only by email — an account that
      // exists for this contact address sees it in their Inbox when they sign in.
      const { notifyCounterpartyContact } = await import("@/lib/bidderNotify.server");
      await notifyCounterpartyContact({
        email: toEmail,
        transactionId: cp.transaction_id,
        title: `${tx?.reference ? `${tx.reference} — ` : ""}you've been matched to a live opportunity`,
        body: `${cp.name} has been selected as a potential counterparty for ${dealName}. Open the deal to see the full details and respond.`,
      });
      if (tx?.org_id) {
        const { notifyBidder } = await import("@/lib/bidderNotify.server");
        void notifyBidder({
          orgId: tx.org_id,
          transactionId: cp.transaction_id,
          title: `${cp.name} has been emailed`,
          body: `${tx.reference ? `${tx.reference} — ` : ""}${dealName}: ${cp.name} was emailed about this deal.`,
          kind: "counterparty_emailed",
        });
      }
      return { sent: true, method: onPlatform ? ("platform" as const) : ("web" as const), to: toEmail };
    }

    if (!bidderEmail) return { sent: false, reason: "no-contact-and-no-bidder-email" as const };

    if (guessedEmails.length > 0) {
      // Tier 2: no confirmed address — bidder is the visible recipient, guesses are bcc'd so they
      // never see each other. Admin is bcc'd too, and every address tried is written into the
      // email body (not just a count) and onto the deal's own event log — the bidder and admin
      // team both need to know exactly which addresses were guessed, since none of them is
      // confirmed to be real and any of them could be why the counterparty never actually
      // received anything.
      const guessedList = guessedEmails.map((e) => `<li style="font-family:monospace;">${e}</li>`).join("");
      await sendEmail(creds, {
        to: bidderEmail,
        bcc: [...guessedEmails, ADMIN_EMAIL],
        usage: { operation: "outreach_email_guessed", transactionId: cp.transaction_id },
        subject: `Reaching out to ${cp.name} on your behalf`,
        html: renderBrandedEmail(
          `<p>Hello,</p>` +
            `<p>We couldn't confirm a published contact address for <strong>${cp.name}</strong>, so — to ` +
            `give this the best chance of reaching them — we've sent a best-effort outreach for ` +
            `${dealName} to the following likely address${guessedEmails.length === 1 ? "" : "es"} ` +
            `at their domain, blind copied on this message so you can see exactly what went out:</p>` +
            `<ul style="margin:8px 0;padding-left:20px;">${guessedList}</ul>` +
            `<p>These are educated guesses, not confirmed contacts — delivery isn't guaranteed (one or more may ` +
            `bounce or simply go unread), so it's worth following up directly if you know another way to reach ` +
            `them.</p>`,
        ),
      });
      await supabase.from("transaction_events").insert({
        transaction_id: cp.transaction_id,
        actor_id: userId,
        stage: "trading",
        step: "choice",
        action: "counterparty_email_guessed",
        summary: `No confirmed address for ${cp.name} — guessed ${guessedEmails.length} address${guessedEmails.length === 1 ? "" : "es"} at their domain`,
        payload: { counterpartyId: cp.id, guessed: guessedEmails },
      } as never);
      return { sent: true, method: "guessed" as const, guessed: guessedEmails };
    }

    // Tier 3: nothing at all to go on — the bidder is told rather than silence, and it's on the
    // deal's own record too so it isn't just a one-off email easy to lose track of.
    await sendEmail(creds, {
      to: bidderEmail,
      bcc: [ADMIN_EMAIL],
      usage: { operation: "outreach_email_not_found", transactionId: cp.transaction_id },
      subject: `We couldn't find contact details for ${cp.name}`,
      html: renderBrandedEmail(
        `<p>Hello,</p>` +
          `<p>You've chosen <strong>${cp.name}</strong> as the counterparty for ${dealName}, but we ` +
          `couldn't find a registered account, a website, or a published contact address for them — no email ` +
          `has gone out to them at all.</p>` +
          `<p>You'll need to reach out to them directly through another channel.</p>`,
      ),
    });
    await supabase.from("transaction_events").insert({
      transaction_id: cp.transaction_id,
      actor_id: userId,
      stage: "trading",
      step: "choice",
      action: "counterparty_email_not_found",
      summary: `No registered account, website or contact address found for ${cp.name} — nothing was emailed to them`,
      payload: { counterpartyId: cp.id },
    } as never);
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
      .select("title, reference, commodity, quantity, unit, price, currency, incoterms, jurisdiction")
      .eq("id", cp.transaction_id)
      .maybeSingle();

    const { loadResendCreds, sendEmail, renderBrandedEmail } = await import("@/lib/resend.server");
    const creds = await loadResendCreds();

    await sendEmail(creds, {
      to: cp.contact_email,
      usage: { operation: "invite_email", transactionId: cp.transaction_id },
      subject: `${cp.name}, you're shortlisted for a live opportunity on Izenzo`,
      html: renderBrandedEmail(
        `<p>Hello,</p>` +
        `<p>Good news — a verified party on the Izenzo Trading Gateway has shortlisted <strong>${cp.name}</strong> ` +
        `as a potential counterparty for the opportunity below.</p>` +
        dealSnapshotHtml(tx) +
        `<p>Izenzo is a governed trading platform: every match carries a hash-sealed Proof of Intent and ` +
        `independent verification at every step, so both sides can move with confidence.</p>` +
        accountCtaHtml("https://api.trade.izenzo.co.za/") +
        `<p>Regards,<br>Izenzo</p>`,
      ),
    });

    const { error: upErr } = await supabase
      .from("counterparties")
      .update({ invited_at: new Date().toISOString() } as never)
      .eq("id", cp.id);
    if (upErr) throw new Error(upErr.message);

    return { sent: true };
  });
