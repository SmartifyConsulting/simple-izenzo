import { describe, expect, it } from "vitest";
import { guessSideFromWording } from "./tradeSide";

describe("guessSideFromWording", () => {
  it("reads a search for a supplier as a bid", () => {
    expect(guessSideFromWording("looking for enterprise cloud migration providers")).toBe("bid");
    expect(guessSideFromWording("RFP for fleet vehicle leasing")).toBe("bid");
  });
  it("reads a search for a buyer as an offer", () => {
    expect(guessSideFromWording("we sell yellow maize, looking for buyers")).toBe("offer");
    expect(guessSideFromWording("find off-takers for our copper cathodes")).toBe("offer");
  });
  it("says nothing when it cannot tell", () => {
    expect(guessSideFromWording("yellow maize 500 MT")).toBeNull();
  });
});
