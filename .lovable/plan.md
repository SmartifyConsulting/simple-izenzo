# Fix workflow completion and Live Workspace scrolling

## Changes

1. **Show Step 1 completion on its collapsed heading**
   - Treat confirmed Intent as the authoritative completion of every Trading sub-step.
   - Turn `Step 1 · Trading` green when Intent is confirmed.
   - Add a green tick at the far right of the Step 1 heading so completion remains visible while its sub-tasks are collapsed.
   - Keep the normal `+` / `−` accordion marker for expanding and collapsing the step.

2. **Make Bid Information a reliable accordion**
   - Replace the current default-open/session-only behavior with state initialized for the selected bid before the section is displayed.
   - Collapse it immediately when Fetch Interest or any search starts.
   - Keep it collapsed when returning to a bid that already has search results, without a brief open-state flash.
   - Preserve manual `+` / `−` reopening and closing after the automatic collapse.
   - Ensure switching bid tabs cannot carry another bid’s accordion state into the selected bid.

3. **Make Bid Registration a truly opaque pinned header**
   - Move the sticky behavior to an opaque full-width wrapper at the top of the Live Workspace scrolling area.
   - Include the workspace heading/top spacing in that pinned surface so there is no exposed gap above the Bid Registration frame.
   - Remove translucent styling from the complete pinned region and prevent content from appearing through rounded corners or above it while scrolling.
   - Keep the Bid Registration details and two-column layout unchanged.

4. **Verification**
   - Confirm Intent and verify Step 1 turns green with a right-side tick both expanded and collapsed.
   - Run Fetch Interest, verify Bid Information closes immediately, remains closed after refresh/tab switching, and can still be reopened manually.
   - Scroll the full Live Workspace and verify no content appears through or above the pinned Bid Registration area in both light and dark modes.

5. **Consistent typography from Proof of Intent onward**
   - Match the font sizes used in Bid Information (small caps section label, small body text, compact list items) across the Proof of Intent frame and every frame that follows it (Without a Doubt, Execution, Finality and Memory panels).
   - Keep headings, body copy and list text at the same sizes and line spacing as Bid Information, so no later frame reads noticeably larger or smaller.
   - Colour, borders and layout stay as they are — this is a text-size alignment only.
