# View Proposal → full counterparty profile window

Today "View Proposal" opens a small box that only repeats your own trade terms. It becomes a large window that reads like Bid Information, but for the counterparty — pulled from that company's own profile and the material they have attached to it.

## What the window shows

Header: counterparty name, match percentage, jurisdiction and sector, plus a "verified"/"unverified" marker where we have one.

Body, in the same typography and two-column metadata style as Bid Information:

1. **About them** — the company's profile summary (their AI brief if they have one, otherwise their published listing summary, otherwise the reason our search matched them). Bolded key terms exactly as Bid Information does.
2. **Company details** — two columns: country, sector/industry, years in business, what they offer, terms of trade, website, contact name and email, phone.
3. **Attachments and portfolio** — the items on their profile (title, description, image where present) listed like the attachment rows in Bid Information, each openable in a new tab.
4. **The terms on the table** — the existing proposal block (commodity, volume, price, incoterms, jurisdiction) kept, moved to the bottom as a certificate-style panel.

Footer keeps Close and Counter offer.

When a counterparty has no profile on the platform yet, the window still opens and says plainly that this company has not published a profile, showing whatever we do hold (source, website, contact, our match reasoning).

## Technical notes

- New server function `getCounterpartyProfile` in `src/lib/counterpartyProfile.functions.ts`: takes the counterparty id, loads the `counterparties` row (verifying the caller can access its transaction), then resolves a profile by matching the counterparty name against `organisations.name` and `responder_listings` (published listings first). Returns a narrow, public-safe shape: name, jurisdiction, sector/industry, country, years_in_business, offerings, terms_of_trade, website, primary contact name/email, phone, summary text, source, score, and portfolio items from `org_portfolio_items` (title, description, image_url).
  - Uses the admin client inside the handler after the access check, because `organisations` RLS only exposes your own org — the function deliberately returns just the fields listed above, no credits, no internal ids beyond what's needed.
- `ProposalDialog` in `src/components/canvas/DealCanvas.tsx`: takes the counterparty id as well as the name, widens to `sm:max-w-3xl` with `max-h-[85vh] overflow-y-auto`, and renders the sections above using the existing frame classes (`glass-node`, dl grids, attachment rows) and `highlightKeyTerms` for the summary. Loading state is the same slim green progress bar used while documents are read.
- `setProposalFor` call sites pass the candidate id (already available on the row).
- No schema changes, no workflow/gating changes.
