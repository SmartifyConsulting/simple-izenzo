# Real web matches from Bright Data, all AI searching on GPT-6 Astra

## What changes for you

1. **Searching actually looks at the web.** When you run a counterparty search (both from a deal
   and from the free-text discovery screen), Bright Data first scrapes the open web and
   marketplaces/directories for real companies that match what you are buying or selling. Those
   scraped pages are what the AI works from, so each candidate is backed by a page that was really
   found rather than a name the model recalled.
2. **Every candidate carries its evidence.** Each result keeps the page link it came from, so you
   can open the source next to the name, score and rationale.
3. **One AI brain for all searching: GPT-6 Astra.** Both the standard search and the deeper AI+
   search now use GPT-6 Astra. AI stays the quick pass, AI+ thinks harder and scans more sources —
   the difference is depth and how many sources are read, not a weaker model.
4. **Honest empty state.** If the Bright Data connection is missing or a source blocks the scrape,
   the search says so plainly and shows whatever sources did come back, instead of quietly falling
   back to invented names.

## Where it applies

- Counterparty search inside a deal (Counterparties step).
- The Discover Counterparties free-text search.
- Online Media Checks keeps using Bright Data as it does today — only its wording is aligned.

## Technical detail

- `src/lib/izenzo.functions.ts`
  - Set `AI_MODEL` and `AI_PLUS_MODEL` both to `openai/gpt-6-astra`; tier difference becomes
    `reasoning_effort` (`low` for AI, `high` for AI+) plus the number of scraped sources fed in.
    Keep `aiPlusOptions` as the single place that sets Astra's required reasoning effort and omits
    `temperature`/`top_p`; cap length with `max_completion_tokens`.
  - `searchCounterparties` and `discoverCounterpartiesByQuery`: before the model call, build search
    queries from the deal (commodity, quantity, jurisdiction, region) or the free-text query and
    scrape result pages through `fetchPageText` from `@/lib/brightdata.server` — general web plus
    marketplace/directory and supplier-listing queries (AI: ~3 sources, AI+: ~6). Pass the
    extracted text as grounding context and instruct Astra to only return organisations that appear
    in that context, each with the `sourceUrl` it came from.
  - Extend the parsed candidate shape with `sourceUrl`, persist it on insert inside
    `media_flags` (`{ evidence: [{ url, source }] }`) so no migration is needed, and return it to
    the client.
  - Guard on `brightDataConfigured()`: when not connected, return a clear "live web search is not
    connected" error rather than an ungrounded model result.
- `src/lib/brightdata.server.ts`: add a small `fetchSearchResults(query, sources, limit)` helper
  over the existing `fetchPageText` so both search functions share the query/scrape logic; run the
  fetches with bounded concurrency and tolerate individual failures.
- UI: show the evidence link on each candidate row in the Counterparties and Discover results
  lists; tier badges keep saying AI / AI+.
- Other AI calls (document summaries, org brief, outreach drafting, AI proposal) stay on their
  current models — this change is scoped to searching.

## Landing-page match results: five, then an ellipsis

- Drop the word "teaser" everywhere in the app's wording. The match card on the landing page says
  how many matches were found and that the top five are shown, with no marketing-speak.
- Show exactly five result rows. Below them, an ellipsis control ("…", labelled "Show all matches"
  for screen readers) appears whenever there are more than five.
- Clicking the ellipsis takes the visitor to the workspace split view with the full result list in
  the right-hand panel — the same panel the deal workflow uses, so results and workflow sit side by
  side.
- Engaging with anything in that panel — opening a record, contacting, shortlisting — requires an
  account: a visitor who is not signed in is sent to sign up, or to sign in with facial
  recognition, and lands back on the same results panel afterwards.

### Technical detail

- `src/components/marketing/HeroMatchCard.tsx`: remove the "teaser" copy, cap the rendered list at
  five, and add the ellipsis button. It links to `/live-deal-engine` with a search param carrying
  the visitor's query/role (e.g. `?panel=matches&q=…&role=…`).
- `src/routes/_authenticated.live-deal-engine.tsx`: read that param and render the full match list
  in the right panel (left panel for the Offer/mirrored layout), reusing the existing results list
  component rather than a new one.
- The route already sits under `_authenticated`, so an unauthenticated visitor is redirected to
  `/auth` with `next` set to the same URL, and the existing facial-recognition sign-in stays the
  sign-in path. Blurred names and locks remain only for the pre-sign-in landing card.
- Rename the unrelated `teaser` field on insight articles (`src/lib/alphaBravoInsights.ts` and
  `alpha-bravo.about.$slug.tsx`) to `summary` so the word disappears from the codebase too.
