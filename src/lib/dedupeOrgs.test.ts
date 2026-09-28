import { describe, expect, it } from "vitest";
import { cleanOrgName, nameKey } from "./dedupeOrgs";

describe("cleanOrgName / nameKey", () => {
  it("collapses directory and subpage labels into the company", () => {
    const names = [
      "SeedAxis",
      "SeedAxis (Crunchbase profile)",
      "SeedAxis - GCC & Capability Enablement (site subpage)",
    ];
    expect(names.map(cleanOrgName)).toEqual(["SeedAxis", "SeedAxis", "SeedAxis"]);
    expect(new Set(names.map(nameKey)).size).toBe(1);
  });
});
