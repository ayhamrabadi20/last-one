import { describe, expect, it } from "vitest";
import { analyzeIntentWithRules } from "@/lib/request-intent";
describe("project planning requests", () => {
  it.each(["بدي أفتح سوبرماركت", "شو تجهيزات محل صيانة هواتف؟", "بدي خطة تشغيل صالون نسائي", "تكاليف افتتاح مغسلة سيارات"])('routes "%s" to project planning', (goal) => {
    expect(analyzeIntentWithRules(goal).intent).toBe("business_journey");
  });
  it("keeps official document questions in source answers", () => {
    expect(analyzeIntentWithRules("شو الوثيقة المطلوبة إذا كان المحل مستأجرًا؟").intent).not.toBe("business_journey");
  });
});
