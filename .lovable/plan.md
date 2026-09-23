# Two fixes: tabs that keep coming back, and searching again

## Part 1 — Why tabs keep coming back

The tab strip does not remember what you left open. On every sign-in it fetches your
10 most recent bids and puts them back as tabs. Your account has 46 bids that are not
cancelled, so there is always a fresh set of 10 waiting to reappear.

Closing a tab is remembered only in the browser you closed it in — nothing is stored
against your account. So the closed tabs come back whenever you sign in from another
browser or device, in a private window, on the published site instead of the preview,
or after clearing browsing data.

### What will change

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

## Part 2 — Searching works again, temporarily on Lovable's AI

The OpenAI account attached to the app has no credit left, so every search and document
read is refused. Until credit is added there, Find Counterparties switches back to
Lovable's built-in AI so searching works today.

- Find Counterparties (the normal search) moves to Lovable's built-in AI now.
- AI+ Search stays on the OpenAI account for now and moves across in a second step,
  once the normal search is confirmed working.
- This is a temporary arrangement and reversible: the saved OpenAI credential stays in
  place, and switching back is a single change once that account has credit.
- Worth knowing: while this is in force, AI usage draws on your Lovable credits rather
  than the client's OpenAI account.

## Technical detail

Tabs
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
  dropping cancelled ones. `hydrate` restores exactly that set. Tab order persists too.

Search provider
- `src/lib/izenzo.functions.ts` / `src/lib/counterpartyPipeline.server.ts`: the AI
  provider becomes a single switch rather than a hardcoded OpenAI call. The `ai` search
  path routes to the Lovable AI Gateway (`openai/gpt-6-astra` with reasoning, streamed,
  `LOVABLE_API_KEY` server-side only); the `ai_plus` path keeps its current OpenAI call
  until the follow-up step.
- Web page fetching stays on Tavily, which is unaffected — only the reading and scoring
  of those pages changes provider.
- Failure wording keeps both cases distinct: no credit on the OpenAI account, and the
  Lovable workspace AI limit being reached.
- Governance is untouched: AI+ stays advisory only, decisions stay attributed to people,
  POI stays immutable, WaD stays mandatory.
- Verified afterwards: typecheck, the 22 existing automated checks, a clean build, one
  live search on the golf-ball bid, and a signed-in check that a closed tab stays closed
  across sign-out and sign-in.
