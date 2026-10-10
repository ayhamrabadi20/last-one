import { describe, expect, it } from "vitest";
import { buildExplorationPlan, fallbackExplorationProfile } from "@/lib/explore";
describe("sector-specific business guidance", () => {
  it("adapts ready-made food sales without recommending production equipment", () => {
    const goal = "بدي أفتح محل حلويات بيع فقط بدون تصنيع";
    const plan = buildExplorationPlan(goal, fallbackExplorationProfile(goal), "fallback");
    expect(plan.overview.summaryAr).toContain("منتجات جاهزة");
    expect(plan.steps.find((step) => step.id === "plan-operations")?.actions.join(" ")).toContain("استلم المنتجات");
    expect(plan.steps.find((step) => step.id === "estimate-costs")?.actions.join(" ")).toContain("شراء المنتجات الجاهزة");
  });
  it.each([
    ["بدي أفتح محل مغسلة سيارات في إربد", "car-wash", "services", "السيارة"],
    ["بدي أفتح مغسلة ملابس في عمان", "laundry", "services", "القطع"],
    ["بدي أفتح محل صيانة هواتف", "repair", "services", "التشخيص"],
    ["بدي أفتح سوبرماركت", "grocery", "retail", "الصلاحية"],
    ["بدي أفتح صالون نسائي", "salon", "services", "الحجوزات"],
    ["بدي أفتح كافيه", "coffee", "food", "مشروب"],
    ["بدي أفتح محل حلويات", "food", "food", "منتج"],
    ["بدي أفتح محل ملابس", "clothing", "retail", "مقاس"],
    ["بدي أفتح محل موبايلات", "electronics", "retail", "جهاز"],
    ["بدي أفتح ورشة نجارة", "manufacturing", "manufacturing", "التصنيع"],
    ["بدي أفتح حضانة", "regulated-services", "services", "مختص"],
  ])("adapts %s instead of returning a generic retail plan", (goal, sector, category, detail) => {
    const profile = fallbackExplorationProfile(goal);
    const plan = buildExplorationPlan(goal, profile, "fallback");
    expect(profile.category).toBe(category);
    expect(plan.overview.sectorId).toBe(sector);
    expect(plan.steps.find((step) => step.id === "plan-operations")?.actions.join(" ")).toContain(detail);
    expect(plan.steps.map((step) => step.id)).toEqual(expect.arrayContaining(["test-demand", "prepare-equipment", "estimate-costs", "launch-and-measure"]));
  });
  it("keeps a car-service app digital and avoids physical workshop equipment", () => {
    const goal = "بدي أعمل تطبيق حجز غسيل سيارات";
    const profile = fallbackExplorationProfile(goal);
    const plan = buildExplorationPlan(goal, profile, "fallback");
    expect(profile.category).toBe("digital");
    expect(plan.overview.sectorId).toBe("digital");
    expect(plan.steps.find((step) => step.id === "prepare-equipment")?.actions.join(" ")).not.toContain("معدات ضغط");
  });
  it("handles an online clothing store without requiring a customer-facing shop", () => {
    const goal = "بدي أفتح متجر إلكتروني لبيع الملابس";
    const profile = fallbackExplorationProfile(goal);
    const plan = buildExplorationPlan(goal, profile, "fallback");
    expect(profile.businessModel).toBe("online");
    expect(plan.overview.sectorId).toBe("clothing");
    expect(plan.steps.map((step) => step.id)).not.toContain("verify-premises");
    expect(plan.steps.find((step) => step.id === "prepare-equipment")?.actions.join(" ")).toContain("التوصيل");
  });
});
