import { describe, expect, it } from "vitest";
import { isRelevant } from "./relevance";

const q = "mining prospcets in Limpopo";

describe("isRelevant", () => {
  it("keeps a miner in the searched place", () => {
    expect(isRelevant({ name: "Limpopo Mining Holdings", sector: "Mining", jurisdiction: "South Africa" }, q)).toBe(true);
    expect(isRelevant({ name: "Northern Platinum", rationale: "Platinum mining and prospecting in Limpopo province." }, q)).toBe(true);
  });

  it("drops organisations with nothing to do with the search", () => {
    expect(isRelevant({ name: "Zambia Solar Power Ltd", sector: "Renewable energy", jurisdiction: "Zambia" }, q)).toBe(false);
    expect(isRelevant({ name: "Cape Wine Exporters", sector: "Agriculture", jurisdiction: "Western Cape" }, q)).toBe(false);
    expect(isRelevant({ name: "Izenzo Directory Listing", sector: "Software" }, q)).toBe(false);
  });

  it("drops a result that only shares the place, or only the trade, when the search names both", () => {
    expect(isRelevant({ name: "Limpopo Citrus Farm", sector: "Farming", jurisdiction: "Limpopo" }, q)).toBe(false);
    expect(isRelevant({ name: "Gauteng Coal Mining", sector: "Mining", jurisdiction: "Gauteng" }, q)).toBe(false);
  });

  it("tolerates plurals and typos in the search", () => {
    expect(isRelevant({ name: "Zambia Renewable Energy Projects", sector: "Renewable energy" }, "renewable enrgy projects in Zambia")).toBe(true);
    expect(isRelevant({ name: "Zambia Renewable Energy", sector: "Solar" }, "renewables in Zambia")).toBe(true);
  });

  it("uses a single term when the search is short", () => {
    expect(isRelevant({ name: "Copper Belt Traders", sector: "Metals" }, "copper cathodes")).toBe(true);
    expect(isRelevant({ name: "Blue Ocean Fisheries", sector: "Seafood" }, "copper cathodes")).toBe(false);
  });

  it("does not match on filler words", () => {
    expect(isRelevant({ name: "Global Trading Company Ltd", sector: "Various" }, "suppliers looking for copper")).toBe(false);
  });
});

describe("isRelevant for a bid titled from a document", () => {
  const title = "Enterprise Cloud Migration RFP";
  it("keeps a real cloud-migration provider", () => {
    expect(isRelevant({ name: "Accenture", sector: "IT services", rationale: "Enterprise cloud migration and managed cloud services." }, title)).toBe(true);
  });
  it("drops an unrelated business", () => {
    expect(isRelevant({ name: "Cape Wine Exporters", sector: "Agriculture" }, title)).toBe(false);
  });
});
