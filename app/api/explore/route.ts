import { NextResponse } from "next/server";
import { apiError } from "@/lib/schemas";
import { exploreRequestSchema } from "@/lib/explore-schema";
import { extractExplorationProfile } from "@/lib/ai/service";
import { buildExplorationPlan, explorationProfileNeedsAI, fallbackExplorationProfile, stabilizeExplorationProfile } from "@/lib/explore";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { jsonWithHistory } from "@/lib/api-history";

export async function POST(request: Request) {
  const limit = rateLimit(`explore:${requestKey(request)}`);
  if (!limit.allowed) {
    return NextResponse.json(apiError("RATE_LIMITED", "طلبات كثيرة خلال وقت قصير. جرّب بعد لحظات.", true), {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const parsed = exploreRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(apiError("INVALID_INPUT", "اكتب وصفًا أوضح للمشروع."), { status: 400 });
  }

  let profile = fallbackExplorationProfile(parsed.data.goal);
  let aiMode: "ollama" | "fallback" = "fallback";
  const explorationAI = process.env.EXPLORATION_AI_MODE ?? "smart";
  const shouldCallAI = explorationAI === "always" || (explorationAI === "smart" && explorationProfileNeedsAI(profile));
  if (shouldCallAI) {
    try {
      profile = stabilizeExplorationProfile(parsed.data.goal, await extractExplorationProfile(parsed.data.goal));
      aiMode = "ollama";
    } catch {
      // The deterministic discovery plan remains useful when Ollama is offline.
    }
  }

  return jsonWithHistory(request, "exploration", parsed.data.goal, buildExplorationPlan(parsed.data.goal, profile, aiMode));
}
