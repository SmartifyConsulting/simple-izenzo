# Cancellation email copy + missing Holarc Health offer email (BID9533366)

## What I found
- **BID9533366** (bidder: Izenzo, created by info@georgiaadams.co.za) has Holarc Health (Pty) Ltd chosen, with contact support@holarchealth.com. Proof of Intent was sealed at 20:13.
- The counterparty was **never emailed**: its "invited" timestamp is empty, and Holarc has no Inbox notification for this deal.
- The match email is currently sent from the browser, and only after sealing, and only if the "chosen counterparty" lookup had already loaded on screen. Here the counterparty was chosen 20 seconds before the seal and chosen again at 20:15. The likely cause is that the send was skipped because the lookup was stale or empty, but this isn't confirmed yet.
- **It doesn't show in All Trades for Holarc** because the deal only becomes visible to Holarc once they open the link in the email ("claim" it). No email means no link, which means no visibility. For the bidder it is listed under All.

## Changes

### 1. Cancellation email: new copy
Send it from **Izenzo Trading**, name the **counterparty company** (not the person), and include the **BID/OFF ID**.
- Subject: `BID9533366 has been cancelled`
- Body:
  > Dear Holarc Health (Pty) Ltd,
  >
  > Izenzo has withdrawn bid **BID9533366** (Medical supplies). The opportunity is now closed on the Izenzo Trading Gateway. No further action is needed from you, and no tokens have been charged to your account for this bid.
  >
  > Thank you for your time and consideration. We look forward to matching you with future opportunities.
  >
  > Kind regards,
  > **Izenzo Trading**
- The Inbox notification uses the same wording. The cancelling side is named by **organisation**, and the email is addressed to the counterparty's organisation name. The sign-off is always "Izenzo Trading".
- Counterparties are also reached through the organisation contact address when no personal profile email matches. This is the same fallback the match notification already uses.

### 2. Reliable match email once Proof of Intent is sealed
- Move the "you've been matched" send so it runs on the server as part of sealing Proof of Intent. The server looks up the chosen counterparty itself instead of relying on what was loaded on screen.
- Keep it idempotent: skip the send if that counterparty has already been invited.
- If the chosen party changes after sealing, email the newly chosen party.
- Log the outcome (sent, no address, or email not connected) as a deal event, so a missed email is visible in the deal history instead of disappearing silently.

### 3. Fix BID9533366 now
- Check the email logs and server logs for a failed send at 20:13 to confirm the cause.
- Re-send the match email to support@holarchealth.com and write Holarc's Inbox notification with the claim link. Once Holarc opens it, the deal appears in their All Trades.

## Technical details
- `src/lib/cancelBid.functions.ts`: new subject/body, actor org name, counterparty org name greeting, org `primary_contact_email` fallback, and the reference in the subject.
- `src/lib/counterpartyOutreach.functions.ts`: extract the send into a shared server helper and call it from the POI seal server function (`sealProofOfIntent`) and from choosing a counterparty after POI is sealed; add an `invited_at` guard and an event row.
- `src/components/steps/StepScreen.tsx`: remove the client-side `notifyChosen` call after seal; keep the toast based on the returned result.
- One-off: invoke the send for counterparty Holarc on tx `9a74048a-…` after deploy.
- No RLS changes. Holarc's visibility still comes only through the claim link.
