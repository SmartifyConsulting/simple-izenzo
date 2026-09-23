# Why tabs keep coming back, and how to stop it

## What is actually happening

The tab strip does not remember what you left open. On every sign-in it fetches your
10 most recent bids and puts them back as tabs. Your account has 46 bids that are not
cancelled, so there is always a fresh set of 10 waiting to reappear.

Closing a tab is remembered only in the browser you closed it in — nothing is stored
against your account. So the closed tabs come back whenever you sign in from another
browser or device, in a private window, on the published site instead of the preview,
or after clearing browsing data.

## What will change

Tabs become something your account remembers, not something the browser guesses.

- Closing a tab records it against your account. It stays closed everywhere you sign in.
- Signing in restores only the tabs you actually left open — nothing else is added.
- The first time you sign in after this change, the strip starts empty (there is no
  earlier record of what was open). From then on it matches exactly what you left.
- Opening a bid from Search or My Trades opens it as a tab as it does now, and it stays
  open until you close it.
- "Close all" clears the strip for good, on every device.
- Nothing about the bids themselves changes: every bid stays saved, untouched, and
  reachable from Search and My Trades. Closing a tab is still only a view action.

## Technical detail

- New migration adding a per-user tab-state table (`user_workspace_tabs`: `user_id`,
  `transaction_id`, `state` open/closed, position, timestamps), with GRANTs for
  `authenticated` and `service_role` and RLS policies scoping every row to
  `auth.uid()`. No change to transactions, governance triggers or existing policies.
- `src/lib/dealWindows.tsx`: localStorage stays as the fast local cache and stays
  keyed per user, but open/close/reorder also write through to that table; the
  `izenzo:deal-windows-closed` key becomes a local mirror of the stored closed rows.
- `src/components/canvas/WorkspaceTaskbar.tsx`: the `taskbar-deals` query stops
  seeding the strip from the 10 newest transactions. It instead reads the user's
  stored open tabs and joins them to `transactions` for reference, name and status,
  dropping cancelled ones. `hydrate` restores exactly that set.
- Tab order is persisted too, so drag-to-reorder survives sign-out.
- Verified afterwards: typecheck, the existing automated checks, a clean build, and a
  signed-in check that closing a tab, signing out and signing back in leaves it closed.
