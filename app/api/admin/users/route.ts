import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { requireDatabase } from "@/lib/mongodb";
import { apiError } from "@/lib/schemas";
import { rateLimit, requestKey } from "@/lib/rate-limit";
const schema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i), action: z.enum(["activate", "suspend", "ban", "role", "revoke", "delete"]), role: z.enum(["user", "admin"]).optional(), confirmation: z.string().max(254).optional() });
export async function POST(request: Request) {
  const access = await authorizeAdmin(request);
  if (access.response) return access.response;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json(apiError("FORBIDDEN", "مصدر الطلب غير مسموح."), { status: 403 });
  if (!rateLimit(`manage-user:${requestKey(request)}`).allowed) return NextResponse.json(apiError("RATE_LIMITED", "انتظر قليلًا ثم حاول مجددًا."), { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.action === "role" && !parsed.data.role)) return NextResponse.json(apiError("INVALID_ACTION", "تحقق من العملية والحساب المستهدف."), { status: 400 });
  try {
    const db = await requireDatabase();
    const users = db.collection("accounts");
    const { id, action, role, confirmation } = parsed.data;
    const target = await users.findOne({ _id: new ObjectId(id) });
    if (!target) return NextResponse.json(apiError("NOT_FOUND", "الحساب غير موجود."), { status: 404 });
    if (target.status === "deleted" && action !== "delete") return NextResponse.json(apiError("DELETION_PENDING", "هذا الحساب بانتظار إكمال الحذف. أكمل الحذف بدل إعادة تفعيله."), { status: 409 });
    if (target.protectedAdmin || (target.username || target.email) === access.session.sub) return NextResponse.json(apiError("PROTECTED_ACCOUNT", "الحساب الرئيسي وحسابك الحالي محميان من هذه العمليات."), { status: 409 });
    if (target.role === "admin" && action !== "activate" && action !== "revoke" && (action !== "role" || role !== "admin") && await users.countDocuments({ role: "admin", status: { $nin: ["banned", "suspended", "deleted"] } }) <= 1) return NextResponse.json(apiError("LAST_ADMIN", "لا يمكن تعطيل أو إزالة آخر مدير مفعّل."), { status: 409 });
    if (action === "delete" && confirmation !== target.email) return NextResponse.json(apiError("CONFIRM_DELETE", "اكتب البريد الإلكتروني للحساب لتأكيد الحذف النهائي."), { status: 400 });
    const log = await db.collection("admin_audit").insertOne({ actor: access.session.sub, action: `user_${action}`, targetId: id, status: "attempted", details: { role: action === "role" ? role : undefined }, createdAt: new Date() });
    const nextStatus = action === "activate" ? "active" : action === "ban" ? "banned" : action === "suspend" ? "suspended" : action === "delete" ? "deleted" : undefined;
    const updated = await users.updateOne({ _id: target._id, protectedAdmin: { $ne: true } }, { $set: { updatedAt: new Date(), ...(nextStatus ? { status: nextStatus } : {}), ...(action === "role" ? { role } : {}) }, $inc: { sessionVersion: 1 }, $unset: { resetHash: "", resetExpires: "" } });
    if (!updated.matchedCount) return NextResponse.json(apiError("CONFLICT", "تغيّرت حالة الحساب. حدّث البيانات وأعد المحاولة."), { status: 409 });
    await db.collection("sessions").deleteMany({ accountId: id });
    if (action === "delete") {
      const identities = [...new Set([target.email, target.username].filter(Boolean))];
      await Promise.all([db.collection("interactions").deleteMany({ userId: { $in: identities } }), db.collection("checklists").deleteMany({ userId: { $in: identities } }), db.collection("support_tickets").deleteMany({ userId: { $in: identities } })]);
      await users.deleteOne({ _id: target._id, status: "deleted", protectedAdmin: { $ne: true } });
    }
    await db.collection("admin_audit").updateOne({ _id: log.insertedId }, { $set: { status: "completed" } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json(apiError("STORAGE_UNAVAILABLE", "تعذر تأكيد اكتمال العملية. حدّث حالة الحساب قبل إعادة المحاولة."), { status: 503 }); }
}
