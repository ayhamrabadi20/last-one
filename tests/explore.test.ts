import { describe, expect, it } from "vitest";
import { buildExplorationPlan, explorationProfileNeedsAI, fallbackExplorationProfile, stabilizeExplorationProfile } from "@/lib/explore";

describe("dynamic exploration plan", () => {
  it("understands the fallback shape of a sweets shop in Khalda", () => {
    const profile = fallbackExplorationProfile("بدي أفتح محل حلويات بخلدا");
    expect(profile).toMatchObject({
      activityAr: "محل حلويات",
      locationAr: "خلدا",
      category: "food",
      businessModel: "physical",
    });
  });

  it("adds food-specific discovery without inventing official requirements", () => {
    const profile = fallbackExplorationProfile("بدي أفتح محل حلويات بخلدا");
    const plan = buildExplorationPlan("بدي أفتح محل حلويات بخلدا", profile, "fallback");
    expect(plan.titleAr).toContain("محل حلويات");
    expect(plan.steps.map((step) => step.id)).toContain("verify-food-controls");
    expect(plan.steps.map((step) => step.id)).toContain("verify-premises");
    expect(plan.noticeAr).toContain("ليست قائمة متطلبات حكومية");
    expect(plan.steps.every((step) => step.completionEvidence.length > 0)).toBe(true);
  });

  it("adapts the plan when the business is digital rather than a shop", () => {
    const profile = fallbackExplorationProfile("بدي أعمل منصة إلكترونية للتوصيل");
    const plan = buildExplorationPlan("بدي أعمل منصة إلكترونية للتوصيل", profile, "fallback");
    expect(profile.category).toBe("digital");
    expect(profile.businessModel).toBe("online");
    expect(plan.steps.map((step) => step.id)).not.toContain("verify-premises");
  });

  it("extracts common service and digital activities without waiting for AI", () => {
    const salon = fallbackExplorationProfile("بدي أفتح صالون نسائي بإربد");
    const delivery = fallbackExplorationProfile("بدي أعمل تطبيق توصيل");
    expect(salon).toMatchObject({ activityAr: "صالون نسائي", category: "services", businessModel: "physical" });
    expect(delivery).toMatchObject({ activityAr: "تطبيق توصيل", category: "digital", businessModel: "online" });
    expect(explorationProfileNeedsAI(salon)).toBe(false);
    expect(explorationProfileNeedsAI(delivery)).toBe(false);
  });

  it("reserves Ollama for genuinely ambiguous descriptions", () => {
    expect(explorationProfileNeedsAI(fallbackExplorationProfile("عندي فكرة جديدة ومش عارف من وين أبدأ"))).toBe(true);
  });

  it("handles more everyday Jordanian project descriptions deterministically", () => {
    const laundry = fallbackExplorationProfile("بدي مشروع مغسلة سيارات");
    const kiosk = fallbackExplorationProfile("بدي أفتح كشك قهوة بخلدا");
    expect(laundry).toMatchObject({ activityAr: "مغسلة سيارات", category: "services", businessModel: "physical" });
    expect(kiosk).toMatchObject({ activityAr: "كشك قهوة", category: "food", businessModel: "physical", locationAr: "خلدا" });
  });

  it("stabilizes a verbose small-model extraction with deterministic facts", () => {
    const profile = stabilizeExplorationProfile("بدي أفتح محل حلويات بخلدا", {
      activityAr: "فتح محل حلويات بخلدا",
      locationAr: null,
      category: "other",
      businessModel: "unknown",
      premisesTenure: "unknown",
    });
    expect(profile).toMatchObject({
      activityAr: "محل حلويات",
      locationAr: "خلدا",
      category: "food",
      businessModel: "physical",
    });
  });
});
