import { describe, expect, it } from "vitest";
import { openingFrameFor } from "./openingFrame";

const base = {
  wad_completed_at: null,
  poi_sealed_at: null,
  intent_confirmed_at: null,
  wad_continued_at: null,
  step: null,
} as const;

describe("openingFrameFor", () => {
  it("opens the confirmed intent record when nothing further has happened", () => {
    expect(openingFrameFor({ ...base })).toEqual({ kind: "confirmedIntent" });
  });

  it("opens the sealed Proof of Intent once intent is confirmed", () => {
    expect(openingFrameFor({ ...base, intent_confirmed_at: "2026-01-01T00:00:00Z" })).toEqual({
      kind: "sealedPoi",
    });
  });

  it("opens the Offer once the Proof of Intent is sealed", () => {
    expect(
      openingFrameFor({
        ...base,
        intent_confirmed_at: "2026-01-01T00:00:00Z",
        poi_sealed_at: "2026-01-02T00:00:00Z",
      }),
    ).toEqual({ kind: "offer" });
  });

  it("opens the cleared Without a Doubt gate when it has not been continued", () => {
    expect(
      openingFrameFor({
        ...base,
        intent_confirmed_at: "2026-01-01T00:00:00Z",
        poi_sealed_at: "2026-01-02T00:00:00Z",
        wad_completed_at: "2026-01-03T00:00:00Z",
      }),
    ).toEqual({ kind: "sealedWad" });
  });

  it("opens the legal agreements once the gate has been continued", () => {
    expect(
      openingFrameFor({
        ...base,
        intent_confirmed_at: "2026-01-01T00:00:00Z",
        poi_sealed_at: "2026-01-02T00:00:00Z",
        wad_completed_at: "2026-01-03T00:00:00Z",
        wad_continued_at: "2026-01-04T00:00:00Z",
      }),
    ).toEqual({ kind: "businessDocs" });
  });

  it("treats continued-but-not-cleared as not continued", () => {
    // Defensive: wad_continued_at without wad_completed_at should never occur, but the gate's own
    // state must win rather than jumping the deal into execution.
    expect(openingFrameFor({ ...base, wad_continued_at: "2026-01-04T00:00:00Z" })).toEqual({
      kind: "confirmedIntent",
    });
  });

  it("prefers the most advanced state the deal has reached", () => {
    const fullyAdvanced = openingFrameFor({
      ...base,
      intent_confirmed_at: "2026-01-01T00:00:00Z",
      poi_sealed_at: "2026-01-02T00:00:00Z",
      wad_completed_at: "2026-01-03T00:00:00Z",
      wad_continued_at: "2026-01-04T00:00:00Z",
    });
    expect(fullyAdvanced.kind).toBe("businessDocs");
  });
});
