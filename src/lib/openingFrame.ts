import type { Transaction } from "@/lib/tx";

/** Which frame a workspace should open on when a deal is opened by its ID, rather than resumed.
 *
 * Kept as a pure function so the rule is testable and visible: opening a deals's link should land
 * on the step the deal is actually up to, with that one frame already expanded, instead of on a
 * column of collapsed headings with no sign of what to do next.
 *
 * The order below follows the spine backwards — the most advanced state the deal has reached wins,
 * because that is the step it is waiting on.
 */
export type OpeningFrame =
  | { kind: "businessDocs" }
  | { kind: "sealedWad" }
  | { kind: "offer" }
  | { kind: "sealedPoi" }
  | { kind: "confirmedIntent" };

type TxLike = Pick<Transaction, "wad_completed_at" | "poi_sealed_at" | "intent_confirmed_at"> & {
  step?: string | null;
  wad_continued_at?: string | null;
};

export function openingFrameFor(tx: TxLike): OpeningFrame {
  // Past Without a Doubt and continued into execution: the legal agreements are what is current.
  if (tx.wad_completed_at && tx.wad_continued_at) return { kind: "businessDocs" };
  // Cleared but not continued — nothing else is waiting, so open the gate holding the Continue.
  if (tx.wad_completed_at) return { kind: "sealedWad" };
  // Intent sealed: the Offer ⇄ Counter Offer exchange is live and waiting on someone.
  if (tx.poi_sealed_at) return { kind: "offer" };
  if (tx.intent_confirmed_at) return { kind: "sealedPoi" };
  return { kind: "confirmedIntent" };
}
