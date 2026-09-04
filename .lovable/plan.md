# Fill Izenzo with sample data so every screen shows the workflow

Right now your account (georgia.adams@smartify.co.za) has no company attached, so every screen after sign-in is empty. This plan attaches a full demo world to your login.

## What you'll see after this

- **Your company**: Izenzo Commodities (Pty) Ltd, with a token balance and a history of top-ups and spends.
- **A trading market of 12 companies**: Meridian Metals SA, Kalahari Resources, Zambezi Bulk Traders, Cape Bulk Commodities, Atlas Ferroalloys, Highveld Minerals, Indian Ocean Shipping & Trade, Savannah Energy Trading, Rift Valley Mining, Baltic Ore Partners and Gulf Commodity Holdings — each with country, sector and registration details.
- **Deals across the whole market**, not just yours: the 12 companies trade with each other in around 20 deals at mixed stages, so lists, searches and surfaced-counterparty screens look like a live market rather than a single test deal. Your own company sits on both sides of several of them — as buyer on some, as the receiving counterparty on others, so the inbox has genuine incoming business.
- **Your seats**: party, counterparty and admin — so the admin area shows content too.


## The sample deals

Both of the things you asked for: one deal parked at each stage, plus one deal taken all the way through. These five are the deals your own company is on; the rest of the market carries a further ~15 deals between the other companies, spread over the same stages.


| Deal | Where it sits | What it demonstrates |
|---|---|---|
| Copper cathode Q3 — 500 t | Trading, at Bid/Offer | Opening bid and counter-offer, attached documents, media scan notes |
| Chrome ore 40% — 12,000 t | Trading, at Counterparties/Choice | Search results, AI and AI+ write-ups, four surfaced counterparties with scores |
| Manganese 37% — 8,000 t | Compliance, at WaD | Sealed Proof of Intent, an open verification case mid-review |
| Coal RB2 — 25,000 t | Execution | Cleared verification, entry recorded, feasibility and bankability notes, stakeholders joining and leaving |
| Ferrochrome — 3,000 t | Finality (sealed) and Memory | The complete story end to end: bid to sealed finality record, readable forward and backward in the memory ledger |

Every deal gets a matching trail of dated, fingerprinted entries, so the spine on the left shows ticks behind it and the memory ledger reads properly. Deal names, prices and counterparty names are realistic placeholders — say the word and I'll swap in your real ones.

Also seeded: a handful of notifications and nudges for the inbox and admin screens.

## One fix along the way

Opening the inbox currently makes the app loop on itself and throw an error. The sign-in guard on the private screens is doing the redirect the wrong way; I'll move it to the standard route guard so protected pages settle straight away instead of re-triggering.

## Technical notes

- Data is inserted with `run_sql` (no schema changes needed) against the existing tables: `organisations`, `profiles`, `user_roles`, `transactions`, `transaction_events`, `bid_offers`, `documents`, `counterparties`, `ai_proposals`, `wad_cases`, `execution_records`, `stakeholder_events`, `finality_records`, `credit_ledger`, `notifications`.
- `profiles.org_id` for user `173989ea-…` is set to the new Izenzo org; `user_roles` gains `admin` and `counterparty` rows for that user (roles stay in the separate roles table).
- Stage/step, `intent_confirmed_at`, `poi_sealed_at` + `poi_hash`, `wad_completed_at` and `finality_sealed_at` are set consistently per deal so `lockReason()` in `src/lib/spine.ts` unlocks exactly the intended steps.
- Event fingerprints are seeded as SHA-256 hex strings so the seal blocks render.
- `src/routes/_authenticated.tsx` moves to `src/routes/_authenticated/route.tsx` with `ssr: false` and a `beforeLoad` `supabase.auth.getUser()` redirect, replacing the `useEffect` + `navigate` loop (`href` in the dependency list re-fires the navigation).
