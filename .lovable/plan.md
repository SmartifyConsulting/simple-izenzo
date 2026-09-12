# Add a "Search Prompt" field above Upload files

## What the user gets

- On the upload card (homepage hero and the Submit a Bid pop-up), a new **Search Prompt** box sits above the Upload files frame, with a short label and placeholder like "Describe what you're looking for — product, quantity, location, terms".
- Either a prompt or a file is enough to run a search; the Find Matches button enables as soon as one of them is filled.
- The typed description is used together with the uploaded documents to decide the results, and the Start again icon clears it.

## Where the description is used

- In the preview card, the prompt narrows the listings shown, so typing something specific changes the result set instead of always showing the newest five.
- In the real workspace search, the typed description is saved with the bid and read alongside the document summary, so the search subject comes from the commodity, then the prompt, then the document summary.

## Technical notes

- `src/components/marketing/HeroMatchCard.tsx`: add a `prompt` state plus a `Textarea` block above the drop zone; `canSearch = prompt.trim().length > 0 || fileNames.length > 0`; `reset()` clears it. Pass the prompt into `useIllustrativeMatches` and apply an `or(...)` `ilike` filter on `name`/`sector`/`jurisdiction` built from the prompt's words when non-empty, keeping the `published` + count + limit-5 shape.
- Migration on `public.transactions`: add `search_prompt text`.
- `src/components/guided/DocumentUploadStep.tsx`: same Search Prompt field above the upload area, saved to `transactions.search_prompt` on submit alongside the document read.
- `src/lib/izenzo.functions.ts`: in the search subject resolution (~line 315), prefer `tx.commodity`, then `tx.search_prompt`, then `keywordsFromSummary(document_summary)`; include the prompt text in the model prompt with the document summary. Keep the existing clear error when no subject exists at all.
