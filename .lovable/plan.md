# Negotiation, search timing and workspace polish

## 1. Search waits for the documents to finish being read

Today the AI / AI+ search starts as soon as files are attached, even while the read is still
running — so it sometimes searches on file names instead of what the documents say. The search
will now hold until the read has finished:

- Documents submitted, read running: the workspace shows the reading bar only, no search.
- Read finished: the search starts by itself on the real content.
- Read fails: the search still starts (so nothing dead-ends), with a short line saying the
  documents could not be read.

## 2. Execution becomes the next pulsing step, Trade Summary collapses

Once the Step 2 business documents are in, the pulse moves onto Execution (Step 3) in both the
map and the step list, and the Trade Summary appears as a collapsed frame that opens on click,
instead of a long open panel pushing everything down.

## 3. Business documents default to "Other"

The document type on the business documents upload starts on Other, so a file can be dropped
without picking a type first.

## 4. Workflow map scrollbars removed

Neither a sideways nor a downward scrollbar appears around the map — it scales to fit the panel.


## 5. Search results in their own collapsed frame

The counterparty match list (name, country, match percentage, reason, source link) moves into a
collapsed "Search results" frame that sits directly above Online Media Screening Results. It
opens on click and stays available for the whole deal.

## 6. Counter offer and negotiation

- Each selected match gets a counter-offer icon next to it.
- Pressing it opens a Counter Offer window where the terms are typed (price, quantity, unit,
  currency and free-text terms).
- Send records the counter offer against that counterparty, emails it to the counterparty's
  contact address when one is on file, and raises an app inbox notification plus an email
  confirmation to the bidder.
- While a counter offer is outstanding, the pulse sits on the Counter Offer step (map and step
  list) instead of Choice or Online Screening.
- Replies are recorded against the same negotiation thread and shown in the Counter Offer window
  as a running exchange; a reply landing moves the pulse back off Counter Offer.
- The negotiation can go back and forth as many times as needed. A "Proceed with this bid" action
  in the Counter Offer window ends the negotiation and hands over to Online Media Screening,
  exactly as the current Continue does.
- If no contact address is on file for a counterparty, the counter offer is still recorded and
  the bidder is told it could not be emailed.

## Technical detail

**Database** — one migration:
- `public.counter_offers`: `id`, `transaction_id`, `counterparty_id`, `direction`
  (`from_bidder` | `from_counterparty`), `price`, `quantity`, `unit`, `currency`, `terms`,
  `status` (`sent` | `answered` | `accepted` | `withdrawn`), `created_by`, `created_at`.
- GRANTs (`SELECT, INSERT, UPDATE` to `authenticated`, `ALL` to `service_role`), RLS on, policies
  scoped through the existing `can_access_tx(transaction_id)` helper.
- Regenerate types after applying.

**Server** — `src/lib/counterOffer.functions.ts`:
- `sendCounterOffer` (`requireSupabaseAuth`): inserts the row, writes a `transaction_events`
  entry, inserts a `notifications` row for the bid's org, and sends email through the existing
  `loadResendCreds` / `sendEmail` helpers — to the counterparty's stored contact/website email
  when present, plus a confirmation to the signed-in user. Email failures are reported back as a
  soft warning, never a thrown send.
- `listCounterOffers` (`requireSupabaseAuth`): the thread for a transaction/counterparty.
- `recordCounterOfferReply` (`requireSupabaseAuth`): a `from_counterparty` row, marking the prior
  `sent` row `answered`.

**UI**:
- `src/routes/_authenticated.live-deal-engine.tsx`: gate the auto-search effect on
  `documentSummary || readError` (and not `rereading`); make `DocumentUploadStep`'s
  `autoAdvance`/`onNext` set a pending flag that the same effect consumes once the summary lands;
  drop the `overflow-x-auto` / `min-w-[420px]` wrapper around `MapView`; add
  `o["counterOffer"] = "active"` while an open counter offer exists (new query on
  `counter_offers`), suppressing the Choice/Online Screening pulse; add
  `o["execution"] = "active"` once `stepOverrides["businessDocs"] === "done"`; render
  `TradeSummary` inside a collapsed accordion frame.
- `src/components/canvas/MapView.tsx`: `overrideKey: "counterOffer"` on the Counter Offer node
  and `overrideKey: "execution"` on the Step 3 execution tile.
- `src/components/canvas/ClassicView.tsx`: no key changes needed; the existing `counterOffer`
  and Step 3 rows read the same override map (add `counterOffer` row if absent).
- `src/components/canvas/DealCanvas.tsx` (`CounterpartyRecord`): wrap the match list in a
  collapsible "Search results" frame above the media results block; add a counter-offer icon
  button on shortlisted/selected rows opening a new `CounterOfferDialog`
  (`src/components/canvas/CounterOfferDialog.tsx`) that shows the thread, the terms form, Send,
  and Proceed with this bid (calls the existing continue-to-media handler).
- `src/components/steps/StepScreen.tsx`: `useState("other")` for the business-docs type.

Verification: typecheck, build, and a Playwright pass on the workspace covering the collapsed
search-results frame, the counter-offer dialog, the pulse landing on Counter Offer then Execution,
and the map rendering with no scrollbar.
