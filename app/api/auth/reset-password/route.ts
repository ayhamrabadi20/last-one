import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/accounts";
import { apiError } from "@/lib/schemas";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!rateLimit(`reset:${requestKey(request)}`).allowed) return NextResponse.json(apiError("RATE_LIMITED", "انتظر قليلًا ثم حاول مجددًا."), { status: 429 });
  const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(8).max(128) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(apiError("INVALID_RESET", "تحقق من الرابط وأدخل كلمة مرور من 8 أحرف على الأقل."), { status: 400 });
  try {
    if (!await resetPassword(parsed.data.token, parsed.data.password)) return NextResponse.json(apiError("EXPIRED_RESET", "الرابط غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا."), { status: 400 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر تغيير كلمة المرور حاليًا."), { status: 503 }); }
}
