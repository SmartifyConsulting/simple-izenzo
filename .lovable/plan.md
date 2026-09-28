# Home page search bar should open the Live Workspace

## Your email question (BID9539262)

At 15:24 (Johannesburg time) today, support@izenzo.co.za was blind-copied on the bidder's summary email "Reaching out to SeedAxis on your behalf". It said SeedAxis couldn't be found in the app, on file from the web scrape, or published on their own website. It also said the standard counterparty invitation had been sent to these 4 guessed addresses:
- info@seedaxis.co.za
- sales@seedaxis.co.za
- contact@seedaxis.co.za
- trade@seedaxis.co.za

Each of those 4 addresses received its own copy of the normal counterparty invitation. support@izenzo.co.za did not get those four copies.

## Send copies of both BID9539262 emails to info@georgiaadams.co.za

The app doesn't keep copies of emails after they go out, so the originals can't be forwarded. Instead, a one-off send will rebuild both emails exactly as they went out and send them to info@georgiaadams.co.za only:
1. The bidder summary email "Reaching out to SeedAxis on your behalf", listing the 4 guessed addresses.
2. The normal counterparty invitation for BID9539262 exactly as it went to info@seedaxis.co.za, including the testing note "Guessed" in brackets.

Each subject starts with "[Copy]" so they're easy to tell apart from the real emails. Both sends are recorded in the deal history. Nothing is sent to SeedAxis or the bidder again.

## Fix: the search bar doesn't open a Live Workspace

When you're signed in and press search on the home page, the app should take you to a new Live Workspace. It should carry over what you typed and any files you added. That isn't happening, and the cause hasn't been confirmed yet.

1. **Reproduce it:** sign in to the preview, type a request in the home search bar, press search, and record which page you land on and any errors.
2. **Fix the confirmed cause.** Likely suspects to rule in or out:
   - the search button isn't triggering the move to the workspace, for example the form reloads the page;
   - the move happens, but the home page's sign-in redirect sends you straight back;
   - the workspace opens but ignores the typed text, so it looks as if nothing happened.
3. **Make sure the workspace always opens:** pressing search, or pressing Enter in the bar, opens a new Live Workspace with the text filled in and the search started. Step 1 · Trading shows Bid Registration and Bid Information, and it keeps the files you added.
4. **Signed-out visitors:** keep today's behaviour, which shows preview results with the Sign In / Sign Up buttons. After signing in, you continue straight into the Live Workspace.
5. **Check it:** repeat the test after the fix and confirm the workspace opens with the search running.

## Technical details

- Home search: `src/components/marketing/HeroMatchCard.tsx`, `onFindMatches()`. This navigates to `/live-deal-engine` with `{ fresh: true, seed }`.
- Receiving side: `src/routes/_authenticated.live-deal-engine.tsx`. `validateSearch` accepts `seed` and `fresh`, and `seed` is consumed around lines 271–310.
- Also check the `useEffect` redirect in `src/routes/_public.index.tsx` (around lines 181–200), plus whether the submit button is `type="submit"` inside a form without `preventDefault`.
- No changes to the database or security.
