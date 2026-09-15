# View Proposal profile window, plus four workspace fixes

## 1. View Proposal → full counterparty profile window

Today "View Proposal" opens a small box that only repeats your own trade terms. It becomes a large window that reads like Bid Information, but for the counterparty — pulled from that company's own profile and the material they have attached to it.

Header: counterparty name, match percentage, jurisdiction and sector, plus a verified/unverified marker where we have one.

Body, in the same typography and two-column metadata style as Bid Information:

1. **About them** — their profile summary (AI brief, else published listing summary, else the reason our search matched them), with key terms bolded exactly as Bid Information does.
2. **Company details** — two columns: country, sector/industry, years in business, what they offer, terms of trade, website, contact name and email, phone.
3. **Attachments and portfolio** — the items on their profile (title, description, image where present) listed like the attachment rows in Bid Information, each openable in a new tab.
4. **The terms on the table** — the existing proposal block (commodity, volume, price, incoterms, jurisdiction), kept and moved to the bottom.

Footer keeps Close and Counter offer. If the company has no profile on the platform yet, the window still opens and says so plainly, showing what we do hold (source, website, contact, match reasoning).

## 2. Closing all bid tabs returns a clean, empty workspace

Cancelling or closing every bid tab leaves an empty Live Workspace: no bid name, no bid number, no bidder or Bid Information carried over from the last bid. The remembered "last bid" is cleared at the same time, so a reload does not bring it back.

## 3. One clean Confirmed Intent panel

The intent step currently sits inside three nested frames (Confirmed Intent → Intent → Confirm Intent). It becomes a single panel:

- one heading, "Confirmed Intent"
- the subtext "Read the terms as they stand. Confirming does not seal them — that is the next step."
- the certificate

The inner "Intent" and "Confirm Intent" frames, their pills and the duplicate close button go. "Confirm Intent" as a heading is retired in favour of "Confirmation" wherever it still appears elsewhere.

## 4. Intent certificate appears in the document list immediately

When the Confirm Intent certificate is produced it shows straight away in the attachments list, without a reload.

## 5. Chosen counterparty collapses the frame back to Search Results

Once a counterparty is chosen, the "Choose Counterparty" frame collapses and its pill reverts to "Search Results". Opening that accordion shows every search result, with the selected ones sorted to the top and clearly marked as selected.

## Technical notes

- New server function `getCounterpartyProfile` in `src/lib/counterpartyProfile.functions.ts`: takes the counterparty id, loads the `counterparties` row (verifying the caller can access its transaction), then resolves a profile by matching the counterparty name against `organisations.name` and `responder_listings` (published first). Returns a narrow, public-safe shape: name, jurisdiction, sector/industry, country, years_in_business, offerings, terms_of_trade, website, primary contact name/email, phone, summary, source, score, and `org_portfolio_items` (title, description, image_url). Uses the admin client inside the handler after the access check, since `organisations` RLS only exposes your own org.
- `ProposalDialog` in `src/components/canvas/DealCanvas.tsx`: also takes the counterparty id, widens to `sm:max-w-3xl` with `max-h-[85vh] overflow-y-auto`, renders the sections above with the existing `glass-node`/dl-grid/attachment-row classes and `highlightKeyTerms`. Loading state uses the same slim green bar as document reading. Call sites pass the candidate id.
- Empty workspace: in `src/components/layout/WorkspaceTaskbar.tsx` / `src/routes/_authenticated.live-deal-engine.tsx`, closing the last tab clears the active-deal state, the draft reference and the stored last-bid key, and renders Bid Registration with no reference or activity.
- Certificate visibility: after the intent certificate is written, invalidate the documents/attachments query for that transaction so the new file renders immediately.
- Search Results: `choicePending` already drives the pill label and open state; extend it so a chosen party sets the frame closed and the label back to "Search Results", and sort candidates with `shortlisted`/chosen first inside `CounterpartyRecord`, each marked as selected.
- No schema changes, no workflow/gating changes.
