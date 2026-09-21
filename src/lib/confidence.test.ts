import { describe, expect, it } from "vitest";
import { confidenceOf, evidenceCompleteness, parseEvidenceRefs } from "./confidence";

const ref = (kind: string, verified: boolean, chain = "x → y") => ({ kind, chain, verified });

describe("evidence-based confidence", () => {
  it("is High when most of what the advice rests on is confirmed", () => {
    const refs = parseEvidenceRefs([
      ref("document", true, "Assay Certificate → sample ID CCA-260918-73 → Cu 99.94%"),
      ref("extracted_fact", true, "Offer → specification → 99.99% Cu"),
      ref("bid_record", true, "Offer → quantity → 80 MT"),
      ref("general_knowledge", false, "Grade A cathode is normally 99.99%"),
    ]);
    expect(evidenceCompleteness(refs)).toBe(0.75);
    expect(confidenceOf(refs)).toBe("High");
  });

  it("is Low when the advice rests mostly on general knowledge", () => {
    const refs = parseEvidenceRefs([ref("general_knowledge", false), ref("general_knowledge", true), ref("document", true)]);
    // general knowledge can never count as verified, even if the model says so
    expect(refs[1]?.verified).toBe(false);
    expect(confidenceOf(refs)).toBe("Low");
  });

  it("is Medium when about half is confirmed", () => {
    expect(confidenceOf(parseEvidenceRefs([ref("document", true), ref("general_knowledge", false)]))).toBe("Medium");
  });

  it("has no confidence to show with nothing behind it", () => {
    expect(confidenceOf([])).toBe("Low");
  });

  it("uses the stored score for plain-text references it cannot check", () => {
    const refs = parseEvidenceRefs(["Term sheet", "Assay certificate"]);
    expect(refs.every((r) => r.unspecified)).toBe(true);
    expect(confidenceOf(refs, 0.9)).toBe("High");
    expect(confidenceOf(refs, 0.2)).toBe("Low");
  });
});
