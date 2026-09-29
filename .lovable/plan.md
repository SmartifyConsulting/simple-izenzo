# Registration last page, strict document check, home Sign up, Mac's last name

## 1. Last sign-up page: only Save and Close
- Remove the separate Save button on step 3. Save and Close becomes the single button.
- Save and Close checks the ID number and document. If they match, it saves and takes the person to the Live Workspace (or the deal they were invited to).
- If there's no document yet, it saves what's there and closes. The person stays blocked until a matching document is uploaded.

## 2. A wrong Authority to Act or Proof of Address never lets anyone through
Right now there are three ways past the check. That's how Mac Beth got through:
- If the document check itself fails or times out, it's treated as a pass.
- If the check can't read the document, it's treated as a pass.
- Once an ID number and a document are on file, the app counts registration as done, even when that document failed the check.

The fix:
- Registration only counts as done when the document has passed the check. A failed, unreadable or errored check keeps the person on the "Complete your registration" screen. That screen can't be closed, and it shows a clear message asking them to upload a matching document.
- Mac Beth's account will be put back on that screen. Other accounts whose documents never passed the check will be too. Before I change anything, I'll list them for you.

## 3. Sign up button at the top right of the home page
- Add a **Sign up** button next to **Sign in** at the top right when signed out. It opens the sign-up window.

## 4. Mac's last name missing
- First I'll look at Mac's saved account to find out why the last name is empty. The likely cause is that the last name typed on page 1 is lost after the confirmation email.
- Then I'll fix it so the last name is always saved from what was typed on page 1, and fill in Mac's missing last name.

## Technical details
- `SignUpForm.tsx` step 3: drop the outer Save and Close / Save pair. Give `AuthorityToActPanel` a `submitLabel="Save and Close"` prop, plus a close-without-document path.
- `AuthorityToActPanel.save()`: a catch or a `checked === false` result counts as a failure, not a pass. Set `onboarding_required=true` and `identity_verified=false`.
- `_authenticated.tsx`: `registrationIncomplete` also becomes true when `profile.identity_verified` is false and a document is on file. The dialog then blocks with no "Do this later". Leave the email-verify gate as it is.
- Last name: store `first_name`/`last_name` separately in signUp `user_metadata` and read them in step 2. Check Mac's `profiles` row and `auth.users` metadata with a read query first. Backfill with a data update, not a migration.
- `MainHeader.tsx`: add a second `SignInModal` with `defaultTab="signup"` and a filled "Sign up" button.
