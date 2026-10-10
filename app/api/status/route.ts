import { NextResponse } from "next/server";
import { getOllamaStatus } from "@/lib/ai/provider";

export async function GET() {
  const status = await getOllamaStatus();
  return NextResponse.json({
    ...status,
    messageAr: status.available
      ? `Ollama متصل والنموذج ${status.model} جاهز.`
      : status.reason === "MODEL_NOT_INSTALLED"
        ? `Ollama يعمل، لكن النموذج ${status.model} غير مثبت. تستمر الأسئلة والقواعد دون AI.`
        : "Ollama غير متاح الآن. تستمر الأسئلة والقواعد دون AI.",
  });
}
