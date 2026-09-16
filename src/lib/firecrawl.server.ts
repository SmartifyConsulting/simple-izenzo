/** Live web reading through Firecrawl.
 *
 * One source of truth for the connection: whatever an administrator saved in Admin → Integrations
 * wins, with the server secrets / linked connector as the fallback. Firecrawl connections come in
 * two flavours — a Lovable connection key (`lovc_…`) that must go through the connector gateway, and
 * a direct provider key (`fc-…`) that talks to api.firecrawl.dev. We detect which one we hold. */

const DEFAULT_TIMEOUT_MS = 45_000;
const DIRECT_V2 = "https://api.firecrawl.dev/v2";
const GATEWAY_V2 = "https://connector-gateway.lovable.dev/firecrawl/v2";

export type FirecrawlCreds = { apiKey: string | null; lovableKey: string | null };

let credsCache: { at: number; creds: FirecrawlCreds } | null = null;

export async function firecrawlCredentials(): Promise<FirecrawlCreds> {
  if (credsCache && Date.now() - credsCache.at < 60_000) return credsCache.creds;

  let saved: Record<string, string> = {};
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecrets } = await import("@/lib/integrationCrypto.server");
    const { data } = await supabaseAdmin
      .from("integration_credentials")
      .select("secrets_encrypted")
      .eq("provider", "firecrawl")
      .maybeSingle();
    if (data) saved = await decryptSecrets((data.secrets_encrypted as string | null) ?? null);
  } catch {
    // No saved entry (or no key to read it with) — the server secret below still works.
  }

  const creds: FirecrawlCreds = {
    apiKey: saved["api_key"] || process.env["FIRECRAWL_API_KEY"] || null,
    lovableKey: process.env["LOVABLE_API_KEY"] || null,
  };
  credsCache = { at: Date.now(), creds };
  return creds;
}

export async function firecrawlConfigured() {
  const { apiKey, lovableKey } = await firecrawlCredentials();
  if (!apiKey) return false;
  // A gateway connection key is useless without the Lovable key that authenticates the gateway.
  return apiKey.startsWith("lovc_") ? Boolean(lovableKey) : true;
}



async function firecrawlPost(
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<Record<string, any>> {
  const { apiKey, lovableKey } = await firecrawlCredentials();
  if (!apiKey) throw new Error("Firecrawl is not connected yet. Add it under Admin → Integrations.");

  const gateway = apiKey.startsWith("lovc_");
  if (gateway && !lovableKey) {
    throw new Error("Firecrawl is connected through Lovable, but the workspace key is missing.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${gateway ? GATEWAY_V2 : DIRECT_V2}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gateway ? lovableKey : apiKey}`,
        ...(gateway ? { "X-Connection-Api-Key": apiKey } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      if (res.status === 402 || res.status === 403) {
        const { alertLowFunds } = await import("@/lib/opsAlerts.server");
        void alertLowFunds("Firecrawl", res.status, detail);
        throw new Error("Web search is out of credit right now — support has been notified.");
      }
      throw new Error(`Firecrawl refused the request [${res.status}]: ${detail}`);
    }
    return (await res.json()) as Record<string, any>;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error("The page took too long to load.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Firecrawl replies sometimes nest the document under `data`, sometimes not. */
function pickText(payload: Record<string, any>): string {
  const doc = payload?.['data'] ?? payload;
  const text: string = doc?.['markdown'] || doc?.['summary'] || doc?.['html'] || "";
  return String(text).replace(/\s+/g, " ").trim();
}

/** Reads a page and returns its visible text. */
export async function fetchPageText(target: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const payload = await firecrawlPost(
    "/scrape",
    { url: target, formats: ["markdown"], onlyMainContent: true },
    timeoutMs,
  );
  return pickText(payload).slice(0, 8_000);
}

/** Pulls a short, human-readable summary out of a company's own website. */
export function summarisePage(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return {
    excerpt: clean.slice(0, 600),
    wordCount: clean ? clean.split(" ").length : 0,
  };
}

/** One search result that was actually read, with the text we got off it. */
export type ScrapedSource = { label: string; url: string; text: string };

/** The open-web surfaces a counterparty search reads, in priority order: general web first, then
 * marketplaces/supplier directories, then trade registries, buyers and news. AI reads the first
 * few, AI+ reads them all. Each entry shapes the search query Firecrawl runs. */
export const SEARCH_SURFACES: { label: string; query: (q: string) => string }[] = [
  { label: "Web", query: (q) => q },
  { label: "Marketplaces", query: (q) => `${q} (marketplace OR B2B OR listing)` },
  {
    label: "Supplier directories",
    query: (q) => `${q} (supplier OR exporter OR distributor OR directory)`,
  },
  {
    label: "Trade registries",
    query: (q) => `${q} (company registry OR trade register OR chamber of commerce)`,
  },
  { label: "Buyers & tenders", query: (q) => `${q} (buyer OR importer OR tender OR RFQ)` },
  { label: "News", query: (q) => `${q} news` },
];

/** Runs one Firecrawl search and returns the result pages with their text. */
export async function searchWeb(
  query: string,
  label: string,
  limit = 5,
  timeoutMs = 30_000,
): Promise<ScrapedSource[]> {
  const payload = await firecrawlPost(
    "/search",
    { query, limit, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } },
    timeoutMs,
  );
  const raw = payload?.['data'];
  const items: Record<string, any>[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.['web'])
      ? raw['web']
      : Array.isArray(raw?.['news'])
        ? raw['news']
        : [];

  return items
    .map((r) => {
      const text = String(r?.["markdown"] || r?.["description"] || r?.["title"] || "")
        .replace(/\s+/g, " ")
        .trim();
      return { label, url: String(r?.["url"] ?? ""), text: text.slice(0, 6_000) };
    })
    .filter((s) => s.url && s.text);
}

/** Searches the first `limit` surfaces for one query. Individual surfaces are allowed to fail
 * (blocked, slow, empty) — the caller gets whatever came back plus the failures, so the UI can be
 * honest about which sources were read. */
export async function fetchSearchResults(
  query: string,
  limit = 3,
  timeoutMs = 30_000,
): Promise<{ sources: ScrapedSource[]; failures: { label: string; url: string; reason: string }[] }> {
  const surfaces = SEARCH_SURFACES.slice(0, Math.max(1, Math.min(limit, SEARCH_SURFACES.length)));

  const sources: ScrapedSource[] = [];
  const failures: { label: string; url: string; reason: string }[] = [];

  // Bounded concurrency: two searches at a time keeps credit use and latency predictable.
  const queue = [...surfaces];
  const worker = async () => {
    for (;;) {
      const surface = queue.shift();
      if (!surface) return;
      try {
        const found = await searchWeb(surface.query(query), surface.label, 5, timeoutMs);
        if (found.length > 0) sources.push(...found);
        else failures.push({ label: surface.label, url: "", reason: "No results for this search." });
      } catch (err) {
        failures.push({ label: surface.label, url: "", reason: (err as Error).message });
      }
    }
  };
  await Promise.all([worker(), worker()]);

  return { sources, failures };
}
