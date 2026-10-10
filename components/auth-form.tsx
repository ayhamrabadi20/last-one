"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, CheckCircle2 } from "lucide-react";
import { fetchJson } from "@/lib/client-api";
type Mode = "login" | "register" | "forgot-password" | "reset-password";
export function AuthForm({ mode, token = "" }: { mode: Mode; token?: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string>();
  const register = mode === "register", reset = mode === "reset-password", forgot = mode === "forgot-password";
  const labels = { login: "تسجيل الدخول", register: "إنشاء حساب", "forgot-password": "طلب رابط الاستعادة", "reset-password": "حفظ كلمة المرور الجديدة" };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if ((register || reset) && data.password !== data.confirmPassword) { setError("كلمتا المرور غير متطابقتين."); return; }
    setLoading(true);
    try {
      const result = await fetchJson<{ resetUrl?: string; redirectTo?: string }>(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify({ ...data, token }) });
      if (forgot || reset) { setSuccess(true); setResetUrl(result.resetUrl); }
      else { router.push(result.redirectTo === "/admin" ? "/admin" : mode === "login" ? "/" : "/profile"); router.refresh(); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر إكمال الطلب."); }
    finally { setLoading(false); }
  }
  if (success) return <div className="mt-7 space-y-5"><div role="status" className="rounded-2xl bg-teal-50 p-5 text-sm leading-7 text-teal-900"><CheckCircle2 className="mb-3" size={28} />{reset ? "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة." : "إذا كان البريد مسجّلًا، سيكون رابط الاستعادة متاحًا في هذه النسخة المحلية. الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة."}</div>{resetUrl && <Link className="auth-submit" href={resetUrl}>فتح رابط الاستعادة <ArrowLeft size={18} /></Link>}<Link href="/login" className="block text-center text-sm font-bold text-teal-700">العودة لتسجيل الدخول</Link></div>;
  return <form onSubmit={submit} className={register ? "register-form mt-7 space-y-5" : "mt-7 space-y-5"} aria-label={labels[mode]} aria-busy={loading}>
    {register && <div className="register-name"><label className="auth-label" htmlFor="name">الاسم الكامل</label><input className="auth-input" id="name" name="name" autoComplete="name" placeholder="اكتب اسمك الكامل" minLength={2} maxLength={100} required /></div>}
    {register && <div className="register-phone"><label className="auth-label" htmlFor="phone">رقم الهاتف</label><input className="auth-input" id="phone" name="phone" type="tel" autoComplete="tel" dir="ltr" placeholder="07X XXX XXXX" minLength={8} maxLength={20} required /></div>}
    {!reset && <div className={register?"register-email":undefined}><label className="auth-label" htmlFor="email">{mode === "login" ? "البريد الإلكتروني أو اسم المستخدم" : "البريد الإلكتروني"}</label><input className="auth-input" id="email" name={mode === "login" ? "username" : "email"} type={mode === "login" ? "text" : "email"} autoComplete={mode === "login" ? "username" : "email"} dir="ltr" placeholder={mode === "login" ? "you@example.com / demo" : "you@example.com"} maxLength={254} required /></div>}
    {!forgot && <div className={register?"register-password":undefined}><div className="mb-2 flex items-center justify-between"><label className="text-sm font-bold text-slate-700" htmlFor="password">{reset ? "كلمة المرور الجديدة" : "كلمة المرور"}</label>{mode === "login" && <Link href="/forgot-password" className="focus-ring rounded text-xs font-bold text-teal-700">نسيت كلمة المرور؟</Link>}</div><div className="relative"><input className="auth-input !pl-12" id="password" name="password" type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "أدخل كلمة المرور" : "8 أحرف على الأقل"} minLength={mode === "login" ? 1 : 8} maxLength={128} required /><button className="focus-ring absolute left-1 top-1/2 -translate-y-1/2 grid size-11 place-items-center rounded-lg text-slate-500" type="button" aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></div>}
    {(register || reset) && <div className={register?"register-confirm":undefined}><label className="auth-label" htmlFor="confirmPassword">تأكيد كلمة المرور</label><input className="auth-input" id="confirmPassword" name="confirmPassword" type={show ? "text" : "password"} autoComplete="new-password" placeholder="أعد كتابة كلمة المرور" minLength={8} maxLength={128} required /></div>}
    {forgot && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">إرسال البريد غير مفعّل حاليًا. في بيئة التطوير يظهر رابط الاستعادة هنا مباشرةً.</p>}
    {reset && !token && <p role="alert" className="text-sm text-red-700">رابط الاستعادة مفقود. <Link href="/forgot-password" className="underline">اطلب رابطًا جديدًا</Link></p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
    <button className="auth-submit" disabled={loading || (reset && !token)}>{loading ? <LoaderCircle className="animate-spin" size={19} /> : null}{loading ? "جارٍ إكمال الطلب…" : labels[mode]}{!loading && <ArrowLeft size={18} />}</button>
    {mode === "login" ? <><div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-100" />جديد في Mustanad Jo؟<span className="h-px flex-1 bg-slate-100" /></div><Link href="/register" className="focus-ring flex min-h-12 items-center justify-center rounded-xl border border-teal-200 bg-teal-50/50 text-sm font-bold text-teal-800 hover:bg-teal-50">إنشاء حساب جديد</Link></> : <p className="text-center text-sm text-slate-500">{register ? "لديك حساب بالفعل؟ " : "تذكّرت كلمة المرور؟ "}<Link href="/login" className="font-bold text-teal-700">تسجيل الدخول</Link></p>}
  </form>;
}
