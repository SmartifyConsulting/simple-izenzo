# Why Amrod only appears when you type "amrod"

## What is happening

Amrod **is** being found. It is registered on Izenzo with the right details ("We make
corporate gifts; clothing; mugs, golf accessories"), and the search saved it against your
golf-ball bid with the highest score of all the results (60).

It is then hidden again by a second check that runs on the screen itself. That check
re-judges every company the search already kept, using only four short pieces of text:
the company name, its sector, its country, and one short note. For your bid it demands
**two** of the bid's words to appear in those four pieces. Amrod's sector reads
"Corporate Gifting" and its country "South Africa", so only "golf" (from the short note)
matches — one word, not two, so it is dropped from the list.

When you add "amrod" to the wording, the name itself becomes the second matching word,
so it passes and appears. That is the whole behaviour.

The same check also decides the counterparty count and the shortlist screens, so those
can disagree with what the search actually found.

## The fix

The search already does the real work: it reads the company's own pages, tests whether
it is the right side of the trade, scores it, and records why anything was dropped in the
"Considered and not kept" list. A company that survived all of that should not then be
hidden by a word count on the screen.

So for companies saved against a bid:

- Stop re-judging them on the screen. Show what the search kept, ordered by score, with
  Amrod and every other registered Izenzo company included.
- Keep excluding your own organisation — that rule stays.
- Keep the "Considered and not kept" list as the single place that explains a drop, so
  every exclusion is still visible and attributable to the search, not to an invisible
  screen filter.
- Apply the same change everywhere this filter is used, so the list, the counterparty
  count and the shortlist always agree.

The general directory screen (browsing companies with no bid attached) keeps its existing
word matching, because there is no search judgement behind those rows.

Nothing else changes: how the search finds companies, how they are scored, AI+ staying
advisory only, sealed Proof of Intent, mandatory Without a Doubt, and tenant separation
are all untouched.

## Technical detail

- `src/lib/bidRelevance.ts` — `keepForBid` currently returns
  `isRelevant(c, ctx.searchedFor)` (strict mode: two term hits once the bid wording has
  three or more terms). For bid-saved rows it keeps only the own-organisation exclusion;
  the relevance test is removed from that path. `loadRelevantCounterparties` returns rows
  ordered by score descending.
- `src/components/canvas/MatchResultsPanel.tsx:104` — drops the `keepForBid` filter over
  `bidMatches` (own-organisation exclusion retained); the directory query at line ~138
  keeps its `isRelevant` filter unchanged.
- `src/components/canvas/DealCanvas.tsx:1304` — same change to the counterparty list it
  builds.
- `src/routes/_authenticated.live-deal-engine.tsx:356, 880, 1807` — no edit needed; they
  read through `loadRelevantCounterparties` and pick up the corrected rule.
- Verification: typecheck, the existing automated checks (`src/lib/aiPlus.test.ts`,
  `src/lib/relevance.test.ts` — `isRelevant` itself is not modified), a clean build, and
  a signed-in check on BID1798792 that Amrod appears at the top of the results with the
  bid wording that does **not** mention amrod.
