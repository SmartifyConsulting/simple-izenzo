# "Search again" button after editing the search

## What you get
- In the Search Results frame, when you open **Edit Search** and change the wording, the button reads **Search again** (instead of "Search").
- It lights up only once the text is actually different from the last search. If nothing has changed, it stays greyed out, so the same search can't be re-run by accident.
- Clicking it saves the new wording to the bid and runs the AI search again, the same way it does today. **Cancel** still closes the box without changing anything.

## Technical notes
- `src/components/canvas/DealCanvas.tsx` (edit box, around lines 1639-1669): rename the button label to "Search again". Change `disabled` to `editedPrompt.trim().length === 0 || editedPrompt.trim() === (currentPrompt ?? "").trim()`, where `currentPrompt` is the search-text prop that already pre-fills the box.
- No change to `refineSearch`/`runSearch`, the database, gates or token costs.
