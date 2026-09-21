import { beforeEach, describe, expect, it, vi } from "vitest";

const chatAnswers: Record<string, unknown>[] = [];
let webText = "[]";
let webSources: { url: string; title: string }[] = [];

vi.mock("@/lib/openaiCall.server", () => ({
  callOpenAiChat: async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(chatAnswers.shift() ?? {}) } }] }), {
      status: 200,
    }),
  openAiFailureMessage: async () => "failed",
}));
vi.mock("@/lib/openaiWebSearch.server", () => ({
  webSearch: async () => ({ text: webText, sources: webSources, model: "test-model" }),
}));

import { findCounterparties, type PipelineInput } from "./counterpartyPipeline.server";

let counter = 0;
const input = (): PipelineInput => ({
  apiKey: "k",
  kind: "ai_plus",
  chatModel: "m",
  webModels: ["m"],
  txKey: `tx-${(counter += 1)}`,
  direction: "bid",
  commodity: null,
  quantity: "n/a",
  price: "n/a",
  incoterms: null,
  jurisdiction: "South Africa",
  region: null,
  terms: null,
  typedPrompt: "enterprise cloud migration",
  docSummary: "RFP for migrating on-premise workloads to a public cloud",
  fallbackSubject: "enterprise cloud migration",
  ownOrgName: "Bozene",
});

const brief = {
  transactionSummary: "Migrate on-premise workloads to public cloud",
  role: "cloud migration service provider",
  organisationTypes: ["systems integrator"],
  capabilities: ["cloud migration"],
  sectors: ["IT services"],
  geographies: ["South Africa"],
  mustHave: ["delivers enterprise cloud migrations"],
  exclude: ["directories"],
  searchQueries: ["cloud migration South Africa"],
};

beforeEach(() => {
  chatAnswers.length = 0;
  webSources = [
    { url: "https://accenture.example/cloud", title: "Accenture cloud" },
    { url: "https://winery.example/about", title: "Winery" },
  ];
});

describe("findCounterparties", () => {
  it("keeps grounded, relevant organisations and drops the rest with reasons", async () => {
    webText = JSON.stringify([
      { name: "Accenture", jurisdiction: "South Africa", sector: "IT services", evidence: "Runs enterprise cloud migrations.", sourceUrl: "https://accenture.example/cloud" },
      { name: "Cape Winery", jurisdiction: "South Africa", sector: "Wine", evidence: "Produces wine.", sourceUrl: "https://winery.example/about" },
      { name: "Bozene", jurisdiction: "South Africa", sector: "IT", evidence: "Cloud.", sourceUrl: "https://accenture.example/cloud" },
      { name: "Ghost Consulting", jurisdiction: "South Africa", sector: "IT", evidence: "Cloud migration.", sourceUrl: "https://not-searched.example/x" },
      { name: "No Evidence Ltd", sector: "IT", sourceUrl: "https://accenture.example/cloud" },
    ]);
    chatAnswers.push(brief, {
      results: [
        { name: "Accenture", relevant: true, score: 88, rationale: "Delivers enterprise cloud migrations for large clients." },
        { name: "Cape Winery", relevant: false, score: 5, reason: "Makes wine, not IT services." },
      ],
    });
    const r = await findCounterparties(input());
    expect(r.candidates.map((c) => c.name)).toEqual(["Accenture"]);
    expect(r.candidates[0]?.score).toBe(88);
    const reasons = Object.fromEntries(r.rejected.map((x) => [x.name, x.reason]));
    expect(reasons["Cape Winery"]).toMatch(/wine/i);
    expect(reasons["Bozene"]).toMatch(/own organisation/i);
    expect(reasons["Ghost Consulting"]).toMatch(/not among/i);
    expect(reasons["No Evidence Ltd"]).toMatch(/evidence/i);
    expect(r.brief.role).toBe("cloud migration service provider");
  });

  it("returns nothing (not an error) when the search finds no one", async () => {
    webText = "[]";
    chatAnswers.push(brief);
    const r = await findCounterparties(input());
    expect(r.candidates).toEqual([]);
    expect(r.webError).toBeNull();
  });

  it("falls back to a plain brief when the understanding step cannot be read", async () => {
    webText = "[]";
    chatAnswers.push({});
    const r = await findCounterparties(input());
    expect(r.brief.role).toBe("supplier");
    expect(r.brief.capabilities).toContain("enterprise cloud migration");
  });
});
