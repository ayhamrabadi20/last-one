import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccountSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { apiError } from "@/lib/schemas";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { authenticateAccount } from "@/lib/accounts";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const limit = rateLimit(`login:${requestKey(request)}`);
  if (!limit.allowed) {
    return NextResponse.json(apiError("RATE_LIMITED", "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.", true), { status: 429 });
  }
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(apiError("INVALID_LOGIN", "أدخل اسم المستخدم وكلمة المرور."), { status: 400 });
  }
  let identity: string | undefined;
  let isAdmin = false;
    try {
      const user = await authenticateAccount(parsed.data.username.toLowerCase(), parsed.data.password);
      identity = user?.username || user?.email;
      isAdmin = user?.role === "admin";
    }
    catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر تسجيل الدخول حاليًا. حاول لاحقًا."), { status: 503 }); }
  if (!identity) {
    return NextResponse.json(apiError("INVALID_CREDENTIALS", "بيانات الدخول غير صحيحة أو الحساب غير متاح للدخول."), { status: 401 });
  }
  const response = NextResponse.json({ ok: true, user: { username: identity }, redirectTo: isAdmin ? "/admin" : "/" });
  try { response.cookies.set(SESSION_COOKIE, await createAccountSession(identity), sessionCookieOptions); }
  catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر إنشاء جلسة الدخول."), { status: 503 }); }
  return response;
}
