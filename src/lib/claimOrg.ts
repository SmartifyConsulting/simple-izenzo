/** What a claim-link click should do about organisations, decided without touching the database so
 * the multi-company rules can be checked directly. */
export type ClaimOrgDecision =
  | { action: "create" }
  | { action: "link"; orgId: string }
  | { action: "already-linked"; orgId: string }
  | { action: "refuse"; reason: "taken" | "self" };

/** Decides which of a person's companies a counterparty claim-link click acts as.
 *
 * A person can trade through several companies, so this is built around a list rather than a single
 * "primary" one. In order:
 *
 * - A deal already naming one of their companies keeps that company, so a re-click is a no-op and
 *   never silently re-links the deal to a different company of theirs.
 * - Otherwise the company their profile currently points at — the one they chose at bid time.
 * - Otherwise their first company, so a dangling profile pointer can't dead-end the link.
 * - Only when they belong to no company at all is one created.
 *
 * Refusals are decided here, before the caller writes anything, because creating an organisation and
 * *then* refusing is what filled the table with duplicates: every rejected click left a company
 * behind and the next click was refused for the same reason. */
export function decideClaimOrg(args: {
  /** Every organisation the person is a member of. */
  myOrgIds: string[];
  /** The organisation their profile currently points at, if any. */
  profileOrgId?: string | null | undefined;
  /** The organisation that owns the deal being claimed. */
  dealOrgId: string;
  /** The organisation already linked to the deal as its counterparty, if any. */
  dealCounterpartyOrgId?: string | null | undefined;
}): ClaimOrgDecision {
  const { myOrgIds, profileOrgId, dealOrgId, dealCounterpartyOrgId } = args;

  if (dealCounterpartyOrgId) {
    // Someone has already linked. Fine if it was one of this person's own companies (a re-click),
    // otherwise this deal belongs to another organisation and no click can change that.
    return myOrgIds.includes(dealCounterpartyOrgId)
      ? { action: "already-linked", orgId: dealCounterpartyOrgId }
      : { action: "refuse", reason: "taken" };
  }

  const target =
    profileOrgId && myOrgIds.includes(profileOrgId) ? profileOrgId : (myOrgIds[0] ?? null);
  if (!target) return { action: "create" };

  // Claiming a deal your own company bid on would make you both sides of it.
  if (target === dealOrgId) return { action: "refuse", reason: "self" };

  return { action: "link", orgId: target };
}
