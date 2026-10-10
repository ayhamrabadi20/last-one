"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, Clock3, Database, LoaderCircle, Search } from "lucide-react";
import { fetchJson } from "@/lib/client-api";
import type { StoredInteraction } from "@/lib/interaction-history";
import { SupportLink } from "@/components/support-link";
import { summarizeStoredResponse, storedResponseSections } from "@/lib/history-presentation";

type HistoryResponse = { configured: boolean; available: boolean; items: StoredInteraction[] };
const typeLabels = { intake: "فهم الطلب", journey: "رحلة الإجراءات", knowledge_answer: "سؤال المصادر", exploration: "استكشاف مشروع" };

export function HistoryView() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState("");
  const [query,setQuery]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(() => {
    let mounted = true;
    fetchJson<HistoryResponse>("/api/history")
      .then((result) => { if (mounted) setData(result); })
      .catch((caught) => { if (mounted) setError(caught instanceof Error ? caught.message : "تعذر تحميل السجل."); });
    return () => { mounted = false; };
  }, [retry]);

  if (error) return <div role="alert" className="card rounded-3xl p-6 text-red-700"><CircleAlert className="mb-3" />{error}<button type="button" onClick={()=>{setError("");setData(null);setRetry(value=>value+1);}} className="focus-ring mt-4 block min-h-11 rounded-xl border px-4">إعادة المحاولة</button><Link href="/login" className="focus-ring mt-3 inline-block rounded p-2 text-sm font-bold text-teal-700">تسجيل الدخول مجددًا</Link></div>;
  if (!data) return <div className="py-16 text-center" role="status"><LoaderCircle className="mx-auto animate-spin text-teal-700" /><p className="mt-3">جاري تحميل السجل…</p></div>;
  if (!data.configured || !data.available) return (
    <div className="card rounded-3xl p-6 sm:p-8">
      <Database className="text-amber-700" size={34} />
      <h2 className="mt-4 text-2xl font-black">السجل غير متاح مؤقتًا</h2>
      <p className="mt-3 max-w-2xl leading-8 text-slate-600">تعذر الوصول لردودك المحفوظة. حاول مجددًا، أو أرسل للدعم إذا استمرت المشكلة.</p>
      <SupportLink/>
    </div>
  );
  if (!data.items.length) return <div className="card rounded-3xl p-8 text-center"><Clock3 className="mx-auto text-slate-500" /><h2 className="mt-3 text-xl font-black">أول خطوة تبدأ منك</h2><p className="mt-2 text-slate-500">اكتب فكرة مشروعك أو سؤالًا، وستجد الرد هنا بعد حفظه.</p><Link href="/" className="auth-submit mx-auto mt-5 max-w-xs">ابدأ طلبًا جديدًا</Link></div>;

  const filtered=data.items.filter(item=>`${item.input} ${summarizeStoredResponse(item.response)}`.toLocaleLowerCase("ar").includes(query.trim().toLocaleLowerCase("ar")));
  return <div className="space-y-3"><div className="card rounded-2xl p-4"><label htmlFor="history-search" className="auth-label">ابحث في ردودك الأخيرة</label><div className="relative"><input id="history-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} className="auth-input !pl-11" placeholder="اسم المشروع أو كلمات من الإجابة"/><Search className="absolute left-3 top-4 text-slate-500" size={18}/></div><p className="mt-2 text-xs leading-6 text-slate-500">نعرض أحدث {data.items.length} تفاعلًا محفوظًا. تحديث الطلب أو إعادة فتحه لا يضيف نسخة جديدة.</p></div>{!filtered.length&&<p role="status" className="card rounded-2xl p-6 text-center text-slate-600">لا توجد نتيجة لهذا البحث. جرّب كلمة أخرى.</p>}{filtered.map((item) => (
    <article key={item.id} className="card rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">{typeLabels[item.type]}</span><time className="text-xs text-slate-500">{new Intl.DateTimeFormat("ar-JO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time></div>
      <h2 className="mt-4 font-black">{item.input}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-7 text-slate-600">{summarizeStoredResponse(item.response)}</p>
      {storedResponseSections(item.response).length>0&&<details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4"><summary className="focus-ring min-h-11 cursor-pointer py-3 text-sm font-bold text-teal-800">اقرأ تفاصيل الرد المحفوظ</summary><div className="space-y-4 border-t border-slate-200 py-4">{storedResponseSections(item.response).map((section,index)=><section key={index}><h3 className="text-sm font-bold text-slate-800">{section.title}</h3><div className="mt-2 space-y-2">{section.paragraphs.map((paragraph,index)=><p key={index} className="whitespace-pre-line break-words text-sm leading-7 text-slate-600">{paragraph}</p>)}</div></section>)}</div></details>}
      <Link href={`/?${new URLSearchParams({goal:item.input,...(item.type==="knowledge_answer"?{mode:"ask"}:{})})}`} className="focus-ring mt-3 inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-teal-700">{item.type==="knowledge_answer"?"عدّل السؤال واطلب إجابة جديدة":"استخدم هذا الوصف في طلب جديد"}</Link>
      <SupportLink context={item.input} interactionId={item.id}/>
    </article>
  ))}</div>;
}
