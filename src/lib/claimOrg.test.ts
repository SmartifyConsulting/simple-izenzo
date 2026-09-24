/**
 * Contract checks for which company a counterparty claim-link click acts as.
 *
 * The bug these exist to prevent: a person in two or more companies had `.maybeSingle()` on their
 * memberships return null (PostgREST errors on 2+ rows), which the caller read as "this person has
 * no company" and answered by creating another one — every click, forever. These checks pin the
 * multi-company cases so that can't come back.
 *
 * Run with: bunx vitest run src/lib/claimOrg.test.ts
 */
import { describe, expect, it } from "vitest";
import { decideClaimOrg } from "./claimOrg";

const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const DEAL_OWNER = "cccccccc-3333-4333-8333-cccccccccccc";
const OTHER = "dddddddd-4444-4444-8444-dddddddddddd";

describe("decideClaimOrg", () => {
  it("creates a company only when the person belongs to none", () => {
    expect(decideClaimOrg({ myOrgIds: [], dealOrgId: DEAL_OWNER })).toEqual({ action: "create" });
  });

  it("does not create a second company for someone who already has one", () => {
    // The original failure: a lone membership read back as "no company".
    expect(decideClaimOrg({ myOrgIds: [A], dealOrgId: DEAL_OWNER })).toEqual({
      action: "link",
      orgId: A,
    });
  });

  it("picks the company the profile points at when there are several", () => {
    expect(decideClaimOrg({ myOrgIds: [A, B], profileOrgId: B, dealOrgId: DEAL_OWNER })).toEqual({
      action: "link",
      orgId: B,
    });
  });

  it("never creates another company for a multi-company person", () => {
    // The exact shape of Georgia Adams' data: many memberships, one active profile company.
    const many = [A, B, "e5", "f6", "a7", "b8", "c9"].map((s) => s.padEnd(36, "0"));
    for (const profileOrgId of [A, B, null, undefined, OTHER]) {
      const decision = decideClaimOrg({ myOrgIds: many, profileOrgId, dealOrgId: DEAL_OWNER });
      expect(decision.action).not.toBe("create");
      expect(many).toContain((decision as { orgId: string }).orgId);
    }
  });

  it("falls back to a real membership when the profile points at a company they aren't in", () => {
    expect(
      decideClaimOrg({ myOrgIds: [A, B], profileOrgId: OTHER, dealOrgId: DEAL_OWNER }),
    ).toEqual({
      action: "link",
      orgId: A,
    });
  });

  it("treats a re-click on the same company as a no-op, not a new link", () => {
    expect(
      decideClaimOrg({ myOrgIds: [A, B], dealCounterpartyOrgId: A, dealOrgId: DEAL_OWNER }),
    ).toEqual({ action: "already-linked", orgId: A });
  });

  it("keeps the company already linked even when the profile points at another of theirs", () => {
    // Re-clicking after switching companies must not silently re-link the deal.
    expect(
      decideClaimOrg({
        myOrgIds: [A, B],
        profileOrgId: B,
        dealCounterpartyOrgId: A,
        dealOrgId: DEAL_OWNER,
      }),
    ).toEqual({ action: "already-linked", orgId: A });
  });

  it("refuses a deal already linked to someone else's company", () => {
    expect(
      decideClaimOrg({ myOrgIds: [A], dealCounterpartyOrgId: OTHER, dealOrgId: DEAL_OWNER }),
    ).toEqual({
      action: "refuse",
      reason: "taken",
    });
  });

  it("refuses when the company claiming it is the company that owns the deal", () => {
    expect(decideClaimOrg({ myOrgIds: [DEAL_OWNER], dealOrgId: DEAL_OWNER })).toEqual({
      action: "refuse",
      reason: "self",
    });
  });

  it("refuses a self-claim before creating anything, even with no memberships", () => {
    // Refusal must be reachable without a write: this is what stopped the duplicate creation.
    const decision = decideClaimOrg({
      myOrgIds: [],
      dealOrgId: DEAL_OWNER,
      dealCounterpartyOrgId: OTHER,
    });
    expect(decision.action).toBe("refuse");
  });
});
