# Show the real web matches on the bid, and drop the sample data

Firecrawl is working. For BID9089654 the search did read the live web and saved four genuine
organisations found on real pages — Axiom (axiomlaw.com), Adaptive Legal Group, Fowler Law PLLC and
Entrusted Advisors (pactly.com), each with a match score of 46–74% and an explanation.

The problem is the list you are looking at. The "All matches" list does not read the results saved
against this bid at all — it runs its own keyword lookup across the whole public directory, which is
mostly the clearly-marked sample companies (Karoo Grain Traders, Umoya Freight Partners, and so on).
So real Firecrawl results go in one door and sample listings come out the other.

## What changes

1. The matches list for a bid shows that bid's own results: name, country, sector, the match
   percentage, the reason, and a link to the exact page it was found on.
2. Sample data is removed from the app entirely. The six example companies are deleted from the
   directory, the code that creates them is removed, and searches never fall back to samples again.
   If the live web genuinely cannot be read, the app says so instead of showing filler.
3. Clicking **Fetch Interest** collapses the Bid Information frame into a single clickable header
   (accordion style), so the results have the room. Clicking the header opens it again.
4. The saved document row becomes black with white text so it stands out, with preview and download
   still on the right.
5. Workflow labels stop being cut off — "Submission of Documents" and every other label wraps onto a
   second line instead of being clipped.
6. In the About section, the "Writing" label becomes "Articles".

## Technical detail

- `src/components/canvas/MatchResultsPanel.tsx` gains an optional `transactionId`. When present it
  queries `counterparties` for that transaction (`name, jurisdiction, sector, media_flags`), reads
  `media_flags.scoring.total` for the percentage, `media_flags.scoring.components` for the reason
  lines and `media_flags.evidence[0].url` for the source link, sorted by score descending. Radio
  selection behaviour is unchanged. `_authenticated.live-deal-engine.tsx` passes
  `transactionId={dealTx?.id}` for `panel === "matches"`.
- Sample removal: migration deleting `responder_listings` rows where `is_example` is true; drop the
  seeding block and every `is_example` badge/branch in `responderListing.functions.ts`,
  `MatchResultsPanel.tsx`, `HeroMatchCard.tsx` and the responder directory routes. In
  `izenzo.functions.ts`, `listingSources()`/`listingCandidates()` keep only real published listings
  (`is_example = false`); when neither the web nor real listings return anything the search reports
  the Firecrawl failure verbatim.
- Accordion: `_authenticated.live-deal-engine.tsx` holds `bidInfoOpen` state, set to `false` inside
  `fetchInterest()`; the BID INFORMATION block renders as a header row plus collapsible body.
- Document row: `bg-foreground text-background` (with matching muted tone for the sub-label) on the
  saved attachment row.
- Labels: in `ClassicView.tsx` remove `truncate` from the item and step label spans (lines ~160 and
  ~261) and allow wrapping (`leading-snug`), keeping the `min-w-0 flex-1` layout.
- `alpha-bravo.about.$slug.tsx` back-link text `Writing` → `Articles`.
- No changes to `firecrawl.server.ts`, scoring weights, gates or token costs.
