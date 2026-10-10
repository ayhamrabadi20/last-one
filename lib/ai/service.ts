import { z } from "zod";
import { answerOutputSchema, extractionOutputSchema, requestIntentOutputSchema, type GroundedAnswer } from "@/lib/schemas";
import { explorationProfileSchema } from "@/lib/explore-schema";
import type { Chunk } from "@/lib/knowledge";
import { chatJson, AIUnavailableError } from "@/lib/ai/provider";
import { explorationProfileSystemPrompt, extractionSystemPrompt, groundedAnswerSystemPrompt, requestIntentSystemPrompt } from "@/lib/ai/prompts";
import { normalizeArabic, tokenizeArabic } from "@/lib/retrieval";

const extractionJsonSchema = {
  type: "object",
  properties: {
    activityId: { type: ["string", "null"], enum: ["clothing-retail", "other", null] },
    municipalityId: { type: ["string", "null"], enum: ["amman", "other", null] },
    legalForm: { type: ["string", "null"], enum: ["sole-proprietorship", "company", "other", null] },
    premisesTenure: { type: ["string", "null"], enum: ["rent", "own", "unknown", null] },
  },
  required: ["activityId", "municipalityId", "legalForm", "premisesTenure"],
  additionalProperties: false,
};

const answerJsonSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answered", "insufficient_evidence"] },
    answer: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          evidenceChunkIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
        },
        required: ["text", "evidenceChunkIds"],
        additionalProperties: false,
      },
    },
  },
  required: ["status", "answer", "claims"],
  additionalProperties: false,
};

const explorationProfileJsonSchema = {
  type: "object",
  properties: {
    activityAr: { type: "string" },
    locationAr: { type: ["string", "null"] },
    category: { type: "string", enum: ["food", "retail", "services", "digital", "manufacturing", "other"] },
    businessModel: { type: "string", enum: ["physical", "online", "mixed", "unknown"] },
    premisesTenure: { type: "string", enum: ["rent", "own", "unknown"] },
  },
  required: ["activityAr", "locationAr", "category", "businessModel", "premisesTenure"],
  additionalProperties: false,
};

const requestIntentJsonSchema = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["business_journey", "knowledge_question", "unsupported_service", "unclear"] },
  },
  required: ["intent"],
  additionalProperties: false,
};

function parseJson<T>(content: string, schema: z.ZodType<T>) {
  const parsed = JSON.parse(content) as unknown;
  return schema.parse(parsed);
}

export async function extractSlotsWithAI(goal: string) {
  const first = await chatJson(
    [
      { role: "system", content: extractionSystemPrompt },
      { role: "user", content: goal },
    ],
    extractionJsonSchema,
  );
  try {
    return parseJson(first.content, extractionOutputSchema);
  } catch {
    const repaired = await chatJson(
      [
        { role: "system", content: extractionSystemPrompt },
        { role: "user", content: goal },
        { role: "assistant", content: first.content },
        { role: "user", content: "أصلح الناتج ليطابق JSON المطلوب فقط دون شرح." },
      ],
      extractionJsonSchema,
    );
    return parseJson(repaired.content, extractionOutputSchema);
  }
}

export async function classifyRequestWithAI(input: string) {
  const result = await chatJson(
    [
      { role: "system", content: requestIntentSystemPrompt },
      { role: "user", content: input },
    ],
    requestIntentJsonSchema,
  );
  return parseJson(result.content, requestIntentOutputSchema).intent;
}

export async function extractExplorationProfile(goal: string) {
  const result = await chatJson(
    [
      { role: "system", content: explorationProfileSystemPrompt },
      { role: "user", content: goal },
    ],
    explorationProfileJsonSchema,
  );
  return parseJson(result.content, explorationProfileSchema);
}

export function validateGrounding(answer: GroundedAnswer, chunks: Chunk[], question?: string) {
  const allowed = new Set(chunks.map((chunk) => chunk.id));
  for (const claim of answer.claims) {
    if (claim.evidenceChunkIds.some((id) => !allowed.has(id))) {
      throw new AIUnavailableError("أعاد النموذج استشهادًا غير موجود في السياق.", "INVALID_AI_OUTPUT");
    }
  }
  if (answer.status === "answered" && answer.claims.length === 0) {
    throw new AIUnavailableError("الإجابة بلا ادعاءات مسندة.", "INVALID_AI_OUTPUT");
  }
  if (answer.status === "insufficient_evidence") return answer;
  for (const claim of answer.claims) {
    const cited = chunks.filter((chunk) => claim.evidenceChunkIds.includes(chunk.id));
    const evidenceText = cited.map((chunk) => chunk.text).join(" ");
    const claimTerms = tokenizeArabic(claim.text);
    const evidenceTerms = new Set(tokenizeArabic(evidenceText));
    const matched = claimTerms.filter((term) => evidenceTerms.has(term)).length;
    const required = Math.min(2, claimTerms.length);
    const overlap = matched / Math.max(1, claimTerms.length);
    const claimUrls = claim.text.match(/(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|net|org|gov|jo|sa)\b/gi) ?? [];
    const containsUnseenUrl = claimUrls.some((url) => !evidenceText.includes(url));
    const echoesQuestion = question ? normalizeArabic(claim.text) === normalizeArabic(question) : false;
    if (!claimTerms.length || matched < required || overlap < 0.42 || containsUnseenUrl || echoesQuestion) {
      throw new AIUnavailableError("أعاد النموذج ادعاءً لا يمكن التحقق منه نصيًا من المقطع.", "INVALID_AI_OUTPUT");
    }
  }
  // The free-form answer can contain material not represented in claims. The
  // server therefore publishes only the individually validated claim texts.
  return { ...answer, answer: answer.claims.map((claim) => claim.text).join(" ") };
}

export async function answerWithAI(question: string, chunks: Chunk[]) {
  const useThinking = process.env.AI_ANSWER_THINK === "true";
  const answerTokenLimit = Number(process.env.AI_ANSWER_MAX_OUTPUT_TOKENS ?? 220);
  const messages = [
    { role: "system" as const, content: groundedAnswerSystemPrompt(chunks) },
    { role: "user" as const, content: question },
  ];
  const first = await chatJson(messages, answerJsonSchema, { think: useThinking, maxOutputTokens: answerTokenLimit });
  try {
    return validateGrounding(parseJson(first.content, answerOutputSchema), chunks, question);
  } catch {
    const repaired = await chatJson(
      [
        ...messages,
        { role: "assistant", content: first.content } as const,
        {
          role: "user",
          content: "أصلح JSON فقط. استخدم معرفات المقاطع المعروضة حصراً، واجعل لكل ادعاء معرف دليل واحدًا على الأقل.",
        } as const,
      ],
      answerJsonSchema,
      { think: useThinking, maxOutputTokens: answerTokenLimit },
    );
    return validateGrounding(parseJson(repaired.content, answerOutputSchema), chunks, question);
  }
}
