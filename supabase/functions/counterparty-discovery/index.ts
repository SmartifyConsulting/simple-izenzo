// Live AI web discovery for the "Discover Counterparties" screen (src/routes/_authenticated.discover.tsx).
// Two modes:
//   { query, role }          — search mode (default): web search via Bright Data's SERP API
//                               (BRIGHTDATA_API_KEY), returns candidate companies.
//   { mode: "scrape", url }  — scrape mode: fetches a candidate's own website so the caller can
//                               check what they actually sell. Prefers Bright Data's Browser API
//                               (BRIGHTDATA_BROWSER_URL — a full remote headless browser, handles
//                               JS-rendered sites) when configured; falls back to the simpler Web
//                               Unlocker HTTP fetch (BRIGHTDATA_API_KEY) otherwise.
//
// Set the secrets that apply, then redeploy:
//   supabase secrets set BRIGHTDATA_API_KEY=<token>
//   supabase secrets set BRIGHTDATA_BROWSER_URL=<wss://user:pass@host from Bright Data's Browser API>
//   supabase functions deploy counterparty-discovery
// Without BRIGHTDATA_API_KEY, search mode returns no web results (registry results still show).
// Without either secret, scrape mode returns no page text (the product-match badge is skipped).

import { createClient } from "jsr:@supabase/supabase-js@2.115.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRIGHTDATA_API_KEY = Deno.env.get("BRIGHTDATA_API_KEY");
const BRIGHTDATA_SERP_ZONE = Deno.env.get("BRIGHTDATA_SERP_ZONE") ?? "serp_api1";
const BRIGHTDATA_UNLOCKER_ZONE = Deno.env.get("BRIGHTDATA_UNLOCKER_ZONE") ?? "unlocker_api1";
// Full wss://user:pass@host endpoint from Bright Data's Browser API (Scraping Browser) product —
// distinct from the SERP/Unlocker key above. Never logged; only ever read into the connect call.
const BRIGHTDATA_BROWSER_URL = Deno.env.get("BRIGHTDATA_BROWSER_URL");

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Result = { id: string; name: string; detail: string; source: "web"; url?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }
    const { data: userData, error: userErr } = await sb.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData.user) {
      return json({ error: "Not authenticated" }, 401);
    }

    const body = (await req.json()) as {
      query?: string;
      role?: "buyer" | "seller";
      mode?: "search" | "scrape";
      url?: string;
    };

    if (body.mode === "scrape") {
      return await handleScrape(body.url);
    }

    const { query, role } = body;
    if (!query || query.trim().length < 2) {
      return json({ results: [] as Result[] });
    }

    if (!BRIGHTDATA_API_KEY) {
      // Not configured — registry results still cover the page, this is a soft no-op.
      return json({ results: [] as Result[], note: "BRIGHTDATA_API_KEY not configured" });
    }

    const intent = role === "buyer" ? "suppliers of" : "buyers for";
    const searchQuery = `${intent} ${query}`;

    const serpUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&brd_json=1`;

    const resp = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        zone: BRIGHTDATA_SERP_ZONE,
        url: serpUrl,
        format: "json",
      }),
    });

    if (!resp.ok) {
      return json({ results: [] as Result[], note: `Bright Data request failed: ${resp.status}` });
    }

    const data = await resp.json();
    const organic: { title?: string; description?: string; link?: string }[] =
      data?.organic ?? data?.body?.organic ?? [];

    const results: Result[] = organic.slice(0, 10).map((r, i) => ({
      id: `web-${i}-${(r.link ?? r.title ?? i).toString().slice(0, 40)}`,
      name: (r.title ?? "Unknown company").split(" - ")[0]!.split(" | ")[0]!,
      detail: r.description ?? r.link ?? "",
      source: "web",
      url: r.link,
    }));

    return json({ results });
  } catch (err) {
    return json({ results: [] as Result[], note: String(err) });
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Strips tags/scripts/styles down to plain text, so the caller isn't shipping raw HTML around. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Renders the page in a real remote browser (handles JS-rendered sites the plain Unlocker fetch
 * can't) via Bright Data's Browser API, and returns its visible text. Returns null on any failure
 * so the caller can fall back to the Unlocker fetch instead of erroring the whole request. */
async function scrapeWithBrowser(target: string): Promise<string | null> {
  if (!BRIGHTDATA_BROWSER_URL) return null;
  let browser: { close(): Promise<void>; newPage(): Promise<{
    goto(u: string, o: Record<string, unknown>): Promise<unknown>;
    evaluate<T>(fn: () => T): Promise<T>;
    close(): Promise<void>;
  }> } | null = null;
  try {
    const { connect } = await import("npm:puppeteer-core@23");
    browser = await connect({ browserWSEndpoint: BRIGHTDATA_BROWSER_URL });
    const page = await browser!.newPage();
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    await page.close();
    return text;
  } catch (err) {
    console.error("Browser API scrape failed, falling back to Unlocker:", err);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function handleScrape(url: string | undefined): Promise<Response> {
  if (!url) return json({ text: "", note: "No url provided" });

  let target: string;
  try {
    target = new URL(url).toString();
  } catch {
    return json({ text: "", note: "Invalid url" });
  }

  const browserText = await scrapeWithBrowser(target);
  if (browserText) {
    return json({ text: browserText.replace(/\s+/g, " ").trim().slice(0, 8000), via: "browser" });
  }

  if (!BRIGHTDATA_API_KEY) {
    return json({ text: "", note: "Neither BRIGHTDATA_BROWSER_URL nor BRIGHTDATA_API_KEY is configured" });
  }

  try {
    const resp = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        zone: BRIGHTDATA_UNLOCKER_ZONE,
        url: target,
        format: "raw",
      }),
    });

    if (!resp.ok) {
      return json({ text: "", note: `Bright Data scrape failed: ${resp.status}` });
    }

    const html = await resp.text();
    // Cap payload size — we only need enough text to judge what the site sells.
    const text = htmlToText(html).slice(0, 8000);
    return json({ text, via: "unlocker" });
  } catch (err) {
    return json({ text: "", note: String(err) });
  }
}
