import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { requirePageSession, sessionFromRequest } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { apiError } from "@/lib/schemas";
export async function authorizeAdmin(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return { response: NextResponse.json(apiError("UNAUTHORIZED", "سجّل الدخول أولًا."), { status: 401 }) };
  try {
    const profile = await getProfile(session.sub);
    if (profile?.role !== "admin") return { response: NextResponse.json(apiError("FORBIDDEN", "هذه الصفحة متاحة لمدير المنصة فقط."), { status: 403 }) };
    return { session, profile };
  } catch { return { response: NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر التحقق من الصلاحيات حاليًا."), { status: 503 }) }; }
}
export async function requireAdminPage() {
  const session = await requirePageSession();
  const profile = await getProfile(session.sub);
  if (profile?.role !== "admin") redirect("/profile");
  return profile;
}
