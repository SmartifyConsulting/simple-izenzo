# Choice comes before Online Media Screening

Confirmed in the code: the media scan is started twice — automatically as soon as the AI/AI+ search finishes (and again at the start of Fetch Interest for anything already on file), and then properly when the user ticks their counterparties and clicks Continue. The workflow list also shows Online Media Screening above Choice, while the Mahjong canvas already shows Choice first.

## What changes

1. Online Media Screening no longer runs on its own after the search. It runs only once a person has picked their counterparties and continued — the second run, which is the one being kept.
2. In the workflow list, Online Media Screening moves to below Choice, so the order reads: Bid Registration, Submission of Documents, Search AI + AI+, Choice, Online Media Screening. This matches the Mahjong canvas order.
3. Pulsing follows the same order: when results come in, Choice pulses; Online Media Screening only pulses while the scan is genuinely running after the choice; the Choice row goes green and ticked once the pick is made.
4. No other step order, colour, tick or result formatting changes.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`: remove the automatic `startMediaChecks` calls in `fetchInterest` (pre-existing counterparties) and in the `finally` block of `runSearch`. Media checks keep running only via `onContinue={startMediaChecks}` from the Record panel.
- Same file, `stepOverrides`: after search completes, mark `search` done, `choice` active (or done once chosen); `onlineMedia` stays `locked`/`open` until a choice exists, becomes `active` while `mediaRunning`, `done` once `mediaResults` are in. Downstream Proof of Intent / WaD gating stays keyed off the choice plus media completion as it is today.
- Same file, `throbStep`: order the supplementary pulse so `choice` takes precedence before media results exist, and `online-media` only while `mediaRunning`.
- `src/components/canvas/ClassicView.tsx` (`STEPS`, step 1): swap the `onlineMedia` and `choice` entries so Choice is listed first.
- `src/lib/spine.ts` already lists `choice` before `online-media`; no change needed there.
