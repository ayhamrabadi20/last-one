import { NextResponse } from "next/server";
import { apiError, completeSlotsSchema, journeyRequestSchema } from "@/lib/schemas";
import { buildJourney } from "@/lib/rules";
import { coverageMessage, coverageStatus, missingSlotKeys } from "@/lib/intake";
import { jsonWithHistory } from "@/lib/api-history";

export async function POST(request: Request) {
  const parsed = journeyRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(apiError("INVALID_INPUT", "تعذر قراءة حالة الرحلة."), { status: 400 });
  }
  const coverage = coverageStatus(parsed.data.slots);
  if (coverage.startsWith("unsupported")) {
    return NextResponse.json(
      { ...apiError("OUT_OF_SCOPE", coverageMessage(coverage) ?? "الحالة خارج نطاق النسخة الحالية."), coverageStatus: coverage },
      { status: 422 },
    );
  }
  const missing = missingSlotKeys(parsed.data.slots);
  if (missing.length) {
    return NextResponse.json(
      { ...apiError("MISSING_SLOTS", "أكمل المعلومات الناقصة قبل بناء الرحلة."), missingSlots: missing },
      { status: 422 },
    );
  }
  const complete = completeSlotsSchema.safeParse(parsed.data.slots);
  if (!complete.success) {
    return NextResponse.json(apiError("UNSUPPORTED_STATE", "هذه الحالة غير مدعومة في النسخة الحالية."), { status: 422 });
  }
  try {
    return jsonWithHistory(request, "journey", JSON.stringify(complete.data), buildJourney(complete.data));
  } catch {
    return NextResponse.json(apiError("RULES_ERROR", "تعذر ترتيب الرحلة بسبب خطأ في بيانات القواعد."), { status: 500 });
  }
}
