# Re-enter and verify the Bright Data endpoint

Bright Data is reachable from our servers, but the saved endpoint is still rejected with
"Wrong customer password" for account `hl_80d5a99e`, zone `izenzo_scraper`.

## Steps

1. Open the secure form again so you can paste the full endpoint line (the value never appears in
   chat or in the app):

   ```text
   wss://brd-customer-<id>-zone-<zone>:<password>@brd.superproxy.io:9222
   ```

   Use the zone page's copy button, or regenerate the password first and copy the fresh one. The
   zone must be a **Scraping Browser** zone — that is the only type that answers on port 9222.

2. Run a live check straight after saving: open a real page through Bright Data and confirm it
   returns text.

3. If it answers, test the two places it is used end to end:
   - Business Registry, "Look up website", on a real company.
   - The counterparty product-match check that reads a candidate's site.

4. Report exactly what the live pages returned. If it is rejected again, say what Bright Data
   answered rather than guessing — the likely remaining causes are a non-Scraping-Browser zone, or
   a paused / out-of-credit zone on the Bright Data side.

## Notes

No application code changes. The browser connection, registry lookup, and counterparty check are
already built. Nothing about the database, deal workflow, gates, tokens, or permissions is touched.
