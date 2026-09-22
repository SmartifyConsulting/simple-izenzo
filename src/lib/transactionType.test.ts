import { describe, expect, it } from "vitest";
import { classifyTransactionTypeHeuristic, structuredFactsLines } from "./transactionType";

describe("classifyTransactionTypeHeuristic", () => {
  it("reads a renewable-energy project as project finance, not a commodity trade", () => {
    expect(
      classifyTransactionTypeHeuristic({
        commodity: "Electricity",
        title: "50MW Solar PV Project — PPA and EPC Financing",
        documentSummary: "20-year PPA, grid connection at 50MW, EPC contractor appointed, battery storage included.",
      }),
    ).toBe("project_finance");
  });
  it("reads a plain commodity deal as a commodity trade", () => {
    expect(
      classifyTransactionTypeHeuristic({ commodity: "Copper cathode", title: "Copper cathode 80MT", documentSummary: null }),
    ).toBe("commodity_trade");
  });
  it("falls back to other with nothing to go on", () => {
    expect(classifyTransactionTypeHeuristic({ commodity: null, title: "New Bid", documentSummary: null })).toBe("other");
  });
});

describe("structuredFactsLines", () => {
  it("renders only the non-empty fields for the classified type, using their labels", () => {
    const lines = structuredFactsLines("project_finance", {
      grid_capacity: "50MW connection agreement signed",
      ppa_tenor: "",
      epc_timing: null,
      land_rights: "25-year lease, renewable",
    });
    expect(lines).toEqual([
      "Grid capacity: 50MW connection agreement signed",
      "Land rights: 25-year lease, renewable",
    ]);
  });
  it("returns nothing for a type with no facts, or when facts is missing", () => {
    expect(structuredFactsLines("other", { anything: "x" })).toEqual([]);
    expect(structuredFactsLines("commodity_trade", null)).toEqual([]);
  });
  it("ignores keys that don't belong to the classified type", () => {
    const lines = structuredFactsLines("commodity_trade", { grid_capacity: "50MW", grade_or_spec: "Grade A" });
    expect(lines).toEqual(["Grade / specification: Grade A"]);
  });
});
