# Deal ID, default view, and icon-only menu

## 1. Show the Bid / Offer ID in the Live Workspace

The Live Workspace panel on the right currently opens with just the "Live workspace" label.
Add the deal's reference (e.g. BID9089722 / OFR…) at the top right of that grid, on the same
line as the label, styled as a small pill so it reads as the record's identity. When no deal is
registered yet, the pill is simply absent.

## 2. Classic View becomes the default, and the logo returns to it

- On sign-in and on any new session the workflow opens in Classic View (the start node with the
  full workflow beneath it), not the Mahjong map.
- Clicking the Izenzo logo in the header goes to the workflow screen and puts it in the view the
  user is currently set to — defaulting to Classic View, so the start node and workflow are what
  you land on.
- The header toggle still switches between Classic and Mahjong, and that choice sticks for the
  browsing session.

## 3. Menu icons lose their text labels

Across every screen the header nav becomes icon-only for consistency: the view toggle drops its
"Classic View" / "Mahjong View" wording and shows only its icon. Pricing, API, Report, Inbox and
tokens already show icons alone. Every icon keeps a hover tooltip and an accessible label so its
meaning stays discoverable.

## Technical notes

- `src/lib/viewMode.ts`: flip the stored/default value from `mahjong` to `classic` (initial read,
  fallback, and the `useSyncExternalStore` server snapshot).
- `src/components/layout/AppShell.tsx`: logo `Link` calls `setViewMode("classic")` only when no
  session preference is stored; toggle button renders the icon with `title`/`aria-label` and no
  text child.
- `src/routes/_authenticated.live-deal-engine.tsx`: in the Live Workspace panel header, wrap the
  `label-caps` line in a flex row and render `dealTx?.reference` as a right-aligned pill.
