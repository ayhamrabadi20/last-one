import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { saveInteraction, type InteractionType } from "@/lib/interaction-history";
import { apiError } from "@/lib/schemas";

export async function jsonWithHistory(
  request: Request,
  type: InteractionType,
  input: string,
  payload: Record<string, unknown>,
  init?: ResponseInit,
) {
  const session = await sessionFromRequest(request);
  const key=request.headers.get("x-request-id");
  const requestKey=key&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key)?key:undefined;
  const storage = session
    ? await saveInteraction({ userId: session.sub, type, input, response: payload, ...(requestKey?{requestKey}:{}) })
    : { saved: false as const, reason: "unauthenticated" as const };
  if (!storage.saved) return NextResponse.json(apiError(
    storage.reason === "unauthenticated" ? "UNAUTHORIZED" : "STORAGE_UNAVAILABLE",
    storage.reason === "unauthenticated" ? "سجّل الدخول لحفظ طلباتك." : "تعذر حفظ الطلب في قاعدة البيانات. حاول مجددًا.",
  ), { status: storage.reason === "unauthenticated" ? 401 : 503 });
  return NextResponse.json({ ...payload, historyStorage: storage }, init);
}
