# Faster live updates between parties, and "Accepted" wording

## What you get
- When one party accepts, challenges, counters, signs, pays or finishes a check, the other party's screen updates within about a second. Right now it can take up to 15 seconds.
- The update happens quietly in the background. The page doesn't reload or flicker, open frames stay open, and anything you're typing is kept.
- The celebration now reads **"Congratulations! The proposal has been accepted."** It no longer says "The offer has been approved." This applies to both the bidder and the counterparty.

## How it works
- Each open Live Workspace listens for changes to its own deal: the deal's step, offers and responses, challenges, Legal Agreement signatures, KYC/KYB checks and payments.
- When a change arrives, only the affected sections re-read their data. On-screen values swap in place, and the page doesn't reset.
- The existing timed checks stay as a safety net in case the connection drops.
- Security doesn't change. Each person only receives updates for deals they're already allowed to see.

## Technical notes
- New migration: add `transactions`, `engagement_responses`, `transaction_events`, `documents`, `identity_verifications`, `engagement_diligence` and `challenges` to the `supabase_realtime` publication (only tables that exist and aren't already added). RLS already limits which rows each person receives.
- New hook `src/hooks/useDealRealtime.ts`: subscribes to `postgres_changes` filtered by `transaction_id=eq.<id>` (and `id=eq.<id>` for `transactions`). It debounces for 300 ms, then calls `queryClient.invalidateQueries` for the matching query keys. React Query keeps the old data on screen while it refetches, so nothing flickers. The hook unsubscribes when the deal changes or the view unmounts.
- Mount the hook in `_authenticated.live-deal-engine.tsx` (bidder) and `CounterpartyWorkspaceView.tsx` (counterparty). The existing `refetchInterval` polling stays as a fallback.
- Change the `message` prop in both `offer_approved` Confetti calls to "The proposal has been accepted." The show-once / "Fantastic!" behaviour doesn't change.
- No changes to gates, triggers, token costs or signatures.
