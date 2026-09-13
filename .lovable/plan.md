# Fix Proof of Intent styling and sealing

You are not doing anything wrong. Two older implementation details are overriding the current workflow: the Proof of Intent title inherits a different heading font, and the seal action still looks for an obsolete `media_scanned` record instead of trusting the completed Step 1 flow.

## Changes

1. **Match the Proof of Intent heading exactly**
   - Give Proof of Intent the same font family, small-caps treatment, size, weight, spacing, and colour as the `LIVE WORKSPACE` and `BID INFORMATION` labels.
   - Apply the same explicit heading style to the later workflow frames so their appearance does not vary based on whether the label is rendered as a heading, paragraph, or button.

2. **Remove the obsolete screening blocker**
   - Remove the Proof of Intent client-side check for the old `media_scanned` event.
   - Remove the matching server-side blocker so sealing does not fail after Online Media Screening and Background Screening have already been completed in Step 1.
   - Keep the valid gates: Intent must be confirmed, the Proof of Intent must not already be sealed, and the organisation must have at least one token.

3. **Keep token charging intact**
   - Seal Proof of Intent continues to cost one token.
   - With the displayed balance of three tokens, the button will be available after confirmed Intent and the balance will become two after a successful seal.
   - Preserve certificate creation, attachment filing, and progression to Without a Doubt.

4. **Verify the sealing action**
   - Confirm the Proof of Intent heading visually matches the workspace labels.
   - Open a bid that completed Step 1, confirm the blocker message is gone, seal with three tokens, and verify the certificate is attached and the workflow advances.
   - Confirm the app still blocks sealing before Intent confirmation and when the balance is below one token.

5. **Make the token cost unmistakable on the Seal button**
   - Change the balance chip beside Seal Proof of Intent to read `Your balance: 3 tokens` so it cannot be mistaken for the price.
   - Show the price separately and explicitly as a one-token cost next to the action.
   - Keep the shortfall warning and Buy tokens link when the balance is below the cost.

6. **Restore pulsing after choosing another party**
   - After reopening the list and selecting a party again, the workflow must register that a choice exists again, instead of staying stuck on Choice.
   - Online Media Screening must pulse while it runs, then tick; Background Screening must then pulse while it runs, then tick; then Intent, exactly as on the first pass.
   - Reopening the list must return the pulse to Choice until the new selection is made.

7. **Verify the re-selection path**
   - Reopen the choice, select another party, and confirm the pulse moves Choice, Online Media Screening, Background Screening, Intent in order, with each completed step ticked.
