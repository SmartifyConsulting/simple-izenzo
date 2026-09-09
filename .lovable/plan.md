# Attachment icons, test results for the two counterparties, and the WaD frame

## 1. Preview and download icons on attachments

Each attached file line gets two clear icon buttons on the right: an eye (preview — opens the file
in a new tab) and a down-arrow (download — saves it). The file name stays clickable for preview as
well. Both use the same short-lived secure link already in place, and both show a friendly message
if the file can't be opened.

## 2. Sample screening results for Anker Innovations and EnerSys

The six checks opened for these two are still sitting on "waiting" because nobody has completed the
hosted provider sessions. For this test cycle only, the stored results are filled in so the flow can
carry on:

- **Anker Innovations — full match.** Match score set to 100, all three checks (ID + selfie, company,
  sanctions/PEP) recorded as passed with a clear result note and a completion date. The registry line
  keeps whatever it found.
- **EnerSys — realistic mixed result.** ID and company checks passed, sanctions/PEP set to
  "needs review" with a short note, so the review path is visible too.

These are test values written into the existing verification records; no structure, gate, token cost
or rule changes. Real provider results arriving later would overwrite them normally.

## 3. Without a Doubt frame alignment

In the WaD group, the "Without a Doubt" cleared bar currently sits full width while the WaD case box
above it is narrower, so they look off-centre. The bar is set to the same width and centred under the
case frame, on both the bidder and responder sides.

## 4. Search progress bar under the Counterparties frame

Under the Counterparties frame, a progress bar shows the match search: it fills while the search is
running and sits at full, in green, once it finishes, with a line reading e.g. "Search complete —
11 matches found". If the search found nothing it reads "Search complete — no matches found", and if
it failed it reads the reason instead.



## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`: add an `Eye` icon button next to the existing
  `Download` button in the attachments list; both call the existing `openAttachment` /
  `downloadAttachment` helpers.
- Test data through `run_sql`: `UPDATE identity_verifications SET status, decision, reason,
  completed_at` for the six rows belonging to Anker Innovations and EnerSys on the current deal, plus
  `UPDATE counterparties SET score = 100` for Anker Innovations. No migration.
- `src/components/canvas/DealCanvas.tsx`: wrap the `GateBar` in the `compliance/wad` `GateGroup` in
  the same `stepsBoxClass` container the case node uses, so the cleared bar matches the frame width
  and centring. In `CounterpartyRecord`, add the search progress bar and count line below the
  Counterparties frame, driven by the existing searching / results / error state and the loaded
  candidate list.

