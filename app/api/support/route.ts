import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { sessionFromRequest } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { requireDatabase } from "@/lib/mongodb";
import { apiError } from "@/lib/schemas";
import { rateLimit, requestKey } from "@/lib/rate-limit";
const schema = z.object({ subject: z.string().trim().min(3).max(120), message: z.string().trim().min(10).max(4000), category: z.enum(["answer", "technical", "account", "suggestion"]), context: z.string().trim().max(1500).optional(), interactionId: z.string().regex(/^[a-f0-9]{24}$/i).optional() });
export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json(apiError("UNAUTHORIZED", "سجّل الدخول لعرض رسائلك."), { status: 401 });
  try {
    const tickets = await (await requireDatabase()).collection("support_tickets").find({ userId: session.sub }).sort({ createdAt: -1 }).limit(50).toArray();
    return NextResponse.json({ tickets: tickets.map((ticket) => ({ id: ticket._id.toString(), subject: ticket.subject, message: ticket.message, category: ticket.category, status: ticket.status, context: ticket.context, createdAt: ticket.createdAt.toISOString(), replies: (ticket.replies || []).map((reply: {text: string; createdAt: Date}) => ({ text: reply.text, createdAt: reply.createdAt.toISOString() })) })) });
  } catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر تحميل رسائل الدعم."), { status: 503 }); }
}
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json(apiError("UNAUTHORIZED", "سجّل الدخول لإرسال رسالة."), { status: 401 });
  if (!rateLimit(`support:${requestKey(request)}`).allowed) return NextResponse.json(apiError("RATE_LIMITED", "انتظر قليلًا ثم حاول مجددًا."), { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(apiError("INVALID_MESSAGE", "أدخل عنوانًا واضحًا ورسالة من 10 أحرف على الأقل."), { status: 400 });
  try {
    const db = await requireDatabase();
    const profile = await getProfile(session.sub);
    if (!profile) return NextResponse.json(apiError("ACCOUNT_NOT_FOUND", "الحساب غير موجود."), { status: 404 });
    if (parsed.data.interactionId && !await db.collection("interactions").findOne({ _id: new ObjectId(parsed.data.interactionId), userId: session.sub })) return NextResponse.json(apiError("INVALID_REQUEST", "الطلب المرتبط غير موجود ضمن حسابك."), { status: 400 });
    await db.collection("support_tickets").createIndex({ userId: 1, createdAt: -1 });
    const ticket = { ...parsed.data, userId: session.sub, contact: { name: profile.name, email: profile.email }, status: "new", createdAt: new Date() };
    const result = await db.collection("support_tickets").insertOne(ticket);
    return NextResponse.json({ ticket: { id: result.insertedId.toString(), subject: ticket.subject, message: ticket.message, category: ticket.category, context: ticket.context, status: ticket.status, createdAt: ticket.createdAt.toISOString() } }, { status: 201 });
  } catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر إرسال الرسالة. حاول مجددًا."), { status: 503 }); }
}
