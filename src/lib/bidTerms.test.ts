import { describe, expect, it } from "vitest";
import { bidTermTokens, redactBidTerms, stripBidTerms } from "./bidTerms";

const tokens = bidTermTokens(["80 MT", "USD 9,720 per MT", "Delivered Durban", "Copper cathode, 80 MT delivered Durban at $9,720/MT"]);

describe("bid terms", () => {
  it("recognises the requester's quantity, price and delivery terms", () => {
    expect(tokens).toEqual(expect.arrayContaining(["80", "9720"]));
    expect(tokens.some((t) => t.startsWith("delivered"))).toBe(true);
  });

  it("removes sentences that state the requester's terms as facts about an organisation", () => {
    const text = "SokoDolla trades copper. SokoDolla offers 80 MT at $9,720/MT delivered Durban.";
    expect(stripBidTerms(text, tokens)).toBe("SokoDolla trades copper.");
  });

  it("keeps a term the organisation's own page really carries", () => {
    const text = "It stocks 80 MT of copper.";
    expect(stripBidTerms(text, tokens, "Current stock: 80 MT of copper cathode")).toBe(text);
  });

  it("returns nothing when only the requester's terms were repeated", () => {
    expect(stripBidTerms("Wants 80 MT delivered Durban.", tokens)).toBeUndefined();
  });

  it("redacts the terms in background handed to a model", () => {
    expect(redactBidTerms("Sell 80 MT at 9720", tokens)).toBe("Sell [requester's term] MT at [requester's term]");
  });
});
