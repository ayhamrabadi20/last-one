import { NextResponse } from "next/server";
import { z } from "zod";
import { registerAccount } from "@/lib/accounts";
import { createAccountSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { apiError } from "@/lib/schemas";
import { rateLimit, requestKey } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().regex(/^\+?[0-9\s()-]{8,20}$/),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  if (!rateLimit(`register:${requestKey(request)}`).allowed) return NextResponse.json(apiError("RATE_LIMITED", "انتظر قليلًا ثم حاول مجددًا."), { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(apiError("INVALID_ACCOUNT", "تحقق من الاسم والبريد ورقم الهاتف. كلمة المرور يجب أن تكون 8 أحرف على الأقل."), { status: 400 });
  try {
    if (!await registerAccount(parsed.data)) return NextResponse.json(apiError("EMAIL_EXISTS", "هذا البريد مسجل مسبقًا. سجّل الدخول أو استعد كلمة المرور."), { status: 409 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, await createAccountSession(parsed.data.email), sessionCookieOptions);
    return response;
  } catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر إنشاء الحساب حاليًا. حاول لاحقًا."), { status: 503 }); }
}
