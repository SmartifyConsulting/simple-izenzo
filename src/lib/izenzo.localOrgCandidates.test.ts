import { describe, expect, it } from "vitest";
import { localOrgCandidates, type LocalOrgRow } from "./izenzo.functions";

const row = (over: Partial<LocalOrgRow>): LocalOrgRow => ({
  name: "Acme",
  sector: null,
  industry: null,
  offerings: null,
  ai_brief: null,
  country: null,
  website: null,
  primary_contact_email: null,
  ...over,
});

describe("localOrgCandidates", () => {
  it("matches a registered organisation relevant to the search, with its email", () => {
    const orgs = [
      row({
        name: "Cocoa Processing Company Limited",
        sector: "Cocoa processing",
        country: "Ghana",
        website: "https://cocoaprocessing.example",
        primary_contact_email: "trade@cocoaprocessing.example",
      }),
    ];
    const { candidates, emails } = localOrgCandidates(orgs, "cocoa buyer Ghana", "");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe("Cocoa Processing Company Limited");
    expect(emails.get("cocoa processing")).toBe("trade@cocoaprocessing.example");
  });

  it("still surfaces a relevant registered organisation with no recorded email — it just has no email ready until enrichment finds one", () => {
    const orgs = [row({ name: "Cocoa Processing Company Limited", sector: "Cocoa processing" })];
    const { candidates, emails } = localOrgCandidates(orgs, "cocoa buyer", "");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe("Cocoa Processing Company Limited");
    expect(emails.size).toBe(0);
  });

  it("excludes the bidder's own organisation, matched by normalised name", () => {
    const orgs = [
      row({ name: "Bozene (Pty) Ltd", sector: "Cocoa processing", primary_contact_email: "info@bozene.example" }),
    ];
    const { candidates } = localOrgCandidates(orgs, "cocoa buyer", "Bozene");
    expect(candidates).toEqual([]);
  });

  it("excludes an organisation with nothing relevant to the search", () => {
    const orgs = [
      row({ name: "Downtown Nail Salon", sector: "Beauty", primary_contact_email: "hello@nails.example" }),
    ];
    const { candidates } = localOrgCandidates(orgs, "cocoa buyer Ghana", "");
    expect(candidates).toEqual([]);
  });
});
