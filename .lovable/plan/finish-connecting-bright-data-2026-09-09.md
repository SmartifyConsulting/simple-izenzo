# Finish connecting Bright Data

Removing the IP restriction worked — Bright Data now accepts requests from our servers. It is
rejecting the saved password instead:

```text
407 Wrong customer password
```

So the endpoint value currently saved is either from a different zone, was regenerated since, or
was copied with a character missing.

## What happens next

1. In Bright Data, open the **Scraping Browser / Browser API** zone and copy the full endpoint
   shown under the zone's access details. It looks like:

   ```text
   wss://brd-customer-<id>-zone-<zone>:<password>@brd.superproxy.io:9222
   ```

   Copy the whole line, including everything between `//` and `@`.

2. You re-enter it in a secure form (the value is never shown in chat or in the app).

3. I re-run the live check against Bright Data and confirm it answers.

4. Once it answers, I test the two places it is used end to end:
   - **Business Registry → Look up website** on a real company address.
   - The counterparty product-match check that reads a candidate's site.

5. I report back with what the live pages returned.

## Notes

No application code needs to change — the browser connection, the registry lookup, and the
counterparty check are already built and building cleanly. Nothing about the database, deal
workflow, gates, tokens, or permissions is touched.

If the new value is also rejected, the likely cause is that the zone is paused or out of credit
on the Bright Data side, and I will say so rather than guess.
