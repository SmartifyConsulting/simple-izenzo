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

describe("guessSideFromWording for RFP-style documents", () => {
  it("reads a request for proposals as a bid", () => {
    expect(guessSideFromWording("Request for proposals to migrate workloads. Deliverables. Evaluation criteria.")).toBe("bid");
  });
});

describe("guessSideFromWording for a sales offer", () => {
  it("reads an offer to sell with price and delivery terms as an offer", () => {
    expect(guessSideFromWording("Offer to sell copper cathode, 80 MT at $9,720/MT delivered Durban. Price list attached.")).toBe("offer");
  });
  it("still reads a request for quotation as a bid", () => {
    expect(guessSideFromWording("Request for quotation: supply of copper cathode")).toBe("bid");
  });
});
