# Enable the Clear WaD button

## What's wrong now

On the Without a Doubt panel the two lines (KYC, and KYB/UBO/sanctions/PEP) are shown as
results only — they tick themselves when Step 1 screening came back cleared, and there is no
way for a person to tick them. The Clear WaD button stays greyed out until both lines are
ticked, so whenever a Step 1 result is missing, still in progress, or needs review, the deal
cannot be cleared at all. Refer and Block stay available, but clearing is a dead end.

## What changes

- Clear WaD becomes clickable whenever the organisation has enough tokens, exactly like Refer
  and Block. It no longer depends on both screening lines being cleared.
- When a line is not cleared, a short note above the buttons says which one is outstanding and
  that clearing it is an override recorded against the deal — so the reviewer sees what they
  are taking responsibility for instead of a button that does nothing.
- The clearance certificate keeps recording the real status of each line (cleared in Step 1,
  needs review, no result yet) plus the reviewer's case notes, so an override is visible on the
  certificate rather than hidden.
- The token check, the Flagged counterparty warning, the Step 1 summary and the Refer/Block
  buttons all stay as they are.

## Technical detail

In `src/components/steps/StepScreen.tsx` (`WadStep`):

- Drop `!allChecked` from the Clear WaD button's `disabled` expression (line ~1740); keep
  `busy || shortOnTokens`.
- Add an override notice rendered when `!allChecked`, listing the `WAD_CHECKS` labels whose
  `checks[key]` is false, in the same muted/amber styling used for the existing notices.
- In `certificateBody`, when `statusFor(key)` yields nothing or a non-cleared tone, emit
  "cleared by reviewer override" for that line instead of the current
  "Confirmed by the compliance reviewer" wording.
- `allChecked` stays in place for the notice; no change to `completeWad` or its payload.
