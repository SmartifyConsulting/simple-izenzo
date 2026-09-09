# Cleared gates turn green, changing your mind, and workspace tidy-ups

## 1. Cleared gate labels go green

Today the "Proof of Intent to be cleared" and "Without a Doubt to be cleared" bars are orange, and once the gate is passed the whole section folds into a green tick list with no coloured label at all.

After this change:

- The moment Proof of Intent is sealed, its label reads "Proof of Intent · cleared" in green.
- The same for Without a Doubt once it clears.
- The green label sits at the top of the folded tick list, so each finished stage keeps a visible green marker.
- Still-open gates stay orange exactly as now.

## 2. Change the party you chose

A "Choose a different party" action appears on the Intent sign-off panel and on the Proof of Intent panel (before payment).

- Clicking it asks for confirmation, then reopens the counterparty list with your shortlist and screening results intact.
- Your previous pick is released, the unsigned intent is cleared, and the deal returns to the choice step.
- The swap is written to the deal's activity trail with a date and time.
- Once Proof of Intent has been sealed and paid for, the action is no longer offered — the sealed certificate names the party.

## 3. Background screening progress bar stays visible

- The progress bar under Background screening stays on screen after the run finishes, with its result line underneath, exactly like the Counterparties frame.
- The bar is the same blue as the "runs quietly" badge, in both the in-progress and finished states, so the two frames read as a matched pair. A failed run still shows red.
- The result line reads as a finished sentence once complete (for example "All 6 checks complete") rather than disappearing.

## 4. Preview and download icons on attachments

The two icons only appear for files that have a stored copy, so older attachments recorded before file storage show nothing at all — that is why they are missing on your screen.

After this change:

- Every attachment row shows both icons.
- For a file with no stored copy, the icons appear greyed out with a short tooltip explaining the file was recorded before uploads were kept, so the row never looks broken.
- The same icon pair is applied to the attachment list on the Documents step so both places behave alike.

## 5. One Bid/Offer ID, inside the Live Workspace

- The Bid/Offer ID currently printed in the page header, above the canvas, is removed.
- The badge in the top-right corner of the Live Workspace becomes bold white text, so it reads as the single, clear deal identifier.


## Technical notes

- `GateBar` in `src/components/canvas/CanvasNode.tsx`: cleared state moves from `primary` tones to emerald tones; the folded POI/WaD blocks in `src/components/canvas/DealCanvas.tsx` render a cleared `GateBar` in place of the muted `label-caps` heading.
- New handler in `src/routes/_authenticated.live-deal-engine.tsx`: reset `counterparties.status` from `chosen` to `screened` with `chosen_at` nulled, null `transactions.intent_confirmed_at`, `advance(tx, "trading", "media")`, `recordEvent` action `counterparty_choice_reopened`, then `setStagePanel(null)`. Button is passed into `InlineFrame`/`StepScreen` for the `intent` and `poi` steps, hidden when `poi_sealed_at` is set.
- `DealCanvas` screening block: keep `screeningProgress` rendered after completion (do not clear it on finish), swap the fill class to `bg-info` to match the note badge, keep `bg-destructive` for failures.
- Attachment rows in `_authenticated.live-deal-engine.tsx` (and the documents list in `StepScreen.tsx`): render the `Eye`/`Download` buttons unconditionally, disabled with a tooltip when `storage_path` is null.
- Remove the `actions={activity && ...reference}` header prop from both `AppShell` returns in `_authenticated.live-deal-engine.tsx`; restyle the Live Workspace reference badge to bold white text.
