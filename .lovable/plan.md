# Restore the upload outline and repair sign-in

## Confirmed findings

- The heavy upload outline comes from the recent `border-2 border-dashed` styling in the Bid Registration file-drop control.
- The header **Sign In** and **Start a Trade** controls both open the sign-in form correctly in a signed-out browser.
- The latest authentication records show successful password sign-ins and successful user/profile loading. The failure is therefore in the post-sign-in screen handoff or visible signed-in state, not a disabled account or rejected credentials.

## Changes

1. **Restore the lighter file-drop outline**
   - Revert the Bid Registration drop area from the bold two-pixel dashed border to the previous thin dashed border.
   - Keep its current size, wording, click-to-upload behavior, and drag highlight unchanged.

2. **Make every sign-in path use one reliable completion flow**
   - Keep the existing sign-in frame exactly as it is.
   - After email or Google authentication succeeds, wait until the saved session can be read back before changing screens.
   - Refresh the shared signed-in state and the protected-page check before opening the Live Workspace, preventing a successful login from being treated as signed out during the transition.
   - Preserve each button's intended destination: header sign-in and every **Start a Trade** button continue to land in the Live Workspace, including any description carried from the home page.
   - Keep errors inside the sign-in frame when authentication genuinely fails; do not close the frame or navigate on failure.

3. **Verify the complete result**
   - Test header **Sign In**, **Start a Trade**, and the standalone sign-in page from a fresh signed-out browser.
   - Confirm each successful sign-in opens the Live Workspace, the profile avatar replaces the sign-in controls, and the session remains after a refresh.
   - Confirm the Bid Registration upload area has a thin dashed outline and still supports click and drag-and-drop uploads.

## Technical details

- Limit the visual change to the Bid Registration drop control in `DealCanvas`.
- Consolidate post-authentication synchronization in the shared auth/form path rather than patching individual buttons.
- Do not edit the generated authentication client or its generated session-storage adapter.
