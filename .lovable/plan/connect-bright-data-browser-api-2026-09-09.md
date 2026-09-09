# Connect Bright Data (Browser API)

Yes — it is the single embedded-credential endpoint. Bright Data's Browser API gives you one
address with the username and password already inside it:

```text
wss://brd-customer-<id>-zone-<zone>:<password>@brd.superproxy.io:9222
```

That one value is what Puppeteer, Playwright and Selenium all connect to, so nothing else is
needed. It is stored as an encrypted server secret, never shown in the app and never sent to
anyone's browser.

## What happens after it is saved

1. **Counterparty discovery** — the Discover screen already asks the web-lookup service for
   candidates; with the endpoint present it can also open each candidate's own website in a real
   browser, so sites that only render through JavaScript stop coming back blank.
2. **Product match** — the "does this company actually sell what I searched for" score gets real
   page text instead of nothing.
3. **Company / registry lookups** — a new action on the Registry screen: paste or pick a company,
   and the service reads its public website and returns a short summary (site title, description,
   what they appear to trade) which you can save against the registry record. Nothing is written
   without you confirming it.

Search results (the list of candidate companies) come from Bright Data's SERP/Web Unlocker product,
which is a separate API token you said you do not have. Without it the web-search half stays as it
is today — registry-backed results only — while everything above works from the Browser API.

## Steps

1. Save the Browser API endpoint as a server secret (`BRIGHTDATA_BROWSER_URL`) through the secure
   form — the value never passes through chat.
2. Redeploy the web-lookup service so it picks the secret up, and confirm it can open a live page.
3. Add the registry lookup action described above, reusing the existing scrape path.
4. Show a plain message on Discover and Registry when the endpoint is missing or a site refuses to
   load, instead of silently returning nothing.

## Technical notes

- `supabase/functions/counterparty-discovery/index.ts` already reads `BRIGHTDATA_BROWSER_URL` and
  connects with `puppeteer-core` (`scrapeWithBrowser`), falling back to the Web Unlocker HTTP fetch
  when absent. No change to that file is required for the browser path.
- Secret is set on the Edge Function environment; the function is redeployed unchanged.
- Registry lookup: new server function in `src/lib/izenzo.functions.ts` calling the existing
  `mode: "scrape"` branch, surfaced from `src/routes/_authenticated.registry.tsx`. Writes to
  `registry_companies` only on explicit confirm, under existing RLS.
- Existing database structure, gates, token costs and permissions are unchanged.
