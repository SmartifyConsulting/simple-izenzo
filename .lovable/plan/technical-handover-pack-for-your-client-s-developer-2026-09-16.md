# Technical handover pack for your client's developer

A single pack answering the six things she asked for, so her team can integrate without guessing. Saved to your Files as `Izenzo-Integration-Handover` (a document plus the type file itself).

## The six items

| # | What she asked for | What goes in the pack |
|---|---|---|
| 1 | Generated database types | The generated types file exactly as it stands, copied into the pack unchanged |
| 2 | Transaction, bid, organisation and member schemas | Field-by-field tables for transactions, bid offers, organisations and organisation members: field name, type, whether it is required, and what it means |
| 3 | POI, WaD, Execution, Finality and Memory interfaces | The record shape and the event shape for each of those five stages, plus the list of every value the stage/step fields can take |
| 4 | Authentication and tenant context | How sign-in works, how a request is authenticated on the server, and how everything is scoped to one organisation |
| 5 | Function invocation and callbacks | How to call the app's own server operations, and the two inbound callback endpoints (payment notifications and identity-verification webhooks) with their expected request and response |
| 6 | Sandbox and production endpoints | The two stable base URLs — preview/sandbox and production — written out in full |

## Detail per section

**Schemas (2).** Taken from the live database so it matches reality, not an older draft. Includes the reference format (BID…/OFF…), the stage and step fields that drive the workflow, and the sealing/completion timestamps and fingerprints on a transaction.

**Stage interfaces (3).** For each of the five stages: the table that stores its record, the fields on it, and the append-only event written when it happens — actor, stage, step, action, summary, payload and fingerprint. Also the ordered stage/step list and the gating rules (Compliance needs Intent sealed; Execution, Finality and Memory need Without a Doubt cleared; sealed records are immutable).

**Authentication and tenant context (4).** Email/password and Google sign-in; the session token that must accompany server calls; the protected area of the app; and the tenant rule — every row is scoped by organisation, membership decides access, roles are held separately from profiles, and access to a transaction is checked in the database rather than the browser.

**Invocation and callbacks (5).** The app's own operations are typed server calls that carry the signed-in user's token automatically, not public HTTP. Where an outside system must reach in, it uses the public callback endpoints; both verify the caller before doing anything. The pack gives method, path, headers, a sample body, and the success/failure responses, and states plainly that there is no general public API key flow today. If she wants one, that is a separate build.

**Endpoints (6).** Sandbox and production base URLs, with a note that the callback paths sit under the same origins and that the two environments share one backend.

## Notes

- Nothing in the app changes; this only produces a document and a copy of the type file in your Files.
- Secrets, keys and passwords are never included — only the names of the credentials her side would need to hold.
