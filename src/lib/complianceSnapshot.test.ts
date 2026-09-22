import { describe, expect, it } from "vitest";
import { deriveComplianceVerdict } from "./complianceSnapshot.functions";

describe("deriveComplianceVerdict", () => {
  it("is green (trusted) when the check ran and found nothing", () => {
    expect(deriveComplianceVerdict(true, [])).toEqual({ verdict: "green", ratingBand: "trusted" });
  });

  it("is red (flagged) when the check ran and found anything at all", () => {
    expect(deriveComplianceVerdict(true, [{ reason: "Named in a 2024 fraud judgment", url: null }])).toEqual({
      verdict: "red",
      ratingBand: "flagged",
    });
  });

  it("is unknown (neutral) when the check never actually ran — never a false green", () => {
    expect(deriveComplianceVerdict(false, [])).toEqual({ verdict: "unknown", ratingBand: "neutral" });
  });

  it("stays unknown when checked is false, even if a flag was somehow collected", () => {
    // Whether the search ran at all takes priority over what it found — "did we actually look"
    // is answered before "what did we see".
    expect(deriveComplianceVerdict(false, [{ reason: "x", url: null }]).verdict).toBe("unknown");
  });
});
