# Six fixes: Bid Information, dark text, Izenzo verified, Exit row, KYC/KYB QR, counterparty names

## 1. Bid Information stays folded after the AI+ search
Once Bid Information has folded away, it must not open by itself again. That includes after the AI+ (shortlist) search finishes, and when results or counterparties refresh. Several places in the search code tell it to open when they should leave it alone or fold it.
- It only opens again when you click it, or when a search finds no matches so you can edit the search.

## 2. White text on dark backgrounds (Pre-Screening card)
In dark mode, the company-name pill, the ID line and the Authority to Act line on the Pre-Screening cards are dark or grey on a dark background. These become white, with a solid pill background, so they can be read. Light mode stays as it is.

## 3. Izenzo shows as Verified in Pre-Screening
Izenzo's account (info@georgiaadams.co.za) has its ID number and Authority to Act on file. However, its "identity verified" flag was never set, so no badge shows.
- **Data fix:** Mark that account as identity-verified, with a one-off update for this account only.
- **Rule fix:** A company account also counts as verified in Pre-Screening once both its ID number and its Authority to Act document are on file. This means other companies won't get stuck the same way.

## 4. Exit button on the same row as "Pay 3 tokens to unlock"
Before payment, the Without a Doubt footer shows one row: your balance, the cost, **Pay 3 tokens to unlock**, and **Exit** on the far right. Once paid, Exit returns to its normal place, with Continue beside it when both parties are verified.

## 5. KYC / KYB Start: QR code stays, and the status turns "In progress"
Clicking **Start** now sets that check to **In progress** straight away. The QR code stays visible until the check passes, fails or expires.
- The other party sees your check as "In progress" too.

## Technical details
- `src/routes/_authenticated.live-deal-engine.tsx:2160`: change `setBidInfoCollapsed(txId, false)` to `true` when `count > 0`. Also stop line 2109 from reopening the frame on a re-run once results already exist.
- `StepScreen.tsx` Pre-Screening cards (~2290–2330): add `dark:text-white` to the org pill (solid `bg-primary text-primary-foreground`) and the detail lines.
- `partyRegistration.functions.ts:94`: `identityVerified = profile.identity_verified || (id_number && authority document on file)` for company accounts. Add a migration updating `profiles.identity_verified = true` for `af30db32-0b50-4e72-9578-3532ee9de698`.
- `StepScreen.tsx` ~2337: move the WaD footer's Exit button into the `!wadUnlocked` pay row (`ml-auto`), and hide the duplicate footer Exit while unpaid.
- QR disappearing: `VerificationPanel` only renders the QR when `status === "in_progress"`, and it polls every 4s. The likely cause is that the status sync maps Didit's "Not Started" back to `pending`, which hides both the QR and the Start button. Confirm this against `mapDiditStatus` and the list/sync path.
  - Map "Not Started" and "In Progress" to `in_progress`.
  - Render the QR whenever `provider_url` exists and the status is `pending` or `in_progress`.
  - Show the "In progress" badge immediately after Start by writing to the query cache optimistically.
- Verify with Playwright: run a search on a fresh bid, and use the WaD frame on BID9720321 in both light and dark mode.
