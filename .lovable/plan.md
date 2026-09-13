# Restore workflow accordions and Bid Registration layout

You are not doing anything wrong. These are implementation regressions: a completion shortcut replaced Step 1’s activity list, the active-step accordion only initializes once, Bid Information relies on late session-only state, and the bid title was placed in the wrong column.

## Changes

1. **Keep every Step 1 activity visible**
   - Remove the completed-step shortcut that replaces all finished sub-steps with one “Trading” row.
   - When Step 1 is manually expanded, always show every activity in order with its existing completed green tick, including Bid Registration, Submission of Documents, Search AI + AI+, Choice, Online Media Screening, Background Screening, and Intent.
   - Collapsing Step 1 hides those rows only until the user expands it again.

2. **Make the complete Step 1 heading green**
   - Once Intent is confirmed, colour both `Step 1` and `Trading` green.
   - Keep the green completion tick on the far right of the heading.
   - Keep the `+` / `−` marker so the completed step remains manually expandable.

3. **Automatically follow workflow progression**
   - When the workflow advances from one numbered step to the next, automatically collapse the completed step and expand the newly active step.
   - Keep all finished sub-steps available when a completed step is reopened.
   - Preserve manual `+` / `−` control after the automatic transition.

4. **Make Bid Information collapse reliably**
   - Collapse Bid Information immediately when Fetch Interest or another search starts.
   - For a bid that already has search results or has progressed beyond document submission, default Bid Information to collapsed when opened or refreshed instead of briefly showing it expanded.
   - Restore each bid’s saved accordion state before rendering its contents, preventing an open-state flash and preventing one bid’s state from affecting another.
   - Preserve manual reopening and closing after the automatic collapse.

5. **Restore the two-column Bid Registration layout**
   - Column 1: business identity, verification status, and Active Since.
   - Column 2: BID/Offer ID, bid name directly beneath it with wrapping and right alignment, registration date/time, and country.
   - Do not move or duplicate the bid name elsewhere.

6. **Verification**
   - Verify a completed Step 1 is collapsed and fully green with a right-side tick, then reopen it and confirm every completed activity remains visible and ticked.
   - Advance into Step 2 and confirm Step 1 closes while Step 2 opens automatically; repeat for the next available transition.
   - Run Fetch Interest and confirm Bid Information closes immediately, remains closed after refresh and bid-tab switching, and still opens manually.
   - Confirm the bid name appears only in column 2 beneath the BID/Offer ID at desktop and narrow widths.

7. **Match the Proof of Intent heading style to Bid Registration**
   - Give the Proof of Intent frame heading the same small-caps label styling, size, weight, letter spacing and colour as the Bid Registration heading.
   - Apply the same heading treatment to the frames that follow it (Without a Doubt, Execution, Finality and Memory) so no later frame heading reads larger or differently.
   - Colour, borders and layout otherwise stay as they are.
