# Stop SeedAxis showing up three times on one bid

## What actually happened on BID9948162

- **SeedAxis did come up in the first AI search.** It found 3 results in 29 seconds, and all 3 were SeedAxis:
  1. "SeedAxis", with https://seedaxis.co.za and **info@seedaxis.co.za** saved
  2. "SeedAxis (Crunchbase profile)", with no website or email
  3. "SeedAxis - GCC & Capability Enablement (site subpage)", with no website or email
- The Crunchbase entry was chosen and sealed into the Proof of Intent. It had no address, so nothing was sent. The app recorded "No registered account, website or contact address found for SeedAxis (Crunchbase profile)".
- The address was found, but on a different entry from the one that was chosen.
- The second search, AI+, found nothing new. This is expected: SeedAxis was already on the list, so it was left out.

## What changes

1. **Directory pages are never a separate company.** Pages about a company on Crunchbase, LinkedIn, ZoomInfo, Bloomberg and similar sites are merged into that company. If one of these pages shows an email address, the company uses it.
2. **Pages from a company's own website are never a separate company.** For example, a subpage of seedaxis.co.za is merged into SeedAxis.
3. **One company, one entry.** Names with added labels, like "SeedAxis (…)" or "SeedAxis - …", are merged into a single entry. The entry that has the website and email is kept.
4. **Backup before "no contact found".** If a chosen company has no address, the app first checks the other results on the same bid for that company's website or email. Only then does it search the web or guess.
5. **Rescue BID9948162.** The Proof of Intent can't be changed once sealed, so it stays as it is. The app copies the SeedAxis website and info@seedaxis.co.za onto the chosen entry and sends the normal counterparty invitation. Your bracketed source note will show "Company website".

## "Hello Admin" and the missing email

- **Why nothing went to SeedAxis:** the chosen entry, the Crunchbase copy, had no address. The app sent only the "We couldn't find contact details" notice to you and Admin. Point 5 above fixes this deal.
- **Why the admin email still says "Hello,":** "Hello Admin," is in the latest version, but your live site hasn't been published since. Your demo ran on the live site, so it still sends the old wording.
- **Fix:** publish after this change, so the live site gets "Hello Admin,", the source notes in brackets, and the SeedAxis fixes. After publishing, I'll check the email records to confirm the Admin copy arrives with the right greeting.

## Technical details

- `src/lib/counterpartyPipeline.server.ts`: add a merge step before candidates are saved.
  - Group candidates by registrable domain.
  - Match known directory hosts (crunchbase.com, linkedin.com, zoominfo.com, dnb.com, bloomberg.com, opencorporates.com and similar) to the company they describe.
  - Group by name after removing bracketed or dash suffixes and lower-casing.
  - Keep the entry that has a website or email. Merge in any email or phone from the others.
- Verdict prompt: return only the organisation's name. Never add labels such as "(Crunchbase profile)" or "(site subpage)".
- `counterpartyOutreach.functions.ts`: when the chosen row has no website or email, look for a row on the same transaction with the same core name that does, then continue with the existing order (in app, website, web scrape, guessed).
- One data fix on transaction `7f72a0b9-…`:
  - Set website and contact_email on counterparty `aa815137-…`. This changes only contact details, not the sealed Proof of Intent fields.
  - Trigger the outreach send.
- Unit test in `counterpartyPipeline.test.ts`: the three SeedAxis entries merge into one that keeps info@seedaxis.co.za.
- No changes to security, to the Proof of Intent seal, or to the workflow gates.
