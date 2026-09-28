# Two-company test user, verified badge, wizard Save and Close, friendlier emails, admin user management

## 1. Test user with two companies (kept after testing)
- Create a test person, e.g. "Test Twoorg" with login email `test.twoorg@georgiaadams.co.za`.
- Create two test companies for that person:
  - **Twoorg Alpha**: company email `alpha@georgiaadams.co.za`
  - **Twoorg Beta**: company email `beta@georgiaadams.co.za`
- Leave the person and both companies in place so you can look at them yourself.
- Give you a simple table showing the login email, the first company's email and the second company's email, and which email each screen and each email message uses.
- On a test bid, pick each company as the counterparty in turn. Check that the Live Workspace shows the correct company name each time and shows the Verified badge only when that company is verified. Include screenshots.

## 2. Verified badge (e.g. SeedAxis)
- First, find out why SeedAxis passed registration checks but doesn't show as Verified. A likely reason is that the badge reads the verification of the wrong person or company. I'll confirm the real cause before changing anything.
- Make the badge on the Live Workspace, the search results and the counterparty cards show the chosen company's own verified status.

## 3. Save and Close on the last sign-up page
- Add a **Save and Close** button beside the finish button on the last step of the sign-up wizard. It saves what's been entered so far and closes the wizard. The person can finish uploading documents later from Account settings.

## 4. Friendlier emails
- Rewrite the "Verified and Linked" email as a short, warm, marketing-style note. It tells the counterparty their account is linked and invites them to view the Offer online, with one clear button.
- Tidy the wording of the other emails (match invitation, cancellation, bidder summary) to match: plain greeting, short paragraphs, one clear action, and "Kind regards, Izenzo Trading". The testing-only source notes and "Hello Admin," stay.

## 5. Admins manage users
- In Admin, Users tab: add **Add user**, **Edit** (name, email, contact number, company, roles) and **Delete** (with a confirmation step) for admins.
- The system admin account stays hidden and protected.
- Sort the user list alphabetically by name.

## Technical details
- Test data: create the auth user with the admin client via a one-off server function, or through the sign-up flow with Playwright. Insert `organisations` (with `primary_contact_email`) and `org_members` rows through data queries, not migrations.
- Badge: trace the `identity_verified` source in `DealCanvas`/`live-deal-engine`/`CounterpartyWorkspaceView` against `counterparty_org_id` and org members.
- Save and Close: `SignUpForm.tsx` step 3 saves the profile, calls `endRegistration()` and closes the modal.
- Emails: edit the templates in `counterpartyOutreach.functions.ts`, `counterpartyClaim.functions.ts`, `bidderNotify.server.ts` and `matchNotify.server.ts`.
- User CRUD: new admin-only server functions (checking the role with `has_role` through the caller's client, then using `supabaseAdmin` for the Auth Admin create/update/delete calls), wired into `UsersTab` in `_authenticated.admin.tsx`. Sort with `localeCompare`. Roles stay in `user_roles`.
