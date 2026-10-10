export type RequestIntent =
  | "business_journey"
  | "knowledge_question"
  | "unsupported_service"
  | "unclear";

export type IntentAnalysis = {
  intent: RequestIntent;
  confidence: "high" | "medium" | "low";
  matchedBy: "rules" | "ollama" | "fallback";
};

export const supportedServices = [
  {
    id: "documented-journey",
    titleAr: "رحلة تأسيس موثقة",
    descriptionAr: "مسار بيع الملابس بالتجزئة كمؤسسة فردية داخل أمانة عمّان، لمحل مستأجر أو مملوك.",
  },
  {
    id: "project-exploration",
    titleAr: "استكشاف فكرة مشروع",
    descriptionAr: "خطة بحث أولية لأي فكرة مشروع أخرى، موسومة بوضوح وليست متطلبات حكومية مؤكدة.",
  },
  {
    id: "knowledge-answer",
    titleAr: "سؤال من المصادر",
    descriptionAr: "إجابة فقط عندما تحتوي قاعدة المعرفة المحلية على دليل مناسب مع الاستشهاد بالمصدر.",
  },
] as const;

export const unsupportedServiceMessageAr =
  "طلبك يبدو معاملة حكومية شخصية، وهذه الخدمة غير متاحة في Mustanad Jo حاليًا. التطبيق لا يجدّد الهوية أو الجواز أو الرخصة، ولا ينفّذ معاملات حكومية.";

function normalizeArabic(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ");
}

const governmentServicePattern = new RegExp(
  [
    "(?:اجدد|جدد|تجديد|اصدار|استخراج|اطلع|اقدم|بدل فاقد|بدل تالف).{0,18}(?:هوي(?:ه|تي|تك|ته)|بطاقه|جواز|رخصه قياده|دفتر عائله|شهاده ميلاد|عدم محكوميه)",
    "(?:هوي(?:ه|تي|تك|ته)|بطاقه الاحوال|البطاقه الشخصيه|جواز السفر|رخصه القياده|دفتر العائله).{0,18}(?:تجديد|اصدار|منتهيه|ضايعه|فاقد|تالف)",
    "(?:موعد|طلب).{0,12}(?:احوال مدنيه|جواز سفر|ترخيص سواقين)",
    "(?:بدي|اريد|لازم|محتاج).{0,12}(?:شهاده عدم محكوميه|شهاده ميلاد|دفتر عائله|جواز سفر|رخصه قياده)",
    "(?:احجز|حجز).{0,12}(?:موعد|دور)",
    "(?:ادفع|دفع).{0,12}(?:فاتوره|مخالفه)",
    "(?:افتح|فتح).{0,10}(?:حساب بنكي|حساب حكومي)",
  ].join("|"),
);

const businessPattern = /(?:بدي|اريد|حاب|ناوي|نفسي)?\s*(?:افتح|افتتاح|ا?اسس|تاسيس|ابدا|بدء|اعمل|انشئ)\s+(?:مشروع|محل|متجر|مطعم|مقهى|كافيه|شركه|مؤسسه|مصنع|ورشه|مكتب|صالون|مخبز|صيدليه|عياده|تطبيق|منصه|كشك|مغسله|معرض|مستودع|حضانة|حضانه|مدرسه|نادي)|(?:بدي|اريد|عندي|حاب)\s+(?:فكره\s+)?مشروع\s+[\p{L}-]+|(?:مشروع|محل|نشاط تجاري)\s+(?:جديد|خاص|الكتروني)/u;
const questionPattern = /^(?:شو|ما|ماذا|كيف|هل|وين|اين|متي|كم|ليش|لماذا|ايش)\b|[؟?]/;
const knowledgeRequestPattern = /(?:بدي|اريد|حاب)?\s*(?:اعرف|استفسر|معلومات|تفاصيل).{0,24}(?:عن|حول)|(?:رخصه مهن|تسجيل مؤسسه|عقد ايجار).{0,18}(?:شو|كيف|متطلبات)/;
const shopPattern = /(?:سوبر ?ماركت|بقاله|حلاقه|كوفي|محل|متجر|مغسله|مطعم|صالون|مخبز|ورشه|صيدليه|عياده|حضانة|حضانه|كشك)/;
const planningPattern = /تجهيز|تشغيل|تكلفه|تكاليف|خطة|خطه|دراسه جدوي|ابدا|افتح|افتتاح/;

export function analyzeIntentWithRules(value: string): IntentAnalysis {
  const normalized = normalizeArabic(value);
  if (!normalized) return { intent: "unclear", confidence: "high", matchedBy: "rules" };
  if (governmentServicePattern.test(normalized)) {
    return { intent: "unsupported_service", confidence: "high", matchedBy: "rules" };
  }
  if (businessPattern.test(normalized) || (shopPattern.test(normalized) && planningPattern.test(normalized))) {
    return { intent: "business_journey", confidence: "high", matchedBy: "rules" };
  }
  if (knowledgeRequestPattern.test(normalized)) {
    return { intent: "knowledge_question", confidence: "high", matchedBy: "rules" };
  }
  if (questionPattern.test(normalized)) {
    return { intent: "knowledge_question", confidence: "medium", matchedBy: "rules" };
  }
  return { intent: "unclear", confidence: "low", matchedBy: "rules" };
}

export function stabilizeIntent(input: string, aiIntent: RequestIntent): RequestIntent {
  const deterministic = analyzeIntentWithRules(input);
  // High-confidence safety and business rules always beat model output.
  if (deterministic.confidence === "high") return deterministic.intent;
  // A model may not invent a business journey from a phrase with no business
  // signal (for example "ساعدني"). The wizard must ask for clarification.
  if (aiIntent === "business_journey") return "unclear";
  return aiIntent;
}
