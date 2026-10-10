"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleAlert, Compass, ExternalLink, LoaderCircle, RefreshCw, SearchCheck, ShieldAlert } from "lucide-react";
import { fetchJson } from "@/lib/client-api";
import type { ExploreResponse } from "@/lib/contracts";
import { SupportLink } from "@/components/support-link";

const categoryLabels = {
  food: "غذاء ومشروبات",
  retail: "بيع بالتجزئة",
  services: "خدمات",
  digital: "نشاط رقمي",
  manufacturing: "تصنيع",
  other: "نشاط آخر",
};

const modelLabels = {
  physical: "موقع فعلي",
  online: "إلكتروني",
  mixed: "فعلي وإلكتروني",
  unknown: "غير محسوم",
};

export function ExploreView() {
  const params = useSearchParams();
  const goal = params.get("goal")?.trim() ?? "";
  const flow=params.get("flow")||"";
  const [data, setData] = useState<ExploreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let mounted = true;
    if (!goal) {
      queueMicrotask(() => {
        if (!mounted) return;
        setError("اكتب وصف المشروع من الصفحة الرئيسية أولًا.");
        setLoading(false);
      });
      return () => { mounted = false; };
    }
    fetchJson<ExploreResponse>("/api/explore", {
      method: "POST",
      ...(flow?{headers:{"x-request-id":flow}}:{}),
      body: JSON.stringify({ goal }),
    })
      .then((result) => { if (mounted) setData(result); })
      .catch((caught) => {
        if (mounted) setError(caught instanceof Error ? caught.message : "تعذر بناء مسار الاستكشاف.");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [goal, requestId, flow]);

  function retry() {
    setLoading(true);
    setError("");
    setRequestId((value) => value + 1);
  }

  if (loading) return (
    <div className="shell py-20 text-center" role="status">
      <LoaderCircle className="mx-auto animate-spin text-teal-700" size={42} />
      <h1 className="mt-5 text-2xl font-black">نبني مسارًا يناسب مشروعك…</h1>
      <p className="mt-2 text-sm text-slate-500">نرتّب لك خطوات البداية والتجهيز والتشغيل حسب نوع المشروع والموقع الذي ذكرته.</p>
    </div>
  );

  if (error || !data) return (
    <div className="shell py-20 text-center">
      <CircleAlert className="mx-auto text-red-700" size={42} />
      <h1 className="mt-4 text-2xl font-black">تعذر بناء المسار</h1>
      <p className="mt-2 text-slate-600">{error}</p>
      <div className="mt-6 flex justify-center gap-3">
        {goal && <button onClick={retry} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-3 font-bold text-white"><RefreshCw size={17} /> أعد المحاولة</button>}
        <Link href="/" className="focus-ring rounded-xl border border-slate-300 px-4 py-3 font-bold">العودة</Link>
      </div>
      <SupportLink context={goal}/>
    </div>
  );

  const sourceMap = new Map(data.sources.map((source) => [source.id, source]));
  return (
    <div className="shell py-7 sm:py-12">
      <section className="card overflow-hidden rounded-[2rem]">
        <div className="bg-slate-900 px-5 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-400/15 px-3 py-1 text-xs font-bold text-teal-200"><Compass size={14} /> خطة بداية · {data.overview.sectorAr}</div>
              <h1 className="text-2xl font-black sm:text-3xl">{data.titleAr}</h1>
              <p className="mt-3 max-w-3xl leading-7 text-slate-300">طلبك: {data.goal}</p>
            </div>
            <Link href={`/?goal=${encodeURIComponent(data.goal)}`} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold hover:bg-white/20"><ArrowRight size={16} /> تعديل الوصف</Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white/10 p-3"><span className="text-[11px] text-slate-300">النشاط</span><strong className="mt-1 block text-sm">{data.profile.activityAr}</strong></div>
            <div className="rounded-xl bg-white/10 p-3"><span className="text-[11px] text-slate-300">الموقع</span><strong className="mt-1 block text-sm">{data.profile.locationAr ?? "يحتاج تحديد"}</strong></div>
            <div className="rounded-xl bg-white/10 p-3"><span className="text-[11px] text-slate-300">الفئة</span><strong className="mt-1 block text-sm">{categoryLabels[data.profile.category]}</strong></div>
            <div className="rounded-xl bg-white/10 p-3"><span className="text-[11px] text-slate-300">نموذج التشغيل</span><strong className="mt-1 block text-sm">{modelLabels[data.profile.businessModel]}</strong></div>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-950 sm:px-8"><ShieldAlert className="mt-1 shrink-0" size={18} /><p>{data.noticeAr}</p></div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]" aria-label="خلاصة خطة المشروع">
        <div className="card rounded-3xl p-6"><p className="text-xs font-bold text-teal-700">الخلاصة التي تهمك</p><h2 className="mt-2 text-xl font-black">كيف تبدأ بشكل عملي؟</h2><p className="mt-3 leading-8 text-slate-600">{data.overview.summaryAr}</p><div className="mt-4 rounded-2xl bg-teal-50 p-4"><p className="text-xs font-bold text-teal-800">أول خطوة الآن</p><p className="mt-2 text-sm leading-7 text-teal-950">{data.overview.firstActionAr}</p></div></div>
        <div className="card rounded-3xl p-6"><h2 className="text-lg font-black">تفاصيل تجعل خطتك أدق</h2><p className="mt-2 text-xs leading-6 text-slate-500">الخطة مبنية على وصفك الحالي. أضف إجابات هذه الأسئلة عند تعديل الوصف.</p><ul className="mt-3 space-y-2">{data.overview.questions.map((question) => <li key={question} className="flex gap-2 text-sm leading-7"><span className="text-teal-600">•</span>{question}</li>)}</ul><Link href={`/?goal=${encodeURIComponent(data.goal)}`} className="focus-ring mt-4 inline-flex rounded-xl border border-teal-200 px-4 py-2 text-sm font-bold text-teal-800">أضف تفاصيل مشروعك</Link></div>
      </section>

      <div className="mt-7 flex items-end justify-between gap-4">
        <div><p className="text-sm font-bold text-teal-700">خطوات تناسب {data.profile.activityAr}</p><h2 className="text-2xl font-black">خطة العمل بالتفصيل</h2></div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">{data.steps.length} مراحل</span>
      </div>
      <nav aria-label="مراحل خطة المشروع" className="mt-4 flex flex-wrap gap-2">{data.steps.map((step) => <a key={step.id} href={`#${step.id}`} className="focus-ring rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-teal-400 hover:text-teal-800">{step.order}. {step.titleAr}</a>)}</nav>

      <div className="mt-5 space-y-4">
        {data.steps.map((step) => (
          <article id={step.id} key={step.id} className="card scroll-mt-6 rounded-3xl p-5 sm:p-7">
            <div className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-100 font-black text-teal-800">{String(step.order).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div><h3 className="text-lg font-black sm:text-xl">{step.titleAr}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{step.purposeAr}</p></div>
                  <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${step.status === "supported_by_pending_source" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>{step.status === "supported_by_pending_source" ? "مصدر يحتاج مراجعة" : step.id.startsWith("verify-") || step.id === "build-verified-checklist" ? "تحقق قبل التنفيذ" : "إرشاد للتخطيط والتشغيل"}</span>
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <div><h4 className="text-xs font-black text-slate-500">اعمل الآن</h4><ol className="mt-2 space-y-2 text-sm leading-7">{step.actions.map((action) => <li key={action} className="flex gap-2"><SearchCheck className="mt-1.5 shrink-0 text-teal-700" size={15} /><span>{action}</span></li>)}</ol></div>
                  <div><h4 className="text-xs font-black text-slate-500">اعتبر المرحلة منجزة عندما يصبح معك</h4><ul className="mt-2 space-y-2 text-sm leading-7">{step.completionEvidence.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-1.5 shrink-0 text-emerald-700" size={15} /><span>{item}</span></li>)}</ul></div>
                </div>
                {step.sourceIds.length > 0 && <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{step.sourceIds.map((id) => { const source = sourceMap.get(id); return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50">{source.titleAr}<ExternalLink size={12} /></a> : null; })}</div>}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-7 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm sm:flex-row">
        <span className="text-slate-600">خطتك محفوظة في سجل حسابك ويمكنك الرجوع إليها.</span>
        <Link href="/?mode=ask" className="focus-ring rounded-lg font-bold text-violet-700">اسأل المصادر عن نقطة محددة</Link>
      </div>
      <SupportLink context={data.goal} interactionId={data.historyStorage?.id}/>
    </div>
  );
}
