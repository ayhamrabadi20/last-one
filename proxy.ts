import { NextResponse, type NextRequest } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/auth/") || path === "/api/status") return NextResponse.next();
  if (!await sessionFromRequest(request)) return NextResponse.json({ error: { code: "UNAUTHORIZED", messageAr: "الجلسة غير متاحة. سجّل الدخول بحساب مفعّل." } }, { status: 401 });
  return NextResponse.next();
}
export const config = { matcher: ["/api/:path*"] };
