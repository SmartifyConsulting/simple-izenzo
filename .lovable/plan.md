# Switch live web reading from Bright Data to Firecrawl

Every place that reads the open web today goes through Bright Data's remote browser, which the
provider is currently refusing (the "403 / suspended" errors you keep seeing). Firecrawl replaces it
everywhere, using your own Firecrawl key.

## What changes for you

1. Firecrawl becomes the single live-web source. Bright Data is removed from the app and from
   Admin → Integrations.
2. Your Firecrawl key is saved securely (either through the Firecrawl connector, or as a key in
   Admin → Integrations — whichever you prefer; the connector needs no copy-paste of the key into
   the app screens).
3. All five places that read the web keep working, now on Firecrawl:
   - Fetch Interest / counterparty matching (AI and AI+ searching)
   - Online Media Checks (social, marketplace, news scanning)
   - Business Registry "Look up website"
   - Counterparty outreach website read
   - Organisation brief website read
4. Wording across the app stops naming Bright Data and names Firecrawl instead. Where a source
   cannot be read, the message stays honest and the search still falls back to published Izenzo
   directory listings.

## Technical detail

- New `src/lib/firecrawl.server.ts` replacing `brightdata.server.ts`, exporting the same shape so
  callers change by one import each:
  - `firecrawlConfigured()` — key present (integration credentials first, then `FIRECRAWL_API_KEY`).
  - `fetchPageText(url, timeoutMs)` — `POST /v2/scrape` with `formats: ["markdown"]`,
    `onlyMainContent: true`; returns trimmed text, capped as today.
  - `fetchSearchResults(query, limit)` — `POST /v2/search` with `scrapeOptions.formats: ["markdown"]`,
    mapped into the existing `ScrapedSource { label, url, text }` plus per-source failures, so the
    grounding contract in `izenzo.functions.ts` is unchanged. The Bing-URL `SEARCH_SURFACES` list
    becomes query modifiers (marketplaces, supplier directories, registries, buyers/tenders, news).
  - Transport mode read from the linked connection: gateway (`connector-gateway.lovable.dev/firecrawl/v2`
    with `LOVABLE_API_KEY` + `X-Connection-Api-Key`) when the connection is gateway-backed, otherwise
    direct `api.firecrawl.dev/v2` with the `fc-` key. Never called from browser code.
- Call sites updated: `izenzo.functions.ts` (search grounding + candidate site read),
  `onlineMedia.functions.ts` (site-scoped queries via Firecrawl search instead of scraped Bing pages),
  `counterpartyOutreach.functions.ts`, `orgBrief.functions.ts`, `brightdata.functions.ts` renamed to
  `webLookup.functions.ts` (`lookupCompanySite` kept, import in `_authenticated.registry.tsx` updated).
- `integrations.catalog.ts`: `brightdata` entry replaced by `firecrawl` (API key field, docs link,
  testable). `integrations.functions.ts` test probe swapped to a cheap Firecrawl scrape.
- `SearchButton.tsx` label `Web · Bright Data` → `Web · Firecrawl`; comments updated.
- `brightdata.server.ts` deleted; the unused `supabase/functions/counterparty-discovery` edge
  function's Bright Data reference cleaned up.
- No database, gate, token or permission changes.

## Note

Firecrawl's search and scrape consume credits per page, so AI reads a few sources and AI+ reads more,
exactly as the tiers do today.
