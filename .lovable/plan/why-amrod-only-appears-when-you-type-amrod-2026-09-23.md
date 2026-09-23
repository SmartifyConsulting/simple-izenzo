# Why Amrod only appears when you type "amrod"

## What is happening

Amrod **is** being found. It is registered on Izenzo with the right details ("We make
corporate gifts; clothing; mugs, golf accessories"), and the search saved it against your
golf-ball bid with the highest score of all the results (60).

It is then hidden again by a second check that runs on the screen itself. That check
re-judges every company the search already kept, using only four short pieces of text:
the company name, its sector, its country, and one short note. For your bid it demands
**two** of the bid's words to appear in those four pieces. Amrod's sector reads
"Corporate Gifting" and its country "South Africa", so only "golf" (from the short note)
matches — one word, not two, so it is dropped from the list.

When you add "amrod" to the wording, the name itself becomes the second matching word,
so it passes and appears. That is the whole behaviour.

The same check also decides the counterparty count and the shortlist screens, so those
can disagree with what the search actually found.

## The fix

The search already does the real work: it reads the company's own pages, tests whether
it is the right side of the trade, scores it, and records why anything was dropped in the
"Considered and not kept" list. A company that survived all of that should not then be
hidden by a word count on the screen.

So for companies saved against a bid:

- Stop re-judging them on the screen. Show what the search kept, ordered by score, with
  Amrod and every other registered Izenzo company included.
- Keep excluding your own organisation — that rule stays.
- Keep the "Considered and not kept" list as the single place that explains a drop, so
  every exclusion is still visible and attributable to the search, not to an invisible
  screen filter.
- Apply the same change everywhere this filter is used, so the list, the counterparty
  count and the shortlist always agree.

The general directory screen (browsing companies with no bid attached) keeps its existing
word matching, because there is no search judgement behind those rows.

Nothing else changes: how the search finds companies, how they are scored, AI+ staying
advisory only, sealed Proof of Intent, mandatory Without a Doubt, and tenant separation
are all untouched.

## Technical detail

- `src/lib/bidRelevance.ts` — `keepForBid` currently returns
  `isRelevant(c, ctx.searchedFor)` (strict mode: two term hits once the bid wording has
  three or more terms). For bid-saved rows it keeps only the own-organisation exclusion;
  the relevance test is removed from that path. `loadRelevantCounterparties` returns rows
  ordered by score descending.
- `src/components/canvas/MatchResultsPanel.tsx:104` — drops the `keepForBid` filter over
  `bidMatches` (own-organisation exclusion retained); the directory query at line ~138
  keeps its `isRelevant` filter unchanged.
- `src/components/canvas/DealCanvas.tsx:1304` — same change to the counterparty list it
  builds.
- `src/routes/_authenticated.live-deal-engine.tsx:356, 880, 1807` — no edit needed; they
  read through `loadRelevantCounterparties` and pick up the corrected rule.
- Verification: typecheck, the existing automated checks (`src/lib/aiPlus.test.ts`,
  `src/lib/relevance.test.ts` — `isRelevant` itself is not modified), a clean build, and
  a signed-in check on BID1798792 that Amrod appears at the top of the results with the
  bid wording that does **not** mention amrod.

## Also: which AI does what

- The normal counterparty search goes back to the **OpenAI account** saved under
  Admin → Integrations, as it was before.
- **AI+** (recommendations and AI+ search) runs on the built-in **Astra** model at medium
  reasoning.

Worth knowing before this is switched: the OpenAI account currently has no credit left,
so the normal search will refuse again the moment it is moved back, until about $5–$10 of
pay-as-you-go credit is added to that OpenAI account. AI+ on Astra is unaffected and will
keep working.

Technical detail: the provider switch already exists (`src/lib/lovableAi.server.ts`
`callAiChat`). The ordinary-search call sites (`src/lib/counterpartyPipeline.server.ts`
for `kind: "ai"`, `chatCompletion` in `src/lib/izenzo.functions.ts`, and the small
document/company helpers) go back to `callOpenAiChat`; the AI+ path
(`src/lib/decisionPack.functions.ts` `askOnce` and `kind: "ai_plus"`) pins
`callLovableAiChat` with `reasoning_effort: "medium"`. Failure wording stays split so each
message names the right account.

## Also: Anastasia was emailed but nothing appeared in her Izenzo inbox

Checked both sides. The match email for Amrod did go out to nonastasia@gmail.com at
01:03 on 23 September, and the email service reports it as delivered (the sending domain
izenzo.co.za is verified and sending normally) — so if she can't see it in her mail, it is
worth checking her spam folder.

What is genuinely missing is the in-app one. When a counterparty is chosen and emailed,
only the bidder gets an Inbox entry. The matched company gets an email and nothing else,
so Anastasia's Izenzo inbox shows only bid cancellations — never the match itself. That is
why it looks like the notification never arrived.

The fix:

- When a counterparty that already has an Izenzo account is matched and emailed, also
  write an Inbox entry for that account — "You've been matched to BID… " with the deal
  reference and a link into the deal — so it lands in the app as well as in email.
- Match the account the same way the email does (by the counterparty's contact address),
  respect that person's own notification preference, and never fail the match if the Inbox
  write fails.
- Record the outcome of each send instead of swallowing it silently, so a failed or
  refused email is visible rather than invisible.
- Same for the invite path, so a company invited to join is also told inside the app once
  they sign in.

Technical detail: `src/lib/counterpartyOutreach.functions.ts` tier-1 branch (~line 458)
notifies only the bidder via `notifyBidder`; add a counterparty-side insert into
`notifications` (user_id resolved from `profiles.email` = the counterparty contact address,
`org_id` left to that profile's org, `transaction_id` set) guarded by
`getNotificationChannel` from `src/lib/bidderNotify.server.ts`. The existing notifications
INSERT policy already permits this (parties to an accessible transaction). No schema change,
no governance change.
