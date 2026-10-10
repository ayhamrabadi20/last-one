import { describe, expect, it } from "vitest";
import { classifyInputKind, heuristicExtract, mergeSlots, missingSlotKeys, trustedAISlots } from "@/lib/intake";

describe("intake normalization", () => {
  it("does not infer legal form, ownership or municipality from model guesses", () => {
    expect(trustedAISlots({activityId:"clothing-retail",municipalityId:"amman",legalForm:"sole-proprietorship",premisesTenure:"rent"})).toEqual({activityId:"clothing-retail"});
    expect(missingSlotKeys(mergeSlots(trustedAISlots({premisesTenure:"rent"}),heuristicExtract("بدي أفتح محل ملابس")))).toContain("premisesTenure");
  });
  it("does not let null AI fields erase deterministic matches", () => {
    const deterministic = heuristicExtract("بدي محل ملابس مستأجر بعمان كمؤسسة فردية");
    const model = { activityId: null, municipalityId: null, premisesTenure: null };

    expect(mergeSlots(model, deterministic)).toMatchObject({
      activityId: "clothing-retail",
      municipalityId: "amman",
      legalForm: "sole-proprietorship",
      premisesTenure: "rent",
    });
  });

  it("keeps an explicit user answer over extracted values", () => {
    expect(mergeSlots({ premisesTenure: "rent" }, { premisesTenure: "own" }))
      .toEqual({ premisesTenure: "own" });
  });

  it("treats unknown tenure as a question that still needs an answer", () => {
    expect(missingSlotKeys({ premisesTenure: "unknown" })).toContain("premisesTenure");
  });

  it("recognizes common non-clothing activities as outside coverage", () => {
    expect(heuristicExtract("شو متطلبات فتح مطعم في عمان؟").activityId).toBe("other");
    expect(heuristicExtract("كيف أسجل شركة برمجيات؟").activityId).toBe("other");
    expect(heuristicExtract("شو بحتاج عشان أفتح محل ألعاب بخلدا؟").activityId).toBe("other");
    expect(heuristicExtract("بدي أعمل تطبيق توصيل").activityId).toBe("other");
  });

  it("does not mistake premises adjectives for a named activity", () => {
    expect(heuristicExtract("بدي أفتح محل مستأجر بعمان").activityId).toBeUndefined();
  });
});

describe("input intent", () => {
  it("routes a direct question to knowledge Q&A even when it mentions opening a shop", () => {
    expect(classifyInputKind("شو بحتاج عشان أفتح محل ملابس؟")).toBe("question");
  });

  it("keeps a stated goal in the journey builder", () => {
    expect(classifyInputKind("بدي أفتح محل ملابس مستأجر بعمان")).toBe("journey");
  });
});
