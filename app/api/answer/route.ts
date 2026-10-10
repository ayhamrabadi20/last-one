import { NextResponse } from "next/server";
import { answerRequestSchema, apiError } from "@/lib/schemas";
import { retrieve } from "@/lib/retrieval";
import { answerWithAI } from "@/lib/ai/service";
import { sourceById } from "@/lib/knowledge";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { coverageMessage, coverageStatus, heuristicExtract } from "@/lib/intake";
import { analyzeIntentWithRules, supportedServices, unsupportedServiceMessageAr } from "@/lib/request-intent";
import { jsonWithHistory } from "@/lib/api-history";

export async function POST(request: Request) {
  const limit = rateLimit(`answer:${requestKey(request)}`);
  if (!limit.allowed) {
    return NextResponse.json(apiError("RATE_LIMITED", "طلبات كثيرة خلال وقت قصير. جرّب بعد لحظات.", true), {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }
  const parsed = answerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(apiError("INVALID_INPUT", "تحقق من السؤال والحالة المرسلة."), { status: 400 });
  }

  if (analyzeIntentWithRules(parsed.data.question).intent === "unsupported_service") {
    return jsonWithHistory(request, "knowledge_answer", parsed.data.question, {
      status: "insufficient_evidence",
      answer: unsupportedServiceMessageAr,
      claims: [],
      citations: [],
      aiMode: "not_called",
      contentStatus: "unsupported_service",
      supportedServices,
    });
  }

  // Never answer a question about an explicitly different activity, legal
  // form, or municipality using the clothing/Amman knowledge base—even when
  // generic words such as "registration" happen to match a chunk.
  const questionScope = heuristicExtract(parsed.data.question);
  const explicitCoverage = coverageStatus(questionScope);
  if (explicitCoverage.startsWith("unsupported")) {
    return jsonWithHistory(request, "knowledge_answer", parsed.data.question, {
      status: "insufficient_evidence",
      answer: `${coverageMessage(explicitCoverage)} لن أجيب بمتطلبات محل الملابس على حالة مختلفة.`,
      claims: [],
      citations: [],
      aiMode: "not_called",
      contentStatus: "outside_coverage",
    });
  }

  const retrieved = retrieve(parsed.data.question, { procedureId: parsed.data.procedureId });
  if (!retrieved.length) {
    return jsonWithHistory(request, "knowledge_answer", parsed.data.question, {
      status: "insufficient_evidence",
      answer: "لا توجد في قاعدة المعرفة الحالية مقاطع كافية للإجابة عن هذا السؤال دون تخمين.",
      claims: [],
      citations: [],
      aiMode: "not_called",
    });
  }

  const chunks = retrieved.map((item) => item.chunk);
  const responseMode = process.env.RAG_RESPONSE_MODE ?? "hybrid";
  const isShortPhrase = !/[؟?]/.test(parsed.data.question) &&
    !/^(?:شو|ما|ماذا|كيف|هل|وين|اين|أين|متى|كم|ليش|لماذا|ايش|إيش)\b/.test(parsed.data.question.trim()) &&
    parsed.data.question.trim().split(/\s+/).length <= 8;
  if (responseMode === "extractive" || (responseMode === "hybrid" && isShortPhrase)) {
    const primaryChunk = chunks[0];
    const primarySource = sourceById(primaryChunk.sourceId);
    return jsonWithHistory(request, "knowledge_answer", parsed.data.question, {
      status: "answered",
      answer: primaryChunk.text,
      claims: [{ text: primaryChunk.text, evidenceChunkIds: [primaryChunk.id] }],
      citations: primarySource ? [{ chunk: primaryChunk, source: primarySource }] : [],
      aiMode: "extractive",
      contentStatus: process.env.KNOWLEDGE_MODE === "production" ? "reviewed" : "demo_pending_review",
    });
  }
  try {
    const answer = await answerWithAI(parsed.data.question, chunks);
    const citedIds = new Set(answer.claims.flatMap((claim) => claim.evidenceChunkIds));
    const citations = chunks
      .filter((chunk) => citedIds.has(chunk.id))
      .map((chunk) => ({ chunk, source: sourceById(chunk.sourceId) }))
      .filter((item) => item.source);
    return jsonWithHistory(request, "knowledge_answer", parsed.data.question, {
      ...answer,
      citations,
      aiMode: "ollama",
      contentStatus: process.env.KNOWLEDGE_MODE === "production" ? "reviewed" : "demo_pending_review",
    });
  } catch {
    const primaryChunk = chunks[0];
    const primarySource = sourceById(primaryChunk.sourceId);
    return jsonWithHistory(request, "knowledge_answer", parsed.data.question, {
      status: "answered",
      answer: `بحسب المقطع الأكثر صلة في قاعدة المعرفة: ${primaryChunk.text}`,
      claims: [{ text: primaryChunk.text, evidenceChunkIds: [primaryChunk.id] }],
      citations: primarySource ? [{ chunk: primaryChunk, source: primarySource }] : [],
      aiMode: "fallback",
      contentStatus: process.env.KNOWLEDGE_MODE === "production" ? "reviewed" : "demo_pending_review",
    });
  }
}
