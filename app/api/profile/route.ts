import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionFromRequest } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { requireDatabase } from "@/lib/mongodb";
import { apiError } from "@/lib/schemas";
import { rateLimit, requestKey } from "@/lib/rate-limit";
export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json(apiError("UNAUTHORIZED", "سجّل الدخول لعرض ملفك."), { status: 401 });
  try {
    const profile = await getProfile(session.sub);
    if (!profile) return NextResponse.json(apiError("ACCOUNT_NOT_FOUND", "الحساب غير موجود. أعد تسجيل الدخول."), { status: 404 });
    const db = await requireDatabase();
    const [requests, checklists, tickets] = await Promise.all([db.collection("interactions").countDocuments({ userId: session.sub }), db.collection("checklists").countDocuments({ userId: session.sub }), db.collection("support_tickets").countDocuments({ userId: session.sub })]);
    return NextResponse.json({ profile, stats: { requests, checklists, tickets } });
  } catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر تحميل بيانات حسابك. حاول مجددًا."), { status: 503 }); }
}
export async function PATCH(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json(apiError("UNAUTHORIZED", "سجّل الدخول لتعديل بياناتك."), { status: 401 });
  if (!rateLimit(`profile:${requestKey(request)}`).allowed) return NextResponse.json(apiError("RATE_LIMITED", "انتظر قليلًا ثم حاول مجددًا."), { status: 429 });
  const parsed = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().regex(/^\+?[0-9\s()-]{8,20}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(apiError("INVALID_PROFILE", "أدخل اسمًا من حرفين على الأقل ورقم هاتف صحيحًا."), { status: 400 });
  try {
    const result = await (await requireDatabase()).collection("accounts").updateOne({ $or: [{ email: session.sub }, { username: session.sub }] }, { $set: parsed.data });
    if (!result.matchedCount) return NextResponse.json(apiError("ACCOUNT_NOT_FOUND", "الحساب غير موجود."), { status: 404 });
    return NextResponse.json({ profile: await getProfile(session.sub) });
  } catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر حفظ بياناتك."), { status: 503 }); }
}
