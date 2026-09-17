# Make the app ready to plug into their AI+ service

You now have both contracts: the request shape (Appendix A) and the DecisionPack response shape (Appendix B). That is everything needed to build the connection, so this closes the last open item on the handover.

The approach: build the connection, leave it switched off, and document it. If their AI+ service exists and works, they enter three values and it starts working. If it does not exist, nothing in the app changes and today's behaviour continues exactly as it is.

## What gets built

**A switch, off by default.** Until an administrator enters the endpoint address and signing details, AI+ keeps working exactly as it does today. Nothing you currently rely on changes.

**A call to their service.** When switched on, at each decision moment the app sends the transaction details in their Appendix A shape and expects a DecisionPack back in their Appendix B shape.

**Validation of what comes back.** Every reply is checked against their published schema. A reply that does not match is rejected and recorded as a failure — it is never shown as advice. Probabilities stay numbers between 0 and 1, never converted to low/medium/high.

**Signed requests.** Each request carries a signature made from the shared secret, so their service can prove the request came from Izenzo and not from somebody else.

**Retry-safety.** Each call carries a unique invocation identifier and a correlation identifier, recorded in the existing (currently empty) invocation table. If the same call is made twice, their side can tell it is a repeat rather than a new request.

**Safe failure.** If their service is slow, unreachable, or returns something invalid, the app records the failure and carries on. It never blocks a transaction, never guesses an answer, and never unwinds anything already sealed.

**A fifth advisory moment** after Proof of Intent is sealed, informational only — it cannot change the sealed record. This is the one item in their pack that is not yet present.

**Governance unchanged.** AI+ stays advisory. A person still accepts or rejects every proposal, and that decision is recorded with their name and the time. AI+ still cannot write Choice, Intent, POI, WaD, Execution or Finality.

## About keys

Three values, all from their side, entered once on the existing admin screen:

| Value | Who provides it |
|---|---|
| The private address of their AI+ service | Their team |
| A signing key identifier | Their team |
| A shared signing secret | Their team generates it; both sides hold the same value |

No third-party API keys, no accounts to open, nothing to buy. Nothing is stored in the code — the values live encrypted in the database, as the other integrations already do.

## Testing

Because their service may not exist yet, the connection is proven against a stand-in that returns their published DecisionPack shape: a valid reply is accepted, a malformed one is rejected, a repeated call is recognised as a repeat, a timeout fails safely, and one tenant cannot see another's proposals. These checks live in the codebase so their team can re-run them against the real service.

## Documentation

The handover pack and the AI+ status sheet are reissued: the "not built" list shrinks to nothing except items that depend on their side, plus a one-page "how to switch AI+ on" instruction with the three values named.

## Technical notes

- New server-only module for the signed client (HMAC-SHA256 over the canonical request body, key id in the header), invoked from the trusted server path — the equivalent of the Deno function their pack specifies, which does not fit this stack.
- Appendix A request builder and an Appendix B validator (JSON Schema draft 2020-12, `additionalProperties: false`) in `src/lib/decisionPack.functions.ts`; a reply failing validation is discarded, logged, and surfaced as "AI+ unavailable".
- `ai_plus_invocations` gains its writer: `invocation_id`, `correlation_id`, request/response status, latency, error. `ai_invoked` and `ai_failed` events written to `transaction_events` with the correlation id.
- Credentials read through the existing `integration_credentials` + `integrationCrypto.server.ts` path; the admin screen's three AI+ fields wired up. Enabled flag gates the whole path; when off, the current hosted-model behaviour is untouched.
- Bounded timeout with no client-side abort of in-flight advisory work; failures never throw into the transaction path.
- Stage contexts extended from four to five to add the post-seal informational invocation.
- No changes to governance triggers, RLS, POI immutability, WaD gating, or the append-only human decision record.
