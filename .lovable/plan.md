# Toaster polish, Intent heading, and the stuck Intent on BID9088926

## Why Confirm Intent is blocked on BID9088926

Verified against the deal's own record and history, not guessed:

- Intent was already confirmed on this bid at 22:03, and Proof of Intent was sealed 10 seconds later.
- At 22:24 a new counterparty (Deloitte Legal) was chosen on the same bid.
- The Confirm Intent button is switched off whenever an intent date already exists, so it now reads "Intent confirmed" and cannot be pressed for the new party.
- The "reopen the choice" action, which would normally clear the old intent, refuses to run once Proof of Intent has been sealed — so the bid is stuck: the choice moved on, but intent and the seal still belong to the previous party.

## Changes

1. **Unblock a bid whose party changed after sealing** — When a new counterparty is chosen on a bid that already carries a confirmed intent, the old intent no longer counts: clear it so Confirm Intent becomes available again for the newly chosen party. The bid's stage marker moves back to Intent so the workflow shows Intent as the live step. Any Proof of Intent already sealed against the previous party stays on the record as history (nothing is deleted and no tokens are refunded), and a line is written into the bid's Logs noting that intent was reopened because the party changed. Sealing Proof of Intent for the new party then works normally, charging as usual.

2. **Repair BID9088926 specifically** — Clear the stale intent date on this bid so Confirm Intent is pressable for Deloitte Legal, and set its stage marker back to Intent.

3. **Give the Intent frame the same heading as the other Live Workspace frames** — The Confirm Intent frame heading takes the identical small-caps label treatment used by LIVE WORKSPACE, BID INFORMATION and Proof of Intent: same size, weight, letter spacing, colour and font family.

4. **Move the notification close control to the top right** — The x sits in the top-right corner of the notification card instead of the top left, on the card surface with the same hairline border, and only shows on hover/focus where the design allows.

5. **Match notification text to the workflow sub-step text** — Notification titles use the same font family and size as the workflow sub-step labels (13px sans), in bold, and in the standard black/foreground text colour rather than small-caps grey. The supporting description line stays one size smaller and muted. The coloured left edge by kind stays as it is.

## Verification

Open BID9088926, confirm the Confirm Intent button is active for Deloitte Legal and completes, and that the Intent frame heading matches the other frame headings. Trigger a notification and confirm the x is top right and the title reads as bold black sub-step text, in both light and dark mode.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`: in the choose/continue path (`startMediaChecks` / the chosen-counterparty write), when `dealTx.intent_confirmed_at` is set, null it, `advance(tx.id, "trading", "intent")`, record an `intent_reopened` event, and update local `dealTx`. Drop the `poi_sealed_at` early return only for this reset path; `reopenChoice` keeps its existing guard.
- One-off data fix: `update transactions set intent_confirmed_at = null, step = 'intent' where reference = 'BID9088926'`.
- `src/components/steps/StepScreen.tsx`: `IntentStep`'s `Panel` title inherits the shared Panel heading, already `label-caps font-sans`; align the remaining `text-slate-*` override so the Intent frame reads identically to the workspace frames.
- `src/components/ui/sonner.tsx`: `toastOptions.classNames.closeButton` positioned top-right via `!right-0 !left-auto -translate-y-1/2 translate-x-1/2` style overrides (sonner defaults to left); `title` becomes `font-sans text-[13px] font-bold leading-snug text-foreground` (drop `label-caps`).
