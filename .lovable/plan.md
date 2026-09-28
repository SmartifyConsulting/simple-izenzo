# Stop SeedAxis showing up three times on one bid

## What actually happened on BID9948162

The address was found. The main **SeedAxis** result has https://seedaxis.co.za and **info@seedaxis.co.za** saved on it.

The search also brought back two pages about SeedAxis and listed each one as its own company:
- "SeedAxis - GCC & Capability Enablement (site subpage)", which is a page on their own website
- "SeedAxis (Crunchbase profile)", which is their Crunchbase page

Neither extra entry has a website or email address saved, so they look like failures when you pick them in a demo. They are really the same company listed again.

## What changes

1. **Directory pages are never a separate company.** Crunchbase, LinkedIn, ZoomInfo, Bloomberg and similar pages about a company get merged into that company. If one of these pages shows an email address (such as Crunchbase showing info@seedaxis.co.za), the company can use that address.
2. **Pages from a company's own website are never a separate company.** A subpage of seedaxis.co.za gets merged into SeedAxis.
3. **One company, one entry.** Results are also grouped by the core company name (so "SeedAxis", "SeedAxis (…)" and "SeedAxis - …" become one). The entry with the website and email is kept.
4. **Clean up BID9948162** so your demo shows only the single SeedAxis entry with info@seedaxis.co.za. The two extra entries are removed. Nothing has been sent or chosen yet, so no signed or sealed records are affected.

## Technical details

- `src/lib/counterpartyPipeline.server.ts`: before saving candidates, run a merge step:
  - Group candidates by their registrable domain.
  - Map known directory hosts (crunchbase.com, linkedin.com, zoominfo.com, dnb.com, bloomberg.com, opencorporates.com, bizcommunity etc.) to the company name extracted from the page.
  - Also group by a name with bracketed/dash suffixes removed and lower-cased.
  - Keep the entry with the website or email. Carry over any email or phone found in a merged snippet, and record its source (web scrape) so the email's bracket note stays accurate.
- The Understand/verdict prompt must return only the organisation, never labels like "(Crunchbase profile)" or "(site subpage)".
- One data fix deletes the two extra `counterparties` rows on transaction `7f72a0b9-…` (invited_at is null, so nothing was sent).
- Add a unit test in `counterpartyPipeline.test.ts` with the three SeedAxis entries, checking they merge into one entry that keeps info@seedaxis.co.za.
- No changes to security or to the workflow gates.
