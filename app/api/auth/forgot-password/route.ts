import { NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordReset } from "@/lib/accounts";
import { apiError } from "@/lib/schemas";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!rateLimit(`forgot:${requestKey(request)}`).allowed) return NextResponse.json(apiError("RATE_LIMITED", "انتظر قليلًا ثم حاول مجددًا."), { status: 429 });
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(apiError("INVALID_EMAIL", "أدخل بريدًا إلكترونيًا صحيحًا."), { status: 400 });
  // No mail provider is configured: never expose recovery tokens in production.
  if (process.env.NODE_ENV === "production") return NextResponse.json(apiError("MAIL_UNAVAILABLE", "خدمة إرسال رابط الاستعادة غير مفعّلة بعد. تواصل مع مسؤول التطبيق."), { status: 503 });
  try {
    const token = await createPasswordReset(parsed.data.email);
    return NextResponse.json({ ok: true, resetUrl: token ? `/reset-password?token=${token}` : undefined });
  } catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر إكمال الطلب حاليًا."), { status: 503 }); }
}
