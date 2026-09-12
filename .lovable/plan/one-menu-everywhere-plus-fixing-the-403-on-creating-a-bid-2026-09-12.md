# Getting unstuck from the identity check

## What is happening

Right now the app will not let you past the "Verify your identity" window on any signed-in screen until an ID check has actually passed. When you press Start, the identity provider's page is asked to open — and inside the preview it refuses to load, which is the "verify.didit.me is blocked" message you saw. That provider deliberately refuses to display inside another site's frame, so in the preview you end up with a dead end and no way back into the app.

## What to change

1. Stop the check from locking you out
   - The identity window becomes closable: a clear "Do this later" action returns you to your workspace.
   - It still reappears where identity genuinely matters (the compliance stage and the party gates), so nothing gets waved through — you just are not blocked from looking around, testing search, or creating a trade.
   - Once a check passes, the window stops appearing and the verified badge shows as before.

2. Make the provider page actually open
   - The Start action opens the provider in a real new browser tab rather than something the preview can swallow.
   - If the browser or the preview blocks that tab, the window shows the link itself with a "Copy link" and "Open in a new tab" option, plus one plain line explaining that the provider will not display inside the preview and needs to be opened in its own tab.
   - The same treatment for the existing "Continue" action on an in-progress check.

3. Say what went wrong, in words
   - If the provider is not connected, or has no workflow set up, the window says exactly that and points to Admin → Integrations instead of failing silently.
   - The refresh action keeps working so a result completed in the other tab lands back in the app.

## Technical notes

- `src/routes/_authenticated.tsx`: `needsIdentity` no longer hard-gates the subtree; the dialog gains a dismissed state (session-scoped) so it does not re-open on every navigation within the session.
- `src/components/verification/VerifyIdentityDialog.tsx`: allow escape/outside close, add the "Do this later" footer action, keep auto-close on pass.
- `src/components/verification/VerificationPanel.tsx`: after `startVerification`, keep the returned URL in state; render an anchor with `target="_blank" rel="noopener noreferrer"` plus a copy-link button, and surface it whenever `window.open` returns null (popup blocked). Error text from `startVerification` shown inline, not only as a toast.
- Places that must still require a passed check (Without a Doubt / party gates in `live-deal-engine`) keep using the existing verification state — no change to their rules.
