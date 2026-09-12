# Split the search ribbon, show real names, and open the full list in the workspace

## Search ribbon (homepage and the Submit a Bid pop-up)

- The ribbon keeps its current height but is split down the middle:
  - **Left half** — the typed description ("Describe what you're looking for — product, quantity, location, terms…").
  - **Right half** — a drop area in that same space: "Drop files here or click to browse". Dropping or clicking works anywhere in that half.
- The **+ button is removed**; attaching happens by dropping into the right half or clicking it.
- The send/search button stays at the far right; the Start again icon stays where it is.
- Attached file names still list under the ribbon with a remove control.
- While dragging, only the right half highlights.

## Match results

- Match names are shown in full — the blur is removed. The small lock icon on each row goes too, since nothing is hidden any more.
- Sector, band label, jurisdiction and "Found on the web" stay as they are.

## See more

- The "…" becomes a clear **See more** action and always appears when there are more results than the five shown.
- It opens the Live Workspace with the full match list in the right-hand panel, and carries the typed description across so the panel filters on the same search.
- Above that list the workspace shows a short summary of the search: the typed description and, when files were attached, how many were attached.

## Technical notes

- `src/components/marketing/HeroMatchCard.tsx`: replace the single-row ribbon with a two-column flex inside the same rounded container and height (`grid grid-cols-2` / `flex` with a divider); left column keeps the text `input`, right column becomes the drop/click target wired to the existing `addFiles` + hidden file input. Delete the `Plus` button and its import. Remove `blur-[3px] select-none` and the `Lock` row icon. Change the `…` Link to a labelled "See more" control passing `search={{ panel: "matches", q: prompt }}`.
- Same split ribbon treatment applied to the Search Prompt + upload block in `src/components/guided/DocumentUploadStep.tsx` so the pop-up matches.
- `src/components/canvas/MatchResultsPanel.tsx` already accepts `query`; add an optional summary line above the list rendering the query text (and attachment count when passed), reusing existing tokens — no new queries.
- No database, RLS or search-logic changes.
