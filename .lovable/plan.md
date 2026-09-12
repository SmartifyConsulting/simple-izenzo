# Fix the empty responder list on Alpha-Bravo

## What is actually wrong

Two separate reasons, both confirmed:

1. **There is nothing to show.** The list of businesses found by searching is completely empty — no search has ever produced a saved result. The only bid in the system is still sitting at the document step with no summary, so nothing has been searched for yet.
2. **Even when it fills up, the public page cannot read it.** Found businesses are stored privately against the bid that found them, readable only by the person who ran that search. A visitor to the Alpha-Bravo page is served an empty list every time, which is exactly what the page is receiving now.

So the page needs its own public list, not the private one.

## What gets built

**A public responder directory, drawn from both sources**

- Businesses registered on Izenzo can switch on "show us in the public directory" from their organisation profile. Off by default — nothing appears without consent.
- Names found by the web search get published as *unclaimed* listings, each carrying a link to the page it was found on, and each marked as not yet on Izenzo.
- Registered, verified businesses sort first; then registered; then unclaimed listings.
- Each row shows name, sector, region, a short line about them, and one of three badges: **Verified** (identity checked through Izenzo), **On Izenzo** (registered, not yet verified), **Unclaimed** (found on the web).
- An unclaimed row carries a "This is my business" action that points to sign-up, so a real owner can claim it later.
- The sector and location filter pages read from the same list, so the three directory pages can never disagree.

**Example listings so the page looks alive**

A small set of sample businesses across the existing sectors, each visibly labelled **Example**, inserted with the change so the page has content on first load. They are flagged as examples and can be cleared in one action from Admin later.

**Honest empty state**

When a filter genuinely matches nothing, the page says so and offers the sign-up path, instead of rendering an empty grid.

**Why your own search found nothing**

The current bid never reached the search step: no commodity was typed and no document summary exists, so there was nothing to search on. The document reading now runs on upload, so re-uploading the document (or typing the commodity) gives the search something to work with. No further change is needed for that — this plan only covers the directory.

## Technical notes

- New table `public.responder_listings`: `id`, `org_id` (nullable — unclaimed rows have none), `name`, `sector`, `jurisdiction`, `summary`, `source` (`registered` | `web_search`), `source_url`, `verified_at`, `published` (bool), `is_example` (bool), `created_by`, timestamps. Unique on `lower(name)` + `jurisdiction` to stop duplicate publishes.
- Migration order per the rules: create table, then `GRANT SELECT ON public.responder_listings TO anon` (the directory is public) plus `GRANT SELECT, INSERT, UPDATE ON ... TO authenticated` and `GRANT ALL ... TO service_role`, then enable RLS, then policies: anon/authenticated read where `published`; authenticated insert/update only where `org_id = current_org_id()`; unclaimed rows written server-side only.
- `verified_at` is set from a passed `identity_verifications` row for that org — never defaulted, so the Verified badge cannot be self-awarded.
- Publishing web-found names happens in a server function alongside `searchCounterparties`, writing unclaimed listings with the source URL kept as evidence. Private per-bid rows in `counterparties` stay exactly as they are.
- `ResponderDirectory.tsx` and `useResponderFacets` switch to `responder_listings`; the sector and location routes inherit it unchanged.
- Opt-in toggle added to the organisation profile screen, writing a `registered` listing for that org.
- Example rows are literal `INSERT` statements in the same migration with `is_example = true`.
