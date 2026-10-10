import { NextResponse } from "next/server";
import { intakeRequestSchema, apiError } from "@/lib/schemas";
import {
  coverageMessage,
  coverageStatus,
  heuristicExtract,
  mergeSlots,
  missingSlotKeys,
  nextQuestion,
  trustedAISlots,
} from "@/lib/intake";
import { classifyRequestWithAI, extractSlotsWithAI } from "@/lib/ai/service";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { analyzeIntentWithRules, stabilizeIntent, supportedServices, unsupportedServiceMessageAr } from "@/lib/request-intent";
import { jsonWithHistory } from "@/lib/api-history";
import { hasKnowledgeMatch } from "@/lib/retrieval";

export async function POST(request: Request) {
  const limit = rateLimit(`intake:${requestKey(request)}`);
  if (!limit.allowed) {
    return NextResponse.json(apiError("RATE_LIMITED", "طلبات كثيرة خلال وقت قصير. جرّب بعد لحظات.", true), {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const parsed = intakeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(apiError("INVALID_INPUT", "تحقق من الهدف والإجابات المرسلة."), { status: 400 });
  }

  const ruleIntent = analyzeIntentWithRules(parsed.data.goal);
  let requestIntent = ruleIntent.intent === "unclear" && hasKnowledgeMatch(parsed.data.goal)
    ? "knowledge_question"
    : ruleIntent.intent;
  let intentUsedAI = false;
  if (requestIntent === "unclear" && ruleIntent.confidence === "low" && process.env.INTENT_AI_ENABLED === "true") {
    try {
      requestIntent = stabilizeIntent(parsed.data.goal, await classifyRequestWithAI(parsed.data.goal));
      intentUsedAI = true;
    } catch {
      requestIntent = "unclear";
    }
  }

  if (requestIntent === "unsupported_service") {
    return jsonWithHistory(request, "intake", parsed.data.goal, {
      normalizedSlots: {},
      missingSlots: [],
      nextQuestion: null,
      coverageStatus: "unsupported_service",
      coverageMessageAr: unsupportedServiceMessageAr,
      aiMode: intentUsedAI ? "ollama" : "rules",
      requestIntent,
      supportedServices,
    });
  }

  if (requestIntent === "knowledge_question") {
    return jsonWithHistory(request, "intake", parsed.data.goal, {
      normalizedSlots: {},
      missingSlots: [],
      nextQuestion: null,
      coverageStatus: "route_to_knowledge",
      coverageMessageAr: null,
      aiMode: intentUsedAI ? "ollama" : "rules",
      requestIntent,
    });
  }

  if (requestIntent === "unclear") {
    return jsonWithHistory(request, "intake", parsed.data.goal, {
      normalizedSlots: {},
      missingSlots: [],
      nextQuestion: null,
      coverageStatus: "needs_intent_clarification",
      coverageMessageAr: "ما قدرت أحدد إذا طلبك فكرة مشروع أم سؤالًا عن المصادر. اكتب مثلًا: «بدي أفتح محل حلويات بخلدا» أو اختر «اسأل المصادر» لسؤال معرفي.",
      aiMode: intentUsedAI ? "ollama" : "fallback",
      requestIntent,
      supportedServices,
    });
  }

  const heuristic = heuristicExtract(parsed.data.goal);
  let aiSlots = {};
  let aiMode: "ollama" | "rules" | "fallback" = intentUsedAI ? "ollama" : "rules";
  const isInitialExtraction = Object.values(parsed.data.slots).every((value) => value == null);
  const heuristicNeedsHelp = missingSlotKeys(heuristic).length > 0;
  const heuristicAlreadyOutsideCoverage = coverageStatus(heuristic).startsWith("unsupported");
  if (process.env.INTAKE_SLOT_AI_ENABLED === "true" && isInitialExtraction && heuristicNeedsHelp && !heuristicAlreadyOutsideCoverage) {
    try {
      aiSlots = trustedAISlots(await extractSlotsWithAI(parsed.data.goal));
      aiMode = "ollama";
    } catch {
      aiMode = "fallback";
      // Expected fallback: the deterministic wizard remains fully functional.
    }
  }

  // Exact deterministic matches beat probabilistic extraction; explicit user
  // choices always have the final say.
  const normalizedSlots = mergeSlots(aiSlots, heuristic, parsed.data.slots);
  const status = coverageStatus(normalizedSlots);
  return jsonWithHistory(request, "intake", parsed.data.goal, {
    normalizedSlots,
    missingSlots: missingSlotKeys(normalizedSlots),
    nextQuestion: nextQuestion(normalizedSlots),
    coverageStatus: status,
    coverageMessageAr: coverageMessage(status),
    aiMode,
    requestIntent,
  });
}
