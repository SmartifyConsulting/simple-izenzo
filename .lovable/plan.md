# Finish the Live Workspace changes, with Bid Registration pinned

Already done in the previous pass: the matches list now reads this bid's own web results (with the
match percentage and a link to the page each was found on), finished workflow tasks and their ticks
are green, and long labels like "Submission of Documents" wrap instead of being cut off.

## What still changes

1. The Bid Registration frame stays pinned at the top of the Live Workspace, so it remains visible
   as you scroll through the summary and the match list.
2. Clicking **Fetch Interest** collapses the Bid Information frame into a clickable header
   (accordion), leaving the results room; clicking the header opens it again.
3. The saved document row becomes black with white text so it stands out, with preview and download
   still on the right.
4. Sample data is gone: the six example companies are deleted from the directory, the Example tags
   and the "these are sample listings" notice are removed, and searches only ever fall back to real
   published listings. If the live web cannot be read, the app says so instead of showing filler.
5. In the About section, the "Writing" label becomes "Articles".

## Technical detail

- Sticky header: in `_authenticated.live-deal-engine.tsx` the Bid Registration block gets
  `sticky top-0 z-20` with an opaque `bg-card` background inside the already-scrolling workspace
  column; the "Live Workspace" heading row is folded into the same sticky wrapper so nothing
  scrolls out from under it.
- Accordion: `bidInfoOpen` state (default true) set to `false` inside `fetchInterest()`; the BID
  INFORMATION label row becomes a button with a chevron, and the body (value line, bullets,
  read-documents notice, attachments) renders only when open.
- Document row: `bg-foreground text-background` on the saved attachment row, with the icons and the
  kind label switched to matching light tones.
- Sample removal: delete `responder_listings` rows where `is_example` is true; add
  `.eq("is_example", false)` in `HeroMatchCard.tsx` and `ResponderDirectory.tsx` and remove their
  Example badges and the sample-listings notice; add the same filter to `listingSources()` and
  `listingCandidates()` in `izenzo.functions.ts`.
- `alpha-bravo.about.$slug.tsx` back-link text `Writing` → `Articles`.
- No changes to `firecrawl.server.ts`, scoring weights, gates or token costs.
