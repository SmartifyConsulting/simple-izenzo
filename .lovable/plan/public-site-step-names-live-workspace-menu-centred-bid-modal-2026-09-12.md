# Public site: step names, Live Workspace menu, centred bid modal

## 1. Rename the How it Works steps

On the How It Works page, change the step titles:

- Step 1: "Find & Match" becomes **Find, Match & Verify**
- Step 2: "Verify" becomes **Engage**
- Step 4: "Settle" becomes **Finalize**

Steps 3 ("Deliver") and 5 ("Remember") stay as they are. The supporting
sentence under step 1 also mentions verification now, and step 2's sentence is
reworded to describe engaging with the chosen party and agreeing terms, so the
text matches the new names.

## 2. Add a "Live Workspace" menu item

Add **Live Workspace** as the first item in the top menu, immediately before
About, on every public page. It opens the live workspace. A visitor who is not
signed in is taken to sign-in first and lands in the workspace afterwards.

The existing "Live workspace" button next to the avatar stays for signed-in
users.

## 3. Make the Submit a Bid pop-up centred and larger

Today the pop-up appears tucked against the top-right of the page. It will:

- open centred in the middle of the screen
- be about 40% wider than now, with a matching increase in the space inside it
- stay scrollable on small screens so nothing is cut off
- keep the same light see-through backdrop and close button

This applies everywhere the Submit a Bid button appears, since they all share
one pop-up.

## Technical notes

- `src/routes/alpha-bravo.how-it-works.tsx` — update `STAGE_COPY` titles/bodies
  for `trading`, `compliance`, `finality`.
- `src/components/layout/AlphaBravoShell.tsx` — prepend
  `{ to: "/live-deal-engine", label: "Live Workspace" }` to `NAV`. `NAV` is
  typed `as const` and rendered with `<Link to={item.to}>`, so the added path
  must be an existing route (`src/routes/live-deal-engine.tsx`); auth gating is
  already handled by that route.
- `src/components/marketing/SubmitBidButton.tsx` — replace the
  `fixed right-5 top-24 max-w-sm` positioning on `DialogPrimitive.Content` with
  centred positioning (`left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`),
  `max-w-xl`, `max-h-[85vh] overflow-y-auto`, and keep the existing animation
  classes. No change to `HeroMatchCard` behaviour.

## 4. Fix: uploading files in the pop-up returns no results

Confirmed cause: the upload card asks for rows from the private counterparty
table, which holds no rows and is not readable by signed-out visitors — so the
list comes back empty every time, whatever is uploaded.

Fix: point the preview at the public directory that now has content (the same
source the Responders page reads), showing the top 5 with the total count and
the ellipsis to see all. If that directory is ever empty too, the card says so
plainly instead of showing a blank result.

Technical notes for this section:

- `src/components/marketing/HeroMatchCard.tsx` — `useIllustrativeMatches`
  switches from `counterparties` to `responder_listings` filtered on
  `published = true`, selecting `id, name, sector, jurisdiction, source,
  is_example, verified_at`, ordered newest first, `limit(5)` with
  `{ count: "exact" }`.
- Band/label mapping moves off `rating_band` onto the directory's own
  verified / registered / unclaimed derivation used by `ResponderDirectory`.
- Add an explicit empty state when `total === 0`.
