"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpLeft, CheckCircle2, ClipboardList, Clock3, LifeBuoy, LoaderCircle, Mail, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
import { fetchJson } from "@/lib/client-api";
import type { PublicProfile } from "@/lib/profile";
type Data = { profile: PublicProfile; stats: { requests: number; checklists: number; tickets: number } };
export function ProfileView() {
  const router = useRouter();
  const [data, setData] = useState<Data>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    fetchJson<Data>("/api/profile").then((result) => { if (active) { setData(result); setName(result.profile.name); setPhone(result.profile.phone); setError(""); } }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "تعذر تحميل الملف."); });
    return () => { active = false; };
  }, [retry]);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setSaved(false);
    try { const result = await fetchJson<{ profile: PublicProfile }>("/api/profile", { method: "PATCH", body: JSON.stringify({ name, phone }) }); setData((current) => current ? { ...current, profile: result.profile } : current); setSaved(true); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر حفظ البيانات."); }
    finally { setSaving(false); }
  }
  if (!data) return <div className="shell py-20 text-center" role="status">{error ? <><p className="text-red-700">{error}</p><button onClick={() => setRetry(value => value+1)} className="focus-ring mt-4 rounded-xl border px-4 py-2">إعادة المحاولة</button></> : <><LoaderCircle className="mx-auto animate-spin text-teal-700" size={30} /><p className="mt-4 text-slate-500">نحمّل مساحة حسابك…</p></>}</div>;
  return <div className="shell py-7 sm:py-10">
    <section className="profile-banner relative overflow-hidden rounded-[2rem] p-6 text-white sm:p-9"><div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center"><span className="grid size-20 shrink-0 place-items-center rounded-3xl border border-white/20 bg-white/15 text-3xl font-black">{data.profile.name.slice(0,1)}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-teal-200">مساحتك في Mustanad Jo</p><h1 className="mt-2 break-words text-2xl font-black sm:text-3xl">أهلًا، {data.profile.name}</h1><p className="mt-3 text-sm leading-7 text-teal-50/80">بياناتك، طلباتك، وخطوتك القادمة… كلّها في مكان واحد.</p></div><Link href="/" className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-teal-900">ابدأ طلبًا جديدًا <ArrowUpLeft size={18} /></Link></div></section>
    <div className="mt-5 grid grid-cols-3 gap-3">{[{ label: "تفاعل محفوظ", count: data.stats.requests, icon: Clock3, href: "/history" }, { label: "قائمة تقدّم", count: data.stats.checklists, icon: ClipboardList, href: "/history" }, { label: "رسالة دعم", count: data.stats.tickets, icon: LifeBuoy, href: "/support" }].map(({label,count,icon:Icon,href}) => <Link href={href} key={label} className="card focus-ring rounded-2xl p-4 sm:p-5"><Icon className="mb-3 text-teal-700" size={20} /><strong className="block text-2xl font-black">{count}</strong><span className="mt-1 block text-xs text-slate-500">{label}</span></Link>)}</div>
    <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]"><section className="card rounded-3xl p-6 sm:p-8"><div className="flex items-center gap-3"><UserRound className="text-teal-700" size={22} /><div><h2 className="text-xl font-black">ملفي الشخصي</h2><p className="mt-1 text-xs leading-6 text-slate-500">راجع بياناتك وحدّث الاسم ورقم الهاتف.</p></div></div><form onSubmit={save} className="mt-7 space-y-5"><div><label htmlFor="profile-name" className="auth-label">الاسم الكامل</label><input id="profile-name" className="auth-input" value={name} onChange={event => { setName(event.target.value); setSaved(false); }} autoComplete="name" minLength={2} maxLength={100} required /></div><div><label htmlFor="profile-email" className="auth-label">البريد الإلكتروني</label><div className="relative"><input id="profile-email" value={data.profile.email} readOnly className="auth-input !pl-11 text-slate-500" dir="ltr" /><Mail className="absolute left-3 top-4 text-slate-400" size={18} /></div><p className="mt-2 text-xs text-slate-400">بريد الحساب المستخدم لتسجيل الدخول.</p></div><div><label htmlFor="profile-phone" className="auth-label">رقم الهاتف</label><div className="relative"><input id="profile-phone" className="auth-input !pl-11" value={phone} onChange={event => { setPhone(event.target.value); setSaved(false); }} autoComplete="tel" type="tel" dir="ltr" placeholder="079 XXX XXXX" minLength={8} maxLength={20} required /><Phone className="absolute left-3 top-4 text-slate-400" size={18} /></div></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{saved && <p role="status" className="flex items-center gap-2 rounded-xl bg-teal-50 p-3 text-sm text-teal-800"><CheckCircle2 size={17} />تم حفظ بياناتك بنجاح.</p>}<button disabled={saving} className="auth-submit">{saving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}{saving ? "جارٍ الحفظ…" : "حفظ التغييرات"}</button></form></section>
      <aside className="space-y-5"><section className="card rounded-3xl p-6"><ShieldCheck className="text-teal-700" size={27} /><h2 className="mt-4 text-lg font-black">حسابك، رحلتك الخاصة</h2><p className="mt-2 text-sm leading-7 text-slate-500">طلباتك وتقدّمك ورسائل الدعم مرتبطة بحسابك، ويمكنك الرجوع إليها عند تسجيل الدخول.</p>{data.profile.createdAt && <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-400">عضو منذ {new Intl.DateTimeFormat("ar-JO", { dateStyle: "long", timeZone: "Asia/Amman" }).format(new Date(data.profile.createdAt))}</p>}</section><Link href="/support" className="focus-ring block rounded-3xl border border-teal-100 bg-teal-50 p-6"><LifeBuoy className="text-teal-700" size={27} /><h2 className="mt-4 font-black text-teal-900">احتجت مساعدة؟</h2><p className="mt-2 text-sm leading-7 text-teal-800">أرسل المشكلة في رسالة واضحة، وراجع رسائلك من مركز الدعم.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-teal-900">افتح مركز الدعم <ArrowUpLeft size={17} /></span></Link></aside>
    </div>
  </div>;
}
