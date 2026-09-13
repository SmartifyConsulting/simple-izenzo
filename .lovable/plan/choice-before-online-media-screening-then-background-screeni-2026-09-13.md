# Choice before Online Media Screening, then Background Screening, Intent, Proof of Intent

Confirmed in the code: the media scan is started twice — automatically as soon as the AI/AI+ search finishes (and again at the start of Fetch Interest for anything already on file), and then properly when the user ticks their counterparties and clicks Continue. The workflow list also shows Online Media Screening above Choice, while the Mahjong canvas already shows Choice first. The workflow list is also missing Background Screening and Intent, both of which already exist and work on the Mahjong canvas.

## What changes

1. Online Media Screening no longer runs on its own after the search. It runs only once a person has picked their counterparties and continued — the second run, which is the one being kept.
2. The workflow list order becomes: Bid Registration, Submission of Documents, Search AI + AI+, Choice, Online Media Screening, Background Screening, Intent — then Proof of Intent and Without a Doubt in the next block, as today. This matches the Mahjong canvas order.
3. Background Screening and Intent are added to the workflow list using the existing screening and intent behaviour already behind the canvas — same colours, ticks, pulsing and result text formula as the other steps.
4. Pulsing follows the order: Choice pulses when results come in; Online Media Screening pulses only while that scan runs after the choice; Background Screening pulses only while those provider checks run; Intent pulses once screening has returned; Proof of Intent pulses once Intent is signed.
5. No other step order, colour, tick or result formatting changes.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`: remove the automatic `startMediaChecks` calls in `fetchInterest` (pre-existing counterparties) and in the `finally` block of `runSearch`. Media checks keep running only via `onContinue={startMediaChecks}` from the Record panel.
- Same file, `stepOverrides`: after search, `search` done, `choice` active (done once chosen); `onlineMedia` locked/open until a choice exists, `active` while `mediaRunning`, `done` once `mediaResults` exist; new `backgroundScreening` key open → `active` while `screening` → `done` once `screeningResults` exist; new `intent` key `active` once screening has returned and the intent is not yet signed, `done` once it is; `poi`/`wad` gating unchanged.
- Same file, `throbStep`: keep `choice` taking precedence before media results exist, `online-media` only while `mediaRunning`, `media` (background screening) only while `screening`.
- `src/components/canvas/ClassicView.tsx` (`STEPS`, step 1): reorder to `choice` then `onlineMedia`, and add `{ key: "backgroundScreening", label: "Background Screening", stage: "trading", step: "media", icon: Newspaper }` and `{ key: "intent", label: "Intent", stage: "trading", step: "intent", icon: Handshake }`. Proof of Intent stays the first item of the Compliance & Governance block, so it still reads directly after Intent.
- `src/lib/spine.ts` already lists `choice`, `online-media`, `media`, `intent`, `poi` in this order; no change needed there.
