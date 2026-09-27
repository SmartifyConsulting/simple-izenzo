# KYC / KYB card polish + Start shows QR

## What changes
1. **Grey pill headings** — the "KYC" and "KYB" titles on each check card become solid grey pills (light grey in light mode, dark grey with white text in dark mode), with the "Both verified" badge still beside them.
2. **Blue (other party) pill, dark mode** — solid royal blue background with white text.
3. **Green (your company) pill, dark mode** — solid green background with white text. Light mode stays as it is.
4. **Start shows the QR code** — pressing Start on KYC shows the KYC QR code, and Start on KYB shows the KYB QR code, straight away in that card. The check then shows "In progress". The QR stays up until the check passes, fails or expires.

## Technical details
- File: `src/components/verification/VerificationPanel.tsx`.
- Heading: wrap `CHECK_LABEL[type]` in a `rounded-full bg-muted px-3 py-1 dark:bg-neutral-700 dark:text-white` pill.
- Blue badges (lines 244, 257): add `dark:bg-[#4169e1] dark:text-white`. Green badge (275): add `dark:bg-emerald-600 dark:text-white`.
- QR: keep the `provider_url` returned by `startVerification` in local state per check type (`startedUrl[type]`) and render the QR from `myRow?.provider_url ?? startedUrl[type]`, so a stale or slow refetch can't hide it. Hide the Start button while a URL exists and status isn't passed/failed/expired. Confirm `startVerification` returns the URL; if not, return it from the handler (no schema change).
- Verify with Playwright on BID9720321 in dark mode: press Start, confirm QR stays after several polls.
