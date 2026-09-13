# Live Workspace: truthful pulsing, a cleaner registration frame, and tidier results

## Changes

1. **Only one task pulses at a time.** Search AI + AI+ pulses only while the search itself is
   running; Online Media Screening pulses only while the media scan is running. When the search
   finishes it turns ticked and Online Media takes over the pulse — never both together, and
   neither pulses just because the deal's stored step happens to point at them.

2. **Bid Registration frame layout.** Left column: business name with verification status, the bid
   name (wrapping onto as many lines as it needs, right aligned) and "Bidder Active Since". Right
   column: the BID/OFF ID and the details that belong with it — registration date and time, and the
   country.

3. **Nothing shows through the pinned frame.** The Bid Registration frame stays pinned at the top
   and is now fully opaque, so content scrolling underneath no longer appears through or above it.

4. **Repeated names in the search results.** Results that are the same organisation found on more
   than one page (e.g. two Fowler entries, two Axiom entries) collapse into one row: the highest
   scoring one is kept, and it shows how many pages it was found on, with links to each. Matching is
   on the normalised business name (ignoring case, punctuation and suffixes like Ltd, LLC, PLLC,
   Inc, Group) and on the website it was found on.

5. **Project Preparation and Execution filled grey.** Both rows in the workflow list get a grey
   fill, marking them as later work rather than something to act on now.

6. **All sub-steps move 1 cm further left** — completed and outstanding alike, including the single
   ticked row a finished step collapses into.

7. **Document preview fails ("blocked by Chrome").** Preview currently opens the file's storage
   address in a new tab, and a browser extension or ad blocker on your machine blocks that address
   outright. Preview will instead fetch the file inside the app and open it from the app's own
   address, so nothing external is loaded; if the file still cannot be shown it falls back to
   downloading it and says so, rather than leaving a blocked page.

## Technical detail

- `_authenticated.live-deal-engine.tsx`: `stepOverrides` derives from one explicit phase rather
  than overlapping conditions — while `flowStep === "searching"` it sets `search: "active"` and
  `onlineMedia: "open"`; once searching ends `search: "done"`, and `onlineMedia` becomes `"active"`
  only while `mediaRunning`, `"done"` once `mediaResults !== null`. Every step-1 key is written
  explicitly so no row falls back to the stored-step pulse.
- Same file, Bid Registration block: swap the two grid columns' contents as described; add
  `[background-image:none] [backdrop-filter:none] bg-card` to the sticky frame so the `glass-node`
  translucency doesn't let scrolled content bleed through.
- `MatchResultsPanel.tsx`: after mapping the bid's counterparties, reduce by
  `normalise(name) || hostname(source_url)`, keeping the max score and collecting each row's
  evidence URL into a list; render "Found on N pages" with the links when N > 1.
- `ClassicView.tsx`: `SubItem` gains `muted?: boolean`, set on `preparation` and `entry`;
  `itemClasses` returns a grey `border-border bg-muted text-muted-foreground` for those. The
  sub-step container (and the collapsed finished-step row) gains `-ml-[1cm]`.
- No changes to search logic, scoring weights, gates or token costs.
