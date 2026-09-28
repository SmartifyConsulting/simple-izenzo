# Email links, registration, verification and search fixes

## 1. BID/OFFER links in emails go straight to the Live Workspace
- Existing users who click a BID or OFFER ID in an email open that deal's Live Workspace. If they're signed out, they sign in first and then land on the deal.
- New users (counterparty invitations) get the link carried through sign-up. When they press **Save and Close** on the last registration page, they go to that deal's Live Workspace instead of the home page.
- Access rules stay the same: the invitation still links the new company to the deal before the workspace opens.

## 2. A failed identity check blocks the user
- If the verification says the document didn't match, the user can't finish registration. They stay on the verification step with a clear message and a **Try again** button.
- The username and full name are saved to the profile at step 1, so nothing is lost if verification fails.
- A user who is already signed in but not verified sees a **Verify now** banner that reopens the verification step. They can't trade until they're verified.

## 3. Profile Settings > Organisations
- Remove the **Join with code** button and the invite-code chip.
- Each company shows a green **Verified** badge. If it isn't verified, it shows a **Verify now** button that opens verification for that company.

## 4. Why Pokemon Fashions was not picked on BID9179355
- The company is registered as "Pokemon Fashions Pty Ltd" with a plain "e". The bid's title spells it "Pokémon", with an accent.
- The search of registered companies matches text letter for letter, so "Pokémon" never matched "Pokemon", and the company was skipped. Earlier misses came from the same kind of spelling gap.
- Fix: ignore accents and case on both sides when searching registered companies, so "Pokémon" and "Pokemon" count as the same word. I'll add a test for this and rerun the search on BID9179355.

## Technical details
- Email links: the deal URL is built in `bidderNotify.server.ts` and `counterpartyOutreach.functions.ts`. It becomes `/deal/$id` for existing users, and a `next` value is added to the claim and sign-up links. `SignUpForm` Save and Close goes to `safeNext(next)`, with `/` as the fallback.
- Verification: gate step completion in `SignUpForm` on a passed result. Store `username`/`full_name` in the step 1 profile upsert. Add a retry state. Add a Verify-now entry point that uses the existing verification flow and never writes a passed record by itself.
- Organisations: `OrganisationsPanel.tsx` removes the join form and code. The verified status comes from `getPartyRegistrationInfo`, per organisation.
- Search: `izenzo.functions.ts`, around line 797. Normalise terms with NFD and strip diacritics. Keep the database `ilike` but add unaccented term variants. Also normalise inside `localOrgCandidates` and `relevance` matching.
