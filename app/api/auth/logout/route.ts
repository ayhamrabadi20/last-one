import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, revokeRequestSession } from "@/lib/auth";

export async function POST(request: Request) {
  await revokeRequestSession(request);
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
