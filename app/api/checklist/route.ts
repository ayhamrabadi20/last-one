import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionFromRequest } from "@/lib/auth";
import { requireDatabase } from "@/lib/mongodb";
import { apiError } from "@/lib/schemas";
import { rateLimit, requestKey } from "@/lib/rate-limit";

const schema = z.object({ key: z.string().min(1).max(1000), knowledgeVersion: z.string().min(1).max(100), checkedIds: z.array(z.string().min(1).max(200)).max(200) });
export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json(apiError("UNAUTHORIZED", "سجّل الدخول لعرض تقدّمك."), { status: 401 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key || key.length > 1000) return NextResponse.json(apiError("INVALID_CHECKLIST", "بيانات الرحلة غير صالحة."), { status: 400 });
  try {
    const collection = (await requireDatabase()).collection("checklists");
    const stored = await collection.findOne({ userId: session.sub, key });
    return NextResponse.json({ checklist: stored ? { knowledgeVersion: stored.knowledgeVersion, checkedIds: stored.checkedIds } : null });
  } catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر تحميل التقدّم المحفوظ. حاول مجددًا."), { status: 503 }); }
}
export async function PUT(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json(apiError("UNAUTHORIZED", "سجّل الدخول لحفظ تقدّمك."), { status: 401 });
  if (!rateLimit(`checklist:${requestKey(request)}`).allowed) return NextResponse.json(apiError("RATE_LIMITED", "انتظر قليلًا ثم حاول مجددًا."), { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(apiError("INVALID_CHECKLIST", "بيانات القائمة غير صالحة."), { status: 400 });
  try {
    const collection = (await requireDatabase()).collection("checklists");
    await collection.createIndex({ userId: 1, key: 1 }, { unique: true });
    await collection.updateOne({ userId: session.sub, key: parsed.data.key }, { $set: { ...parsed.data, checkedIds: [...new Set(parsed.data.checkedIds)], updatedAt: new Date() } }, { upsert: true });
    return NextResponse.json({ saved: true });
  } catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر حفظ التقدّم. حاول مجددًا."), { status: 503 }); }
}
