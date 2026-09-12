# Real matches, real percentages, and the missing keys

Three separate things are going on. I checked the live database and the saved services before writing this.

## 1. Why the keys look empty

Saved values are deliberately never shown — the screen only ever shows dots. There is no way to read a
key back except the "Reveal" button, and that button needs a separate vault password that has never
been set on this project, so it always fails.

What is actually saved right now:

- Bright Data — only the browser address; the API token, SERP zone and Web Unlocker zone are blank, and the service is switched **off**
- Didit — API key saved, but the three workflow IDs are blank and the service is switched **off**
- Open Exchange Rates — saved and on
- PayFast, Resend (in this screen), ComplyAdvantage, CIPC, SARS, escrow, AWS, Izenzo AI+ — nothing saved

So the page is correct: most services genuinely have no key yet.

### What I'll do

1. Set a vault password so "Reveal" works when you need to confirm a value.
2. Show a clear per-field state on each service: "Saved" versus "Not set", plus a red "Not connected"
   marker on any service that is off or missing a required field, so the page tells you at a glance
   what is missing instead of showing identical dots everywhere.
3. Copy the Bright Data API token already stored on the server into the Bright Data service entry so
   the screen and the search engine agree on one source.

## 2. Why there is no real data

The directory holds 7 businesses, 6 of them the clearly-marked examples I seeded. Zero real
counterparties have ever been recorded, because every live search route goes through Bright Data,
and Bright Data answers `Account is suspended` on every request. Nothing in the app can fix that.

Real data needs, in this order:

1. Bright Data reactivated (a billing/payment matter on their side), with a Scraping Browser zone plus
   a SERP zone and a Web Unlocker zone, and those zone names entered in Integrations.
2. Didit's three workflow IDs entered and the service switched on, so a match can actually be
   verified rather than just found.
3. Businesses signing up and leaving "Show us in the public directory" on — that is the second,
   permanent source and it does not depend on any outside service.

I'll also add a plain banner on the search results when the scraper is unavailable, saying results are
examples only, instead of silently returning an empty or example-only list.

## 3. Why percentages aren't real yet

Today the percentage is a number the language model assigns while reading scraped pages. With the
scraper down it never runs, so no result has a score at all.

I'll replace that single opaque number with a score built from things that can be checked, shown as a
breakdown on each result:

- what you asked for versus what they trade (commodity/sector overlap)
- where they are versus where you need delivery
- whether the size you want is within what they publish
- whether they are verified through the app
- how fresh the page it was found on is

The model's own read stays as one input, but it no longer decides the number on its own, and each
result shows why it scored what it did with a link to the page it came from.

## Technical notes

- Reveal gate reads `INTEGRATIONS_VAULT_PASSWORD`; it is unset, hence the failure.
- `integration_credentials` holds 3 rows (`brightdata`, `didit`, `open_exchange_rates`); `counterparties` is empty, `responder_listings` has 7 rows / 6 examples / 0 scored.
- Scoring lives in `src/lib/izenzo.functions.ts` (LLM-returned `score` 0-100, persisted to `counterparties.score`); the deterministic breakdown is computed server-side alongside it and stored with the rationale/evidence.
- Bright Data is read from `BRIGHTDATA_BROWSER_URL` / `BRIGHTDATA_API_KEY` in `src/lib/brightdata.server.ts`; I'll make it fall back to the Integrations entry so one place governs it.
