# Why your search returned nothing — and how to fix it

## What I found

Your latest search did run properly. It took 18 seconds, reached the internet
search, finished without any error, and ended with **zero** companies kept. An
earlier run on the same bid ("20 000 branded golf balls, corporate gifts, Amrod")
kept exactly one — Amrod, and that one came from the app's own directory, not
from the web.

So the problem is not the connection, the key or the credits. The search finds
pages, then the app's own quality filters throw every company away before you
see them — and it never tells you which filter did it or why. There are four
filters in a row: no page address given, no evidence given, the evidence page not
being one of the pages actually read, and the "wrong side of the trade" check.
Which of those emptied the list is not recorded anywhere, so I cannot yet name
one with certainty.

## The plan

1. **Make the search explain itself.** Every discarded company and its reason
   gets recorded with the search and shown under the results, so "no matches"
   becomes "these 6 were found, here is why each was dropped". This alone tells
   us exactly which filter is at fault, on your next real search rather than a
   guess now.
2. **Run the same golf-ball search with that reporting on** and read the
   reasons.
3. **Fix the filter that is wrong**, guided by step 2. The two likeliest are:
   - the page-address check, which discards a company whenever the address the
     model quotes is not letter-for-letter one of the pages read (a redirect or
     a sub-page is enough to fail it);
   - the side-of-the-trade check, which for a general product like corporate
     gifts often reads a supplier as "unclear" and drops it.
   Whichever it is, the fix keeps the rule honest — nothing invented, evidence
   still required — but stops it discarding legitimate finds.
4. **Widen the searching slightly for consumer/branded-goods bids**: more search
   phrasings per run, so there are more pages to judge in the first place.
5. Verify with a live signed-in search on this same bid and confirm named
   companies with evidence links come back.

## Notes

- Nothing about how matches are approved, scored into deals, or governed changes;
  this is the finding stage only.
- Separately, your preview tab is currently signed out: the deal's own details
  came back empty and every server call answered "no authorisation". Reloading
  the page and signing in again fixes that; it is not the cause of the empty
  results above.

## Technical detail

- `src/lib/counterpartyPipeline.server.ts` builds `rejected[]` (lines 362–441)
  but `findCounterparties` never returns it to callers, and
  `src/lib/izenzo.functions.ts` (search handlers around lines 737–955) only
  forwards `failures` and `sources`. Thread `rejected` through the result, store
  it in the `counterparty_search_completed` event payload, and render it in
  `src/components/canvas/MatchResultsPanel.tsx` as a collapsed "considered and
  not kept" list.
- Relax the host check at line 379 to accept a sub-path/redirect of a cited host
  (compare registrable domain rather than exact hostname), and treat
  `operatesAs === "unclear"` as not-wrong-side when `showsRequiredRole` is true.
- Raise the Tavily query slice for `kind === "ai"` from 3 to 5 and `max` from 6
  to 8; keep `advanced` depth for AI+ only.
