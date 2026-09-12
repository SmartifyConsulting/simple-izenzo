# Getting unstuck from the identity check

## What is happening

The app will not let you past the "Verify your identity" window on any signed-in screen until an ID check has actually passed. When you press Start, the identity provider's page is asked to open — and inside the preview it refuses to load, which is the "verify.didit.me is blocked" message you saw. That provider deliberately refuses to display inside another site's frame, so you end up at a dead end with no way back into the app.

## What to change

1. Stop the check from locking you out
   - The identity window becomes closable: a clear "Do this later" action returns you to your workspace.
   - It still appears where identity genuinely matters (the compliance stage and the party gates), so nothing is waved through — you just are not blocked from looking around, testing search, or creating a trade.
   - Once a check passes, the window stops appearing and the verified badge shows as before.

2. Make the provider page actually open
   - Start opens the provider in a real new browser tab rather than something the preview can swallow.
   - If the browser or preview blocks that tab, the window shows the link itself with "Copy link" and "Open in a new tab", plus one plain line explaining the provider will not display inside the preview and must be opened in its own tab.
   - The same treatment for the existing "Continue" action on an in-progress check.

3. Say what went wrong, in words
   - If the provider is not connected, or has no workflow set up, the window says exactly that and points to Admin → Integrations instead of failing silently.
   - The refresh action keeps working so a result finished in the other tab lands back in the app.

## Technical notes

- `src/routes/_authenticated.tsx`: `needsIdentity` no longer hard-gates the subtree; the dialog gains a session-scoped dismissed state so it does not reopen on every navigation.
- `src/components/verification/VerifyIdentityDialog.tsx`: allow escape/outside close, add the "Do this later" footer action, keep auto-close on pass.
- `src/components/verification/VerificationPanel.tsx`: after `startVerification`, keep the returned URL in state; render an anchor with `target="_blank" rel="noopener noreferrer"` plus a copy-link button, and surface it whenever `window.open` returns null (popup blocked). Error text shown inline, not only as a toast.
- Gates that must still require a passed check (Without a Doubt / party gates in `live-deal-engine`) keep their existing rules unchanged.
