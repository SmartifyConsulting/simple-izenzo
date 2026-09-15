# Continue at the bottom, then a folded Confirmed Intent and Proof of Intent

## What changes

1. **Continue moves to the bottom.** The screening frame's heading row keeps only the title, count and arrow. Below the last screened record sits the Continue button (right-aligned), enabled once a party is picked, reading "Recording your choice…" while saving. The plain grey line "Select who you want to trade with" stays as subtext under the heading until a party is picked.

2. **The frame folds itself away after Continue.** Once the choice is recorded, Online Media Screening Results collapses and its heading becomes CHOSEN COUNTERPARTY, leaving the space to Intent.

3. **"Intent Confirmation" heading removed.** The intent step shows the sentence "Read the terms as they stand. Confirming does not seal them — that is the next step." and then the certificate — no heading above it, no extra frame.

4. **Confirmed Intent is a collapsed accordion** sitting directly under Online Media Search / Screening results, expanding to the sentence plus the certificate.

5. **Proof of Intent becomes the same kind of accordion once sealed** — a collapsed frame reading Proof of Intent, expanding to show the certificate with View certificate and Download.

6. **Step 1 folds up on the map.** Once the pulse has moved on to Proof of Intent in Step 2, the Step 1 · Trading frame on the workflow map collapses to a slim ticked header bar instead of its full set of tiles, freeing height for the steps that still need attention. Clicking it opens it again.

7. **50 tokens for testing.** Both organisations attached to info@georgiaadams.co.za (Smartify Consulting and Georgia Adams, both currently 0) get 50 tokens each, recorded in the credit ledger as a test allocation.


## Technical detail

`src/routes/_authenticated.live-deal-engine.tsx`
- Screening frame (~2309–2408): remove the heading-row `Button`; render it after the records list, in a right-aligned row, gated on `!dbHasChosenParty`, `disabled={!mediaPick || finalizing}` — but visible only when the list is open. Keep the subtext under the heading.
- Auto-collapse: in `finalizeChoice`'s success path, call `setMediaResultsOpen(dealTx.id, false)` and open the Confirmed Intent accordion's successor step as today.
- New POI accordion: mirror the existing Confirmed Intent block (~2428–2458) for `stagePanel === "poi" && dealTx.poi_sealed_at`, with a `poiOpen` state defaulting to `false` and `<InlineFrame bare … step="poi" />`.

`src/components/steps/StepScreen.tsx`
- Intent step (~1462–1465): drop `title="Intent Confirmation"`; the unconfirmed panel renders the description line and terms without a heading pill.
- Sealed POI (~1726–1756): support the `bare` path so it returns just the certificate plus the two buttons when rendered inside the route accordion (no `Panel` title/description).

`src/components/canvas/MapView.tsx`
- When the Proof of Intent node's state is `active` (or Step 1 is fully done), render the `TRADE_ENGINE_FRAME` as a collapsed header bar — label plus green tick — and skip its child nodes/arrows; a local `step1Open` state toggled by clicking the bar restores the full frame. The remaining frames shift up by the reclaimed height.

Database (one migration, no schema change): `update public.organisations set credits = credits + 50` for the two org ids above, plus matching `credit_ledger` rows.


Then typecheck and confirm the preview build is clean.
