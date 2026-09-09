// Live AI web discovery for the "Discover Counterparties" screen (src/routes/_authenticated.discover.tsx).
// Two modes, both driven by the same BRIGHTDATA_API_KEY:
//   { query, role }      — search mode (default): web search via Bright Data's SERP API, returns
//                           candidate companies.
//   { mode: "scrape", url } — scrape mode: fetches a candidate's own website via Bright Data's Web
//                           Unlocker so the caller can check what they actually sell.
//
// Requires a BRIGHTDATA_API_KEY secret (Bright Data zone/API token). Without it configured, this
// function returns an empty result set — the caller falls back to registry-only results, so the
// page still works, it just won't surface live web matches until the key is set:
//   supabase secrets set BRIGHTDATA_API_KEY=<token>
//   supabase functions deploy counterparty-discovery

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRIGHTDATA_API_KEY = Deno.env.get("BRIGHTDATA_API_KEY");
const BRIGHTDATA_SERP_ZONE = Deno.env.get("BRIGHTDATA_SERP_ZONE") ?? "serp_api1";
const BRIGHTDATA_UNLOCKER_ZONE = Deno.env.get("BRIGHTDATA_UNLOCKER_ZONE") ?? "unlocker_api1";

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

async function handleScrape(url: string | undefined): Promise<Response> {
  if (!url) return json({ text: "", note: "No url provided" });
  if (!BRIGHTDATA_API_KEY) return json({ text: "", note: "BRIGHTDATA_API_KEY not configured" });

  let target: string;
  try {
    target = new URL(url).toString();
  } catch {
    return json({ text: "", note: "Invalid url" });
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
    return json({ text });
  } catch (err) {
    return json({ text: "", note: String(err) });
  }
}
