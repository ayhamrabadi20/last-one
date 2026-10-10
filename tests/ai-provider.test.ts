import { afterEach, describe, expect, it, vi } from "vitest";
import { chatJson, getOllamaStatus } from "@/lib/ai/provider";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_TIMEOUT_MS;
  delete process.env.AI_RETRY_COUNT;
  delete process.env.OLLAMA_BASE_URL;
});

describe("Ollama failure handling", () => {
  it("turns an aborted local request into a typed timeout without crashing", async () => {
    process.env.AI_PROVIDER = "ollama";
    process.env.AI_ENABLED = "true";
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    process.env.AI_TIMEOUT_MS = "5";
    process.env.AI_RETRY_COUNT = "0";
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    ));

    await expect(chatJson([{ role: "user", content: "اختبار" }], { type: "object" }))
      .rejects.toMatchObject({ code: "AI_TIMEOUT" });
  });

  it("retries a timeout once when configured", async () => {
    process.env.AI_PROVIDER = "ollama";
    process.env.AI_ENABLED = "true";
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    process.env.AI_TIMEOUT_MS = "5";
    process.env.AI_RETRY_COUNT = "1";
    const mockedFetch = vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    );
    vi.stubGlobal("fetch", mockedFetch);

    await expect(chatJson([{ role: "user", content: "اختبار" }], { type: "object" }))
      .rejects.toMatchObject({ code: "AI_TIMEOUT" });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("reports fallback instead of crashing on a malformed local URL", async () => {
    process.env.OLLAMA_BASE_URL = "not a url";
    await expect(getOllamaStatus()).resolves.toMatchObject({
      available: false,
      reason: "OLLAMA_UNREACHABLE",
    });
  });
});
