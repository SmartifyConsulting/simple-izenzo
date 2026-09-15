# Untangle the counterparty frames

Right now three lists overlap: a "Choose Counterparty" frame that itself contains "Online media search results" and "Online media screening results", plus a second screening frame below it. Headings repeat, and prompts appear before there is anything to act on. This separates them into two plain frames with one job each.

## 1. Search Results — a record of what the search found

Its own frame directly under Bid Information, kept for the rest of the deal as the record of what was on screen at that moment.

- Heading pill: SEARCH RESULTS with the count.
- While the search is running it shows only the progress bar and "Searching for counterparties…" — no "Select a counterparty to continue" line.
- Once results are in it lists every company found, the ones taken forward pinned to the top and marked "Selected", each with its match percentage and the proposal icon.
- Collapses itself once a party has been chosen, but stays available to open.

## 2. Online Media Screening Results — where the choice is made

The one place a party is picked.

- Heading pill unchanged, with the counterparty count and collapse arrow.
- Under the heading, "Select who you want to trade with" reads as ordinary grey subtext, not a badge and not a greyed-out button.
- Once a party is selected, a normal Continue button appears on the heading row (reading "Recording your choice…" while it saves). No wide button at the bottom.
- After the choice is recorded the subtext and button disappear and the heading reads CHOSEN COUNTERPARTY.

## 3. The confusing middle frame goes

The frame that wrapped everything loses its duplicate lists: no nested "Online media search results", no nested "Online media screening results", no nested "Select a counterparty to continue". It keeps only the search progress, error text, and the pre-screening shortlist step that leads into screening — and stops drawing itself entirely once the two frames above cover the ground.

## Technical detail

`src/components/canvas/DealCanvas.tsx` (`CounterpartyRecord`):
- Remove the nested search-results accordion (~1419–1471) and the nested media screening accordion (~1473–1575); the route-level frames own both.
- Heading block (~1577–1589): render the "Select a counterparty to continue" text only when `candidates.length > 0 && !searching`; while searching, or with no candidates, show nothing there (the progress bar already speaks).
- Keep `setProposalFor`/`ProposalDialog`, challenge/governance actions, and the pre-screening shortlist + `onContinue` path untouched.

`src/routes/_authenticated.live-deal-engine.tsx`:
- Search Results frame (~2260–2306): render the candidate list itself here — sorted with `shortlisted` first, showing name, "Selected" chip, `score`%, and the proposal button — instead of relying on the nested list. Label stays `SEARCH RESULTS` with `candidates.length`; while `flowStep === "searching"` show only the existing progress bar. Default it closed once `dbHasChosenParty`.
- Screening frame heading row (~2329–2347): drop the greyed placeholder Button; render `Select who you want to trade with` as `text-[11px] text-muted-foreground` subtext beneath the heading row when `!dbHasChosenParty && !mediaPick`, and render the Button only when `mediaPick` is set (or `finalizing`). Heading text becomes `CHOSEN COUNTERPARTY` when `dbHasChosenParty`.
- Keep the empty-screening state (~2415) as is.

Then typecheck and confirm the preview build is clean.
