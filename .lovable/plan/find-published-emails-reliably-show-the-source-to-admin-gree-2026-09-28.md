# Find published emails reliably, show the source to Admin, greet Admin properly

## Why SeedAxis's email was missed

The counterparty record already has the website https://seedaxis.co.za, and info@seedaxis.co.za is printed right on its home page. The app never actually opened the website, though. It ran a web search limited to that site for "contact email phone" and read only the short snippets that came back. Those snippets didn't include the address, so the app decided nothing was published and fell back to guessing. (By coincidence, one of the guesses was the real address.)

## What changes

1. **Read the website itself first.** Before any search, the app opens the company's home page and its contact pages, including any link with "contact" in it (such as contact.html), plus /contact and /contact-us. It picks up every email address printed there, including clickable "mailto" links.
   - Addresses at the company's own domain come first, and info@, sales@ and contact@ are preferred over personal addresses.
   - When an address is found this way, no search or guessing happens, and the email is labelled "Company website: found on <page address>".
2. **Search only as a backup.** If the pages can't be opened or show no address, the existing site search runs next. Guessing stays the last resort.
3. **Show the source to Admin.** The Admin and bidder summary emails now include the same bracketed testing line as the counterparty email, for example "(Testing only — email address source: Guessed …)". Every outreach email then states where the address came from, not just the invitation the counterparty receives.
4. **"Hello Admin".** Emails that go to the admin inbox (support@izenzo.co.za) open with "Hello Admin," instead of "Hello,". The bidder's own copy keeps its normal greeting.
   - The admin now gets a separate copy rather than a blind copy, so the greeting can be different.

## Technical details

- In `src/lib/counterpartyOutreach.functions.ts`, add `scrapeSiteEmails(website)`:
  - Fetch the home page with `fetch`, using the existing Firecrawl `fetchPageText` fallback from `firecrawl.server.ts` for pages that need a browser.
  - Collect same-host links that contain "contact", plus `/contact` and `/contact-us`, up to 4 pages with a 10-second timeout each.
  - Regex-match emails and `mailto:` links, remove duplicates, and rank them: own domain first, then role addresses first.
- Call `scrapeSiteEmails` at the start of `readContactFromSite`. Return straight away with the page it was found on, so it's used by `enrichCounterparty`, `findCounterpartyContact` and the outreach send.
- Admin summary: stop bcc'ing `ADMIN_EMAIL`. Send a separate copy that opens "Hello Admin," and includes the source line.
- Other admin-only emails that go to `ADMIN_EMAIL` or support@izenzo.co.za (the ops alerts in `opsAlerts.server.ts` and the no-contact notice) get the same "Hello Admin," greeting.
- No changes to the database or security.
