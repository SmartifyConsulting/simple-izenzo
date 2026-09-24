/** Tracks, per browser, whether this person has already seen the confetti moment for a given
 * transaction's offer approval — so it fires once, the first time they open that bid/offer screen
 * after it happens (bidder or counterparty, whichever wasn't there live to see it), not on every
 * subsequent visit. Client-side only (localStorage), matching how this app already remembers
 * per-browser state (ACTIVE_DEAL_KEY) rather than writing a server-side "seen" flag. */
const KEY_PREFIX = "izenzo:offer-celebrated:";

export function hasSeenOfferCelebration(transactionId: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + transactionId) === "1";
  } catch {
    // Can't tell either way — treat as already seen so a broken localStorage never repeats it.
    return true;
  }
}

export function markOfferCelebrationSeen(transactionId: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + transactionId, "1");
  } catch {
    // Best-effort only.
  }
}
