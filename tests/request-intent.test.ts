import { describe, expect, it } from "vitest";
import { analyzeIntentWithRules, stabilizeIntent } from "@/lib/request-intent";

describe("request intent safety boundary", () => {
  it.each([
    "بدي أجدد هويتي",
    "كيف اجدد بطاقة الاحوال؟",
    "جواز السفر منتهي بدي تجديد",
    "بدي بدل فاقد لرخصة قيادة",
    "كيف أطلع جواز سفر؟",
    "بدي شهادة عدم محكومية",
    "بدي أحجز موعد",
    "بدي أفتح حساب بنكي",
  ])("rejects personal government transaction: %s", (input) => {
    expect(analyzeIntentWithRules(input).intent).toBe("unsupported_service");
  });

  it.each([
    "بدي أفتح محل حلويات بخلدا",
    "حاب أأسس شركة برمجيات",
    "أريد بدء مشروع إلكتروني",
    "شو بحتاج عشان أفتح محل حلويات؟",
    "بدي أعمل تطبيق توصيل",
    "بدي مشروع مغسلة سيارات",
    "بدي أفتح كشك قهوة",
  ])("keeps business ideas in project flow: %s", (input) => {
    expect(analyzeIntentWithRules(input).intent).toBe("business_journey");
  });

  it("keeps a knowledge question separate from a project request", () => {
    expect(analyzeIntentWithRules("شو الوثيقة المطلوبة إذا كان المحل مستأجر؟").intent).toBe("knowledge_question");
    expect(analyzeIntentWithRules("بدي أستفسر عن عقد الإيجار").intent).toBe("knowledge_question");
  });

  it("does not let AI override a high-confidence identity request", () => {
    expect(stabilizeIntent("اجدد هوية", "business_journey")).toBe("unsupported_service");
  });

  it("does not let AI invent a project from an ambiguous request", () => {
    expect(stabilizeIntent("ساعدني", "business_journey")).toBe("unclear");
  });
});
