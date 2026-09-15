# Live Workspace: keep every frame, name the chosen party, tidy Proof of Intent

The workspace currently drops earlier frames as the deal advances. Once Intent or Proof of
Intent takes over, Search Results and the screening record vanish, and the Proof of Intent
frame is never created as a folded record at all — which is why the workspace looks almost
empty in the screenshot. Everything already completed should stay on the page as a closed
accordion.

## What changes

1. **Search Results folds itself when Online Media Screening starts.** The moment screening
   begins it closes automatically, leaving room for the screening list below it.

2. **Nothing disappears.** Search Results, Online Media Screening Results, Confirmed Intent
   and Proof of Intent all remain on the page for the rest of the deal, each closed, stacked
   in the order they happened. They no longer depend on which step the workspace is currently
   asking about, and they no longer vanish once compliance is cleared.

3. **Chosen Counterparty names the party.** Once a choice is recorded, the frame heading is
   followed by the chosen counterparty's name, so the frame answers "who" without opening it.

4. **Confirmed Intent badge.** In the screening list, the record that was chosen carries a
   small green "Confirmed Intent" badge next to its name once intent is confirmed. No other
   marker is added to that row.

5. **Proof of Intent frame, folded.** A Proof of Intent accordion is created and kept closed
   in the stack. The duplicated "PROOF OF INTENT" heading inside it is removed; the sentence
   "Sealing writes the transaction state to an immutable record with a fingerprint.
   Compliance, execution, finality and memory stay locked until it exists." becomes subtext
   directly under the pill heading. Opening it shows the certificate.

6. **New Documents frame under Bid Information.** Attachments move out of Bid Information into
   their own collapsed "Documents" frame directly beneath it, which also holds the certificates
   the deal produces (confirmed intent, sealed proof of intent, clearance) as they are filed.
   Certificates are filed quietly: nothing opens, expands or pops up when one is generated —
   the frame stays closed until you open it.


## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`
  - Replace the render condition on the Search Results block (currently gated on
    `choicePending || !stagePanel || (stagePanel === "intent" && intent_confirmed_at)` and
    `!wad_completed_at`) with a persistence rule: render whenever results/candidates exist for
    the transaction. Same for the Online Media Screening Results block.
  - Add an effect that sets `searchResultsOpen(txId, false)` when `mediaRunning` flips true.
  - Extend the chosen-party effect (around line 357) to also select `name` of the `chosen` row
    into new `chosenPartyName` state; render it beside the "Chosen Counterparty" pill and use it
    to mark the matching row in the screening list.
  - Render the Confirmed Intent and Proof of Intent accordions from transaction state
    (`intent_confirmed_at`, `poi_sealed_at`) rather than from `stagePanel`, so they persist;
    keep the active-gate `InlineFrame` branch for the step still needing action.
  - Move the `savedAttachments` list into a new collapsed Documents accordion rendered after
    the Bid Information frame, with certificate rows appended.
- `src/components/steps/StepScreen.tsx`: in the POI step, drop the inner heading when rendered
  `bare` and emit the sealing sentence as subtext under the pill.
- No schema, gating or governance changes: the AI+ advisory decision flow, WaD gate and seal
  immutability stay exactly as they are.
