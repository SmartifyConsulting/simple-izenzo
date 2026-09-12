# Read the uploaded document, fix matching, tidy the workspace

## Why no matches come back today

Confirmed by reading the code:

- When a file is uploaded, only its **file name** is looked at (to guess the document type and whether it reads as a bid or an offer). The content inside the file is never opened.
- There is a document-reading routine in the project that reads photos by sight and PDF / Word / Excel / text files as text, but **nothing in the app ever calls it** — it is dead code today.
- The counterparty search builds its web query from the deal's typed commodity, title and country. On a document-only deal those are empty and the title is just "New Bid", so the search goes out looking for almost nothing and comes back with nothing useful.

So: no, the AI is not currently summarising the documents. That is the fix.

## What changes

### 1. Read every upload and search on what it says

- On upload, read the actual contents: the ID photo by sight (OCR), and PDF, Word, Excel, CSV and plain-text files as text.
- Ask the AI to write the **ask** as short bullet points, in the document's own terms — quantity, units, price, currency, delivery/timing, terms, anything material to the exchange. Nothing is forced into fixed fields, because every submission differs.
- Alongside the bullets, capture just the few facts the search needs (what is being traded, which side, where) so the counterparty search has something real to go and find. If the document doesn't say, the search says so rather than searching on nothing.
- Any identity number found is encrypted and kept in the backend only — it never appears in the bullets the other side reads.
- Progress and failures are honest: if a file can't be read, it is named and the search still runs on what could be read.

### 2. Live Workspace shows the summary and who submitted it

- The right-hand Live Workspace shows the bullet summary of the ask, headed by the **name of the business or individual** who submitted it and a **verification badge** when they have been verified through the app (from the identity-verification records already in the backend). Unverified shows a plain, clearly different marker — never a green tick.

### 3. Glow on the cream background

The active step currently pulses in a bright aqua glow, which was tuned for the dark canvas and reads as a neon halo on the cream Alpha-Bravo background. The pulse stays, but the colour comes from the theme: royal blue on cream, aqua on the dark skin, so the same animation looks right in both.

### 4. Hide the developer/API side

- The Developer Centre (API keys, usage, webhook logs, schema explorer, integration docs, notifications) and the public developer docs pages are hidden from the interface — no links, no menu entries, and the addresses no longer open. The code stays in place so it can be brought back later.
- Inbound service callbacks the platform itself depends on are untouched.

### 5. Cancel becomes a refresh icon

The search card's "Cancel" text button becomes a refresh icon button (with a "Start again" label for screen readers). Cancel buttons inside dialogs keep their wording, since there "cancel" is the correct meaning.

## AI+ Kernel / Intelligence Fabric — waiting on your document

You mentioned an instruction document from the inventor, and that they don't want their intelligence exposed. Once you upload it I'll read it and come back with how we connect: normally this is one sealed call-out — our search sends the request to their Kernel and uses the answer, without us ever holding or seeing their internals. I'll confirm what they need from us (address, credentials, request shape) after reading it. Nothing about the Kernel is built in this change.

## Technical notes

- Wire `summarizeBidDocuments` (`src/lib/docSummary.functions.ts`) into the upload path in `DocumentUploadStep` / `_authenticated.live-deal-engine.tsx`; extend it to also return the search-relevant facts and persist them onto the transaction (commodity/quantity/unit/price/incoterms/jurisdiction where present) plus the free-form bullets in `document_summary`.
- `searchCounterparties` in `src/lib/izenzo.functions.ts` builds its query from those persisted facts, falling back to the document bullets; it raises a clear message when there is nothing substantive to search on instead of querying the deal title.
- Model use unchanged elsewhere: GPT-6 Astra for search tiers; document reading stays on the multimodal Gemini Flash path.
- Live Workspace header: submitter name from the org/profile on the transaction, badge from `identity_verifications` (completed + approved decision).
- Replace the hardcoded `#00e5ff` in `animate-throb-aqua` (`src/styles.css`) with a token-driven colour, overridden per skin.
- Developer routes: remove nav entries in `DeveloperShell`/`AppShell`/`SiteHeader`/`docs.tsx` and make `/developer/*`, `/docs/api`, `/docs/webhooks` non-routable (files retained, route registration removed) so nothing dangles in the typed route tree.
- `HeroMatchCard.tsx`: reset control becomes an icon button with `aria-label`.
