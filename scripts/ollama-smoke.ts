import { performance } from "node:perf_hooks";
import { extractSlotsWithAI, answerWithAI } from "../lib/ai/service";
import { retrieve } from "../lib/retrieval";

async function timed<T>(name: string, action: () => Promise<T>) {
  const start = performance.now();
  const result = await action();
  const elapsed = Math.round(performance.now() - start);
  console.log(`${name}: ${elapsed}ms`);
  return { result, elapsed };
}

async function main() {
  process.env.KNOWLEDGE_MODE = "demo";
  const extraction = await timed("Arabic slot extraction (cold)", () =>
    extractSlotsWithAI("بدي أفتح محل ملابس مستأجر بعمّان كمؤسسة فردية"),
  );
  const extractionValid =
    extraction.result.activityId === "clothing-retail" &&
    extraction.result.municipalityId === "amman" &&
    extraction.result.legalForm === "sole-proprietorship" &&
    extraction.result.premisesTenure === "rent";

  const warm = await timed("Arabic slot extraction (warm)", () =>
    extractSlotsWithAI("أريد متجر ملابس في عمان والمحل ملكي كمؤسسة فردية"),
  );
  const warmValid = warm.result.premisesTenure === "own";

  const retrieved = retrieve("ما الوثيقة المرتبطة بالمحل المستأجر؟");
  const answer = await timed("Grounded Arabic answer", () =>
    answerWithAI("ما الوثيقة المرتبطة بالمحل المستأجر؟", retrieved.map((item) => item.chunk)),
  );
  const citationValid = answer.result.status === "answered" &&
    answer.result.claims.every((claim) =>
      claim.evidenceChunkIds.every((id) => retrieved.some((item) => item.chunk.id === id)),
    );

  console.log(JSON.stringify({
    model: process.env.OLLAMA_MODEL ?? "qwen3:1.7b",
    extractionValid,
    warmExtractionValid: warmValid,
    groundedAnswerValid: citationValid,
    retrievedChunkIds: retrieved.map((item) => item.chunk.id),
    answerStatus: answer.result.status,
    answerText: answer.result.answer,
    answerClaims: answer.result.claims,
    recommendedTimeoutMs: Math.max(20_000, Math.ceil(Math.max(extraction.elapsed, warm.elapsed, answer.elapsed) * 1.6 / 1000) * 1000),
  }, null, 2));

  if (!extractionValid || !warmValid || !citationValid) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Ollama smoke test failed");
  process.exitCode = 1;
});
