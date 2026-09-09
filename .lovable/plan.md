# Restore the black home page hero

Bring back the dark hero you saw earlier, using the copy from the screenshot, and keep the two frames idea: "Create a Bid" on the left, "Respond to a Bid" on the right.

## What changes

- The top of the home page goes black again, with the headline "Governance Infrastructure for Institutional Trade." and the paragraph "One cryptographic network. Access it via our turnkey Trade Desk, manage risk through the Compliance Profile, or build directly on the API. All backed by hash-sealed, independently verifiable execution."

- A "Request a Demo" button sits under the text, as in the screenshot.
- Below the headline, two glass panels side by side: left "Create a Bid" (starts a bid), right "Respond to a Bid" (browse and respond). On a phone they stack, bid first.
- The rest of the page (menu, the three explanation blocks, footer) stays as it is.

## Not changing

- Sign-in, deals, tokens, permissions, database and workflow rules all stay exactly as they are.
- Signed-in visitors still go straight to the deal canvas.

## Technical notes

- Edit `src/routes/index.tsx` only: hero section switches from the light `from-primary/5` gradient to the dark ink ground used by the app shell, with the two-frame grid replacing the centered CTA row.
- Frames link to `/auth` with `mode: "signup"` and a `next` of `/transactions/new` (create) and `/dashboard` (respond), so the existing auth flow is unchanged.
- Colors come from existing tokens (`--sidebar`/ink surfaces), no hardcoded hex.

## One thing to confirm

You mentioned an attachment, but no new file came through on that message — I'm working from the earlier black-hero screenshot. If you meant a different image, re-attach it and I'll match that instead.
