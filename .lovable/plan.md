# Fill in the organisation email when "Same as login email" is ticked

## Problem
On sign-up step 2 (Organisation), "Same as login email" is ticked by default, but the Organisation email box stays empty. This happens when someone arrives at step 2 from the confirmation link in their email. The page has reloaded by then and has forgotten the email they typed in step 1. So the box looks blank and it's unclear which address the company will use.

## Changes
1. **Show the address:** when step 2 opens, fill in the signed-in person's email from their account. With the box ticked, the Organisation email then shows that address, greyed out.
2. **Unticking:** the box starts with the same address so the person can edit it, instead of starting empty.
3. **Saving:** if the box is unticked and left empty, the company's contact email falls back to the login email instead of being saved blank.
4. **Existing companies:** check for companies saved with no contact email. For each one, fill it in with the email of the person who registered it. This is test data, and I'll list what changed.

## Technical details
- `src/components/auth/SignUpForm.tsx`: add a `useEffect` that runs when `step >= 2`. It calls `supabase.auth.getUser()` and calls `setEmail(user.email)` if `email` is empty, and it also fills `orgEmail` if that is empty.
- In `onSubmit`, set `orgContactEmail = (orgEmailSameAsLogin ? email : orgEmail.trim()) || email`.
- Backfill: query `organisations` with a null or empty contact email. Take the address from the registering member's `profiles.email`, then update those rows with a data change (not a migration).
