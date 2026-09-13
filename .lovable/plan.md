# Show the real web matches on the bid, not the sample directory

Firecrawl is working. For BID9089654 the search did read the live web and saved four genuine
organisations found on real pages — Axiom (axiomlaw.com), Adaptive Legal Group, Fowler Law PLLC and
Entrusted Advisors (pactly.com), each with a match score of 46–74% and an explanation.

The problem is the list you are looking at. The "All matches" list does not read the results saved
against this bid at all — it runs its own keyword lookup across the whole public directory, which is
mostly the clearly-marked sample companies (Karoo Grain Traders, Umoya Freight Partners, and so on).
So real Firecrawl results go in one door and sample listings come out the other.

## What changes

1. The matches list for a bid shows that bid's own results first: name, country, sector, the match
   percentage, the reason, and a link to the exact page it was found on.
2. Each row is labelled by where it came from — found on the web, on Izenzo, or a sample listing —
   and sample listings never appear while the bid has real results.
3. A short line above the list says how many sources were read live and, if the web could not be
   read for a search, says so plainly instead of quietly swapping in samples.
4. The wider directory list stays available underneath, for browsing beyond this bid.

## Technical detail

- `src/components/canvas/MatchResultsPanel.tsx` gains an optional `transactionId`. When present it
  queries `counterparties` for that transaction (`name, jurisdiction, sector, media_flags`), reads
  `media_flags.scoring.total` for the percentage, `media_flags.scoring.components` for the reason,
  and `media_flags.evidence[0].url` for the source link, sorted by score descending. Rows keep the
  radio-group selection behaviour already in the panel.
- The existing `responder_listings` query stays as a secondary "Other responders on file" block, and
  is skipped entirely while the bid has counterparties. `is_example` rows keep their Example tag.
- `src/routes/_authenticated.live-deal-engine.tsx` passes `transactionId={dealTx?.id}` where the
  panel is rendered for `panel === "matches"`.
- No changes to `firecrawl.server.ts`, `izenzo.functions.ts`, scoring, gates or tokens.
