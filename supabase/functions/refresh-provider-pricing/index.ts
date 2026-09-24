// Weekly, scheduled refresh of the pricing text shown for every provider in Admin →
// Integrations. Run by pg_cron via net.http_post (see the accompanying migration) — not called
// from the app itself. Mirrors getProviderPricing's own lazy-fetch logic in
// src/lib/integrations.functions.ts (same cache row, same "text, fetchedAt, sourceUrl" shape) so
// an admin sees the same data whether it was just refreshed by a page load or by this job.
//
// Secrets this needs (set once, then redeploy):
//   supabase secrets set INTEGRATION_ENCRYPTION_KEY=<same value the app itself uses>
//   supabase functions deploy refresh-provider-pricing
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already provided to every Edge Function
// automatically — nothing to set for those.

import { createClient } from "jsr:@supabase/supabase-js@2.115.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const PRICING_SETTINGS_KEY = "provider_pricing_cache";
// Same standard model the app's own lazy refresh uses for this — a background admin lookup never
// needs the heavier gpt-5 tier reserved for AI+ Recommendations.
const PRICING_MODELS = ["gpt-5-mini", "gpt-5"];
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

// Kept in sync by hand with src/lib/integrations.catalog.ts — an Edge Function can't import the
// app's own TypeScript modules, so the handful of fields this needs are duplicated here. Add a row
// here whenever a new provider is added to that catalogue and should get a weekly pricing check.
const PROVIDERS: { id: string; name: string; summary: string; docsUrl?: string }[] = [
  { id: "didit", name: "Didit", summary: "Hosted KYC/KYB identity and company verification.", docsUrl: "https://docs.didit.me" },
  { id: "cipc", name: "CIPC", summary: "Company registration and director verification." },
  { id: "sars_efiling", name: "SARS eFiling", summary: "Tax Compliance Status checks. Usually requires a registered practitioner profile." },
  { id: "payfast", name: "PayFast", summary: "South African card and EFT processing with ITN webhooks." },
  { id: "escrow_bank", name: "Trust / escrow account", summary: "Holds funds in trust/escrow for a deal until release conditions are met." },
  { id: "resend", name: "Resend", summary: "Transactional email for verification, trade and support notices." },
  { id: "open_exchange_rates", name: "Open Exchange Rates", summary: "Alternative exchange-rate feed." },
  { id: "firecrawl", name: "Firecrawl", summary: "Reads a live web page's content for AI grounding.", docsUrl: "https://docs.firecrawl.dev" },
  { id: "aws_s3_glacier", name: "AWS S3 / Glacier", summary: "Cold storage for long-term legal retention of evidence packs." },
  { id: "tavily", name: "Tavily", summary: "Public internet search used to find and verify counterparties.", docsUrl: "https://docs.tavily.com" },
  { id: "serpapi", name: "SerpAPI", summary: "Real Google (and other engine) search results, scraped live — a second search source alongside Tavily.", docsUrl: "https://serpapi.com/search-api" },
  { id: "openai", name: "OpenAI", summary: "Every AI search, screening, document read and recommendation in the app.", docsUrl: "https://platform.openai.com/docs" },
];

/** AES-GCM decrypt, identical scheme to src/lib/integrationCrypto.server.ts — same key-folding, same
 * `v1.<iv-base64>.<ciphertext-base64>` envelope — so this Edge Function can read the same encrypted
 * OpenAI key the app itself saved under Admin → Integrations without a second, separate secret. */
async function decryptSecrets(payload: string | null, rawKey: string): Promise<Record<string, string>> {
  if (!payload) return {};
  const [version, ivPart, cipherPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !cipherPart) return {};
  const keyBytes = new TextEncoder().encode(rawKey);
  const folded = new Uint8Array(32);
  for (let i = 0; i < keyBytes.length; i++) folded[i % 32] = (folded[i % 32]! ^ keyBytes[i]!) & 0xff;
  const aesKey = await crypto.subtle.importKey("raw", folded, { name: "AES-GCM" }, false, ["decrypt"]);
  const fromBase64 = (value: string) => {
    const bin = atob(value);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(ivPart) }, aesKey, fromBase64(cipherPart));
  return JSON.parse(new TextDecoder().decode(plain)) as Record<string, string>;
}

type WebSearchResult = { text: string; sourceUrl?: string };

async function webSearchPricing(apiKey: string, provider: { name: string; summary: string; docsUrl?: string }): Promise<WebSearchResult | null> {
  for (const model of PRICING_MODELS) {
    try {
      const res = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          instructions:
            "You find current, publicly published pricing for a named software/API provider. Reply with one or two short plain-text sentences suitable for an admin dashboard: how the provider currently charges (rate, unit, and free tier if any). No markdown, no headings, no bullet points. If current pricing can't be found, say so briefly.",
          input: `Provider: ${provider.name}. Used here for: ${provider.summary}${provider.docsUrl ? ` Docs: ${provider.docsUrl}` : ""} What does ${provider.name} currently charge, as of today?`,
          tools: [{ type: "web_search" }],
          tool_choice: "required",
          reasoning: { effort: "low" },
          max_output_tokens: 4000,
        }),
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as {
        output?: { type?: string; content?: { type?: string; text?: string; annotations?: { type?: string; url?: string }[] }[] }[];
      };
      let text = "";
      let sourceUrl: string | undefined;
      for (const item of payload.output ?? []) {
        if (item.type !== "message") continue;
        for (const part of item.content ?? []) {
          if (part.type !== "output_text") continue;
          text += part.text ?? "";
          for (const a of part.annotations ?? []) {
            if (a.type === "url_citation" && a.url && !sourceUrl) sourceUrl = a.url;
          }
        }
      }
      text = text.trim();
      if (text) return { text, sourceUrl };
    } catch {
      // Try the next model.
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  try {
    const encryptionKey = Deno.env.get("INTEGRATION_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return new Response(JSON.stringify({ error: "INTEGRATION_ENCRYPTION_KEY is not set for this function." }), { status: 500 });
    }

    const { data: openaiRow } = await sb
      .from("integration_credentials")
      .select("secrets_encrypted")
      .eq("provider", "openai")
      .maybeSingle();
    const secrets = await decryptSecrets((openaiRow?.secrets_encrypted as string | null) ?? null, encryptionKey);
    const apiKey = secrets["api_key"];
    if (!apiKey) {
      return new Response(JSON.stringify({ skipped: "No OpenAI key configured under Admin → Integrations." }), { status: 200 });
    }

    const { data: settingsRow } = await sb
      .from("admin_settings")
      .select("value")
      .eq("key", PRICING_SETTINGS_KEY)
      .maybeSingle();
    const cache: Record<string, { text: string; fetchedAt: string; sourceUrl?: string }> = {
      ...((settingsRow?.value as Record<string, { text: string; fetchedAt: string; sourceUrl?: string }> | null) ?? {}),
    };

    const results = await Promise.allSettled(
      PROVIDERS.map(async (provider) => ({ id: provider.id, result: await webSearchPricing(apiKey, provider) })),
    );

    let updated = 0;
    for (const settled of results) {
      if (settled.status !== "fulfilled" || !settled.value.result) continue;
      const { id, result } = settled.value;
      cache[id] = { text: result.text, fetchedAt: new Date().toISOString(), sourceUrl: result.sourceUrl };
      updated += 1;
    }

    if (updated > 0) {
      await sb.from("admin_settings").upsert({ key: PRICING_SETTINGS_KEY, value: cache }, { onConflict: "key" });
    }

    return new Response(JSON.stringify({ ok: true, updated, checked: PROVIDERS.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
