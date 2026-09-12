# Reconnect Bright Data with the new account

## What I found just now

- The API token works: the account lists one active zone, `izenzo_scraper` (Browser API type).
- The saved browser connection address still points at the old customer (`hl_f5f1b7f4`), and that one is refused with "Account is suspended".
- So live web searching stays blank until the new account's browser address is saved.

## What to do

1. Open a secure form so you can paste the new account's Browser API connection details (the `wss://brd-customer-...` address including its password). Nothing is shown back in chat.
2. Retest immediately: connect and load a test page through Bright Data, and confirm a real page title comes back.
3. Save the same details in Admin → Integrations → Web Scraping → Bright Data (token, browser address, zone names), so the app reads them from one place.
4. Re-run a real match search on a test bid and confirm findings and source links appear with real percentages instead of the sample-listings message.
5. If the new zone is not a Browser API zone, switch the search route to the zone type you created (Web Unlocker or SERP) and retest the same way.

## Where you find the address

In the Bright Data control panel, open the zone, then the access/connection details for Browser API. The username looks like `brd-customer-<new id>-zone-<zone name>`; the password sits next to it. Free-tier tokens are fine for this test.

## Notes

- If the retest still says suspended with the new customer ID, the block is on Bright Data's side and only they can lift it; everything else in the app is already wired.
