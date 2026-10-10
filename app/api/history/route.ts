import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { listInteractions } from "@/lib/interaction-history";
import { apiError } from "@/lib/schemas";

export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json(apiError("UNAUTHORIZED", "سجّل الدخول لعرض السجل."), { status: 401 });
  return NextResponse.json(await listInteractions(session.sub));
}
