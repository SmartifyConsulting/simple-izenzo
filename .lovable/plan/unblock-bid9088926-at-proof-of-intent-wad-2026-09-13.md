# Unblock BID9088926 at Proof of Intent / WaD

## What is happening

The bid re-confirmed intent for the new party (Deloitte Legal) at 22:35, so it now sits at Proof of Intent. But a Proof of Intent was already sealed at 22:03 for the *previous* party, and that seal is still on the record. Result:

- Proof of Intent looks finished, so nothing can be sealed again.
- WaD is still locked with "Complete the earlier steps first", because the bid's own marker never moved past Proof of Intent.

The old certificate covers a party that is no longer in the deal, so it cannot be carried forward.

## Changes

1. **Changing party clears the old Proof of Intent seal.** When a different counterparty is chosen and intent is reopened, the previous seal is cleared so Proof of Intent must be granted again for the new party. The earlier certificate stays on the bid as history and is not deleted.

2. **Re-sealing costs one token, as before.** A new certificate is issued for the new party and attached to the bid, and the bid then moves to Without a Doubt. No refund is given for the earlier seal.

3. **Repair BID9088926.** One-off correction: clear the stale seal on this bid so Proof of Intent is available again for Deloitte Legal, keeping the earlier certificate on file.

4. **Never leave a bid stranded.** If a bid ever has a sealed Proof of Intent while its marker still sits at that step, it moves forward to Without a Doubt rather than showing a locked frame with no way out.

## Verification

Open BID9088926: Proof of Intent is pressable again for Deloitte Legal, sealing it charges one token and issues a new certificate, and Without a Doubt then opens instead of saying earlier steps are incomplete.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx` — in the intent-reopen branch of `startMediaChecks`, also null `poi_sealed_at` / `poi_hash`, and record a `poi_reopened` event; the previously issued certificate document row is left untouched.
- `src/lib/izenzo.functions.ts` — `sealProofOfIntent` gates stay as they are (intent confirmed, not currently sealed, ≥1 token).
- `src/lib/spine.ts` `lockReason` — treat `compliance/wad` as reachable when `poi_sealed_at` is set, so a bid whose marker lags behind a completed seal is not locked out.
- Data fix: `update transactions set poi_sealed_at = null, poi_hash = null, step = 'poi' where reference = 'BID9088926'`.
