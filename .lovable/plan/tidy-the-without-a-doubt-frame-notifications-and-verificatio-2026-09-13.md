# Tidy the Without a Doubt frame, notifications and verification

## Changes

1. **Match the Without a Doubt typography to the other frames** — The heading and the "cleared" heading use the same small-caps label style as Live Workspace, Bid Information and Proof of Intent. Every line inside the frame drops to the small body size used in those frames: the check list and its result lines, the "manual" and route notes, the token shortfall line, the flagged-counterparty warning, the screening progress text, case notes label and box, and the clearance seal block. Spacing tightens to match; colours, borders and layout stay as they are.

2. **Remove the admin/developer simulation frame** — The dashed "Admin / developer only" panel with the four Simulate (Test Mode) buttons (CIPC, Onfido, Dow Jones, Refinitiv) is removed from the Without a Doubt frame entirely, along with the simulate action behind it. Nothing else in the frame moves position other than closing the gap it leaves.

3. **Make notifications part of the app and look professional** — Notifications keep to the app's own styling rather than the library default: positioned bottom-right, sitting on the app card background with the same hairline border and rounded corners as the frames, the small-caps title style with small body text beneath, a coloured left edge by kind (success green, warning orange, error red, plain for information), a close control, and a slightly longer read time for errors. They render consistently across every screen and in both light and dark mode.

4. **Add a Re-run all button for verification** — The Identity verification panel gains a single "Re-run all" action in its header. It restarts every listed check (ID document, company and sanctions) in one press, shows a spinner and disables itself while running, and reports how many were re-opened. Individual per-check start and refresh actions stay as they are.

5. **Move the verification controls up to save space** — The identity verification block, with its per-check buttons and the new Re-run all, moves to sit in line with the screening findings at the top of the Without a Doubt frame, above Case notes. The buttons sit on the same rows as the findings they belong to rather than in a separate block below, so the frame is shorter and Case notes stays last before the decision buttons.


## Verification

Open a deal at Without a Doubt and confirm the heading and all text inside match the other frames, the admin/developer panel is gone, a triggered notification appears in the new style in both light and dark mode, and Re-run all restarts the three checks and reports the outcome.

## Technical notes

- `src/components/steps/StepScreen.tsx`: delete `StubProviderPanel`, `STUB_PROVIDERS` and the `<StubProviderPanel …>` usage in `WadStep`; normalise `text-sm`/`text-[11px]` inside `WadStep` to `text-xs`, and give both `Panel` titles the shared `label-caps` heading treatment.
- `src/components/ui/sonner.tsx`: theme-aware `toastOptions.classNames` using semantic tokens (`bg-card`, `border-border`, `text-foreground`), `position="bottom-right"`, per-variant left border via `classNames.success/warning/error`, `closeButton`, `duration` bump for errors. Already mounted once in `src/routes/__root.tsx`.
- `src/components/verification/VerificationPanel.tsx`: header action calling the existing `startVerification` server fn per entry in `checks` sequentially, with a `rerunning` state; no schema or gate changes.
