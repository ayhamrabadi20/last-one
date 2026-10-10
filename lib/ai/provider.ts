type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AIMode = "ollama" | "fallback" | "disabled";

export class AIUnavailableError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "AI_DISABLED"
      | "OLLAMA_UNREACHABLE"
      | "MODEL_NOT_INSTALLED"
      | "AI_TIMEOUT"
      | "INVALID_AI_OUTPUT",
  ) {
    super(message);
  }
}

function boundedNumber(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function config() {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new AIUnavailableError("عنوان Ollama المحلي غير صالح.", "OLLAMA_UNREACHABLE");
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
    throw new AIUnavailableError("يجب أن يبقى Ollama على الجهاز المحلي.", "OLLAMA_UNREACHABLE");
  }
  return {
    enabled: process.env.AI_ENABLED !== "false",
    provider: process.env.AI_PROVIDER ?? "ollama",
    baseUrl: parsed.origin,
    model: process.env.OLLAMA_MODEL ?? "qwen3:1.7b",
    contextLength: boundedNumber(process.env.OLLAMA_NUM_CTX, 4096, 2048, 8192),
    maxOutputTokens: boundedNumber(process.env.AI_MAX_OUTPUT_TOKENS, 600, 128, 1200),
    timeoutMs: boundedNumber(process.env.AI_TIMEOUT_MS, 65_000, 1, 120_000),
    retries: boundedNumber(process.env.AI_RETRY_COUNT, 1, 0, 2),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIUnavailableError("انتهت مهلة استجابة النموذج المحلي.", "AI_TIMEOUT");
    }
    throw new AIUnavailableError("تعذر الاتصال بخدمة Ollama المحلية.", "OLLAMA_UNREACHABLE");
  } finally {
    clearTimeout(timeout);
  }
}

export async function getOllamaStatus() {
  let current: ReturnType<typeof config>;
  try {
    current = config();
  } catch {
    return {
      available: false,
      mode: "fallback" as const,
      model: process.env.OLLAMA_MODEL ?? "qwen3:1.7b",
      reason: "OLLAMA_UNREACHABLE",
    };
  }
  if (!current.enabled) {
    return { available: false, mode: "disabled" as const, model: current.model, reason: "AI_DISABLED" };
  }
  if (current.provider !== "ollama") {
    return { available: false, mode: "disabled" as const, model: current.model, reason: "UNSUPPORTED_PROVIDER" };
  }
  try {
    const response = await fetchWithTimeout(`${current.baseUrl}/api/tags`, { method: "GET" }, 2500);
    if (!response.ok) throw new Error("status");
    const data = (await response.json()) as { models?: Array<{ name: string; model?: string }> };
    const installed = data.models?.some(
      (item) => item.name === current.model || item.model === current.model || item.name.startsWith(`${current.model}:`),
    );
    return {
      available: Boolean(installed),
      mode: installed ? ("ollama" as const) : ("fallback" as const),
      model: current.model,
      reason: installed ? null : "MODEL_NOT_INSTALLED",
    };
  } catch {
    return { available: false, mode: "fallback" as const, model: current.model, reason: "OLLAMA_UNREACHABLE" };
  }
}

export async function chatJson(
  messages: ChatMessage[],
  jsonSchema: Record<string, unknown>,
  generation: { think?: boolean; maxOutputTokens?: number } = {},
) {
  const current = config();
  if (!current.enabled) throw new AIUnavailableError("الذكاء الاصطناعي معطل.", "AI_DISABLED");
  if (current.provider !== "ollama") throw new AIUnavailableError("مزود غير مدعوم.", "AI_DISABLED");

  let lastError: unknown;
  for (let attempt = 0; attempt <= current.retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        `${current.baseUrl}/api/chat`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: current.model,
            messages,
            stream: false,
            think: generation.think ?? false,
            format: jsonSchema,
            options: {
              temperature: 0,
              num_ctx: current.contextLength,
              num_predict: generation.maxOutputTokens
                ? Math.min(current.maxOutputTokens, Math.max(64, generation.maxOutputTokens))
                : current.maxOutputTokens,
            },
            keep_alive: "10m",
          }),
        },
        current.timeoutMs,
      );
      if (response.status === 404) {
        throw new AIUnavailableError("النموذج المحدد غير مثبت في Ollama.", "MODEL_NOT_INSTALLED");
      }
      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        if (retryable && attempt < current.retries) continue;
        throw new AIUnavailableError("فشل النموذج المحلي في معالجة الطلب.", "OLLAMA_UNREACHABLE");
      }
      const payload = (await response.json()) as { message?: { content?: string } };
      if (!payload.message?.content) {
        throw new AIUnavailableError("أعاد النموذج استجابة فارغة.", "INVALID_AI_OUTPUT");
      }
      return { content: payload.message.content, model: current.model };
    } catch (error) {
      lastError = error;
      const retryable = error instanceof AIUnavailableError &&
        (error.code === "OLLAMA_UNREACHABLE" || error.code === "AI_TIMEOUT");
      if (!retryable || attempt >= current.retries) throw error;
    }
  }
  throw lastError;
}
