# Izenzo — Trading Platform Build Plan

Build the Izenzo platform from the attached Spine prototype, styled like your OntheBall app, with a working back end (accounts, records, credits and gates).

## Look and feel

Taken from OntheBall, not from the prototype's green:

- Charcoal / greyscale palette on white, near-black sidebar, subtle grey borders, minimal shadows
- DM Sans throughout; IBM Plex Mono kept only for hashes, IDs and seal blocks
- Small radius (6px), quiet cards, dense professional layout
- Sidebar shell with logo, sections and profile menu at the bottom, exactly like OntheBall

## The spine as a persistent vertical stepper

A left rail on every signed-in screen showing the five stages:

```text
TRADING
  Bid/Offer · Other Docs · Social/News · Search · AI
  AI+ · Counterparties · Choice · Intent · POI
COMPLIANCE & GOVERNANCE   (WaD, KYC/KYB/UBO, sanctions/PEP)
EXECUTION                 (Entry → Execution → Exit;
                           Concept → Pre-Feasibility → Feasibility →
                           Bankability → Implementation)
FINALITY
MEMORY
```

Completed steps show a tick, the current step is highlighted, future steps are locked with the reason ("POI required", "WaD required"). Clicking a completed step reopens it read-only. The rail collapses to icons on narrow screens.

## Screens (from the prototype)

Public: landing / public site, sign in, sign up, forgot password, reset password, terms glossary.

Party seat: dashboard, organisation details, discover counterparty, bid/offer and counter-bid, counterparty and media scan, search, counterparties surfaced, counterparty review, confirm intent, generate POI, sealed Proof of Intent, credits purchase.

Compliance: WaD case.

Execution: execution entry, project preparation, bankability, implementation, stakeholder entry/exit.

Finality: finality entry, finality type, finality evidence, change or value event, validation and acceptance, finality record.

Memory: memory ledger (forward and backward reading of the transaction).

Counterparty seat: counterparty status, incoming bids, accept/decline/counter.

Admin: admin inbox, issue credits, nudge.

## Back end (Lovable Cloud)

- Accounts with email/password, Google sign-in, forgot + reset password; show/hide on every password field
- Three seats: party, counterparty, admin — roles held in a separate roles table, never on the profile
- Organisations and membership; every record scoped to the organisation
- Transactions with an append-only event log; each spine step writes an immutable event with actor, timestamp and hash
- Documents (bid/offer, other docs, evidence) with versioning and SHA-256 fingerprints
- Counterparties, search runs, AI and AI+ outputs stored as proposals that always need a human confirmation — AI never adopts a choice
- Credits ledger: POI costs 1 credit (USD 10), WaD costs 3 more (USD 30). Both are hard gates enforced on the server, not just hidden in the UI
- POI sealing: server generates the sealed record and hash; downloadable
- Memory ledger reads the event log forward and backward; sealed after Finality
- AI and AI+ run through the built-in AI gateway

## Build order

1. Design system + app shell + spine rail; accounts and seats; landing and glossary
2. Trading end to end: organisation, bid/offer, docs, media scan, search, AI, AI+, counterparties, choice, intent, POI seal + credits
3. Compliance (WaD gate and verification case), counterparty seat, admin inbox
4. Execution, Finality, Memory ledger

## Notes

- Content in the prototype (deal titles, counterparty names, prices) is sample material; real wording and data come from you.
- The spec's provider integrations for KYC/KYB, sanctions and PEP screening are stubbed behind a switch until you choose providers.
