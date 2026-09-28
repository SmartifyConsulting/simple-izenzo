import { describe, expect, it } from "vitest";
import { isRelevant, relevanceTerms } from "./relevance";

describe("accent-insensitive matching", () => {
  it("treats Pokémon and Pokemon as the same word", () => {
    expect(relevanceTerms("Pokémon Licensed Apparel")).toContain("poke");
    expect(isRelevant({ name: "Pokemon Fashions Pty Ltd", sector: "Fashion" }, "Pokémon Licensed Apparel Supplier Search", { loose: true })).toBe(true);
  });
});
