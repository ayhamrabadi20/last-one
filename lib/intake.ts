import type { Slots, SlotKey } from "@/lib/schemas";

const questions: Record<SlotKey, { id: SlotKey; textAr: string; options: Array<{ value: string; labelAr: string }> }> = {
  activityId: {
    id: "activityId",
    textAr: "شو نوع النشاط اللي بدك تفتحه؟",
    options: [
      { value: "clothing-retail", labelAr: "بيع ملابس بالتجزئة" },
      { value: "other", labelAr: "نشاط آخر" },
    ],
  },
  municipalityId: {
    id: "municipalityId",
    textAr: "وين موقع المشروع؟",
    options: [
      { value: "amman", labelAr: "داخل حدود أمانة عمّان" },
      { value: "other", labelAr: "مدينة أو بلدية أخرى" },
    ],
  },
  legalForm: {
    id: "legalForm",
    textAr: "أي شكل قانوني بدك للمشروع؟",
    options: [
      { value: "sole-proprietorship", labelAr: "مؤسسة فردية" },
      { value: "company", labelAr: "شركة" },
      { value: "other", labelAr: "غير ذلك / مش متأكد" },
    ],
  },
  premisesTenure: {
    id: "premisesTenure",
    textAr: "المحل مستأجر ولا مملوك؟",
    options: [
      { value: "rent", labelAr: "مستأجر" },
      { value: "own", labelAr: "مملوك" },
      { value: "unknown", labelAr: "لسه ما قررت" },
    ],
  },
};

const slotOrder: SlotKey[] = ["activityId", "municipalityId", "legalForm", "premisesTenure"];

export function classifyInputKind(value: string): "journey" | "question" {
  const normalized = value.trim().toLowerCase();
  const startsAsQuestion = /^(شو|ما|ماذا|كيف|هل|وين|اين|أين|متى|كم|ليش|لماذا|ايش|إيش)\b/.test(normalized);
  const containsQuestionMark = /[؟?]/.test(normalized);
  return startsAsQuestion || containsQuestionMark ? "question" : "journey";
}

export function heuristicExtract(goal: string): Slots {
  const normalized = goal.trim().toLowerCase();
  const slots: Slots = {};

  if (/ملابس|ألبسة|البسة|ثياب/.test(normalized)) slots.activityId = "clothing-retail";
  else if (/مطعم|قهوة|مقهى|كوفي|كافيه|صالون|برمجيات|تطبيق|منصة|توصيل|بقالة|سوبرماركت|صيدلية|مخبز|حلويات|إلكترونيات|الكترونيات|أثاث|اثاث|عطور|إكسسوارات|اكسسوارات|مكتبة|عيادة|مكتب|مصنع|ورشة|سيارات|أحذية|احذية|كشك|مغسلة|معرض|مستودع|حضانة|مدرسة|نادي/.test(normalized)) slots.activityId = "other";
  else if (/محل\s+(?!مستأجر|مستاجر|مملوك|جديد|صغير|كبير|في\b|بعمان\b|بعمّان\b)[\p{L}-]{2,}/u.test(normalized)) slots.activityId = "other";

  if (/عمان|عمّان|الأمانة|امانة عمان/.test(normalized)) slots.municipalityId = "amman";
  else if (/اربد|إربد|الزرقاء|العقبة|مادبا|السلط|جرش|عجلون|الكرك/.test(normalized)) {
    slots.municipalityId = "other";
  }

  if (/مؤسسة فردية|موسسة فردية/.test(normalized)) slots.legalForm = "sole-proprietorship";
  else if (/شركة/.test(normalized)) slots.legalForm = "company";

  if (/مستأجر|مستاجر|إيجار|ايجار/.test(normalized)) slots.premisesTenure = "rent";
  else if (/مملوك|ملكي|ملك خاص/.test(normalized)) slots.premisesTenure = "own";

  return slots;
}

// A model may suggest the activity, but cannot invent facts that change legal steps.
export function trustedAISlots(slots: Slots): Slots {
  return slots.activityId ? { activityId: slots.activityId } : {};
}

export function mergeSlots(...sets: Slots[]) {
  const merged: Record<string, string | null | undefined> = {};
  for (const set of sets) {
    for (const [key, value] of Object.entries(set) as Array<[SlotKey, Slots[SlotKey]]>) {
      // A model uses null for "not found". It must never erase a value found by
      // deterministic parsing or explicitly selected by the user.
      if (value !== undefined && value !== null) merged[key] = value;
    }
  }
  return merged as Slots;
}

export function missingSlotKeys(slots: Slots) {
  return slotOrder.filter((key) => {
    const value = slots[key];
    return value === undefined || value === null || value === "unknown";
  });
}

export function nextQuestion(slots: Slots) {
  const next = missingSlotKeys(slots)[0];
  return next ? questions[next] : null;
}

export function coverageStatus(slots: Slots) {
  if (slots.activityId === "other") return "unsupported_activity";
  if (slots.municipalityId === "other") return "unsupported_municipality";
  if (slots.legalForm === "company" || slots.legalForm === "other") return "unsupported_legal_form";
  return missingSlotKeys(slots).length ? "needs_clarification" : "covered_demo";
}

export function coverageMessage(status: string) {
  const messages: Record<string, string> = {
    unsupported_activity: "النسخة الحالية تغطي بيع الملابس بالتجزئة فقط، ولن نعمم متطلبات هذا النشاط على غيره.",
    unsupported_municipality: "النسخة الحالية تغطي المواقع داخل حدود أمانة عمّان فقط.",
    unsupported_legal_form: "النسخة الحالية تغطي المؤسسة الفردية فقط، وليس الشركات أو الأشكال الأخرى.",
  };
  return messages[status] ?? null;
}
