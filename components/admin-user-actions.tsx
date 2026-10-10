"use client";
import { FormEvent, useState } from "react";
import { LoaderCircle, ShieldCheck, UserRound, X } from "lucide-react";
import { fetchJson } from "@/lib/client-api";
import type { AdminUser } from "@/lib/admin-contracts";
const labels: Record<string,string> = { active: "مفعّل", suspended: "دخوله معطّل", banned: "محظور", deleted: "بانتظار إكمال الحذف" };
export function AdminUserActions({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const [open,setOpen]=useState(false);
  const [action,setAction]=useState("suspend");
  const [role,setRole]=useState(user.role);
  const [confirmation,setConfirmation]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState("");
  async function submit(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");setSaved("");
    try { await fetchJson("/api/admin/users",{method:"POST",body:JSON.stringify({id:user.id,action,role,confirmation})});setOpen(false);setConfirmation("");setSaved("تم حفظ العملية.");onChanged(); }
    catch(caught){setError(caught instanceof Error?caught.message:"تعذر تنفيذ العملية.");}finally{setBusy(false);}
  }
  return <div className="min-w-40"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${user.status==="active"?"bg-teal-50 text-teal-800":"bg-red-50 text-red-700"}`}>{labels[user.status]||"مفعّل"}</span>{user.protectedAdmin?<p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><ShieldCheck size={13}/>الحساب الرئيسي محمي</p>:<button onClick={()=>{setOpen(!open);setError("");}} aria-expanded={open} className="focus-ring mt-2 flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-teal-700"><UserRound size={13}/>إدارة الحساب</button>}
    {open&&<form onSubmit={submit} className="mt-3 w-64 max-w-full space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between"><strong className="text-xs">عملية على {user.name}</strong><button type="button" disabled={busy} onClick={()=>setOpen(false)} aria-label="إغلاق إدارة الحساب" className="focus-ring rounded p-1"><X size={14}/></button></div><label className="block text-[11px] text-slate-500">العملية<select disabled={busy} value={action} onChange={event=>{setAction(event.target.value);setConfirmation("");}} className="auth-input mt-1"><option value="suspend">تعطيل الدخول</option><option value="ban">حظر الحساب</option><option value="activate">إعادة التفعيل</option><option value="role">تعديل الدور</option><option value="revoke">تسجيل الخروج من كل الجلسات</option><option value="delete">حذف نهائي</option></select></label>{action==="role"&&<label className="block text-[11px] text-slate-500">الدور الجديد<select disabled={busy} value={role} onChange={event=>setRole(event.target.value as "user"|"admin")} className="auth-input mt-1"><option value="user">مستخدم عادي</option><option value="admin">مدير المنصة</option></select></label>}
      <p className="text-[11px] leading-6 text-slate-500">{action==="delete"?"سيُحذف الحساب وطلباته وقوائم تقدّمه ورسائل دعمه نهائيًا. لن تُحذف سجلات الإجراءات الإدارية.":action==="role"&&role==="admin"?"هذا الدور يسمح بالوصول لبيانات المستخدمين وإدارة الحسابات والدعم.":"تُلغى الجلسات الحالية، ويُطبّق التغيير على الدخول والطلبات التالية."}</p>{action==="delete"&&<label className="block text-[11px] text-red-700">اكتب {user.email} لتأكيد الحذف<input disabled={busy} value={confirmation} onChange={event=>setConfirmation(event.target.value)} className="auth-input mt-1" dir="ltr" autoComplete="off" required/></label>}{error&&<p role="alert" className="text-xs leading-6 text-red-700">{error}</p>}<button disabled={busy||(action==="delete"&&confirmation!==user.email)} className={`auth-submit ${action==="delete"?"!bg-red-700":""}`}>{busy?<LoaderCircle size={15} className="animate-spin"/>:null}{busy?"جارٍ التنفيذ…":"تأكيد العملية"}</button></form>}{saved&&<p role="status" className="mt-2 text-xs text-teal-700">{saved}</p>}</div>;
}
