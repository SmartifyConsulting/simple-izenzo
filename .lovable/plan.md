# Counterparty email: scrape the company website first, then send the normal email to every address

## What changes

1. **New lookup order for the counterparty's address**
   1. In app: the company is registered on Izenzo. Use its contact address, and don't guess any others.
   2. **Company website, scraped first:** read the company's own website (finding it first if we don't have it yet) and use the email address it publishes.
   3. Web scrape: an address picked up earlier during the counterparty search.
   4. Guessed: if none of the above finds an address, guess up to 4 likely addresses from the company's web address.

2. **Same normal email for every address.** Every counterparty address gets the exact regular counterparty invitation: the same subject, deal details, sign-up button and "Regards, Izenzo Trading". That includes each of the 4 guessed addresses. Each guessed address gets its own separate email, so the recipients never see each other's addresses.

3. **Testing note stays.** While we're testing, each email shows a small line in brackets saying where the address came from: In app, Company website (with the web address), Web scrape, or Guessed.

4. **Bidder summary.** When addresses are guessed, the bidder still gets the short summary listing the addresses that were emailed. The deal history records them too.

## Technical details

- In `src/lib/counterpartyOutreach.functions.ts` (`inviteCounterparty` flow):
  - Move the website search and site read (`findOfficialWebsite` and `readContactFromSite`) so they run before falling back to the saved `cp.contact_email`.
  - The saved address is used only when the site doesn't publish one.
  - Keep the registered in-app organisation as the first choice.
- Keep the shared `regularCounterpartyHtml(sourceNote)` for confirmed and guessed sends. Guesses are sent one at a time with `to: guess`. A failed send is logged and doesn't stop the rest.
- Remove the guessed addresses from the bidder email's bcc. The bidder email becomes a summary only, bcc'd to the admin.
- No changes to the database, security checks, or workflow gates.
