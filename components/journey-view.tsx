"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpLeft,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  FileText,
  HelpCircle,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";
import { AIStatus } from "@/components/ai-status";
import { AnswerPanel } from "@/components/answer-panel";
import { SupportLink } from "@/components/support-link";
import { fetchJson } from "@/lib/client-api";
import { progressPercent, retainSharedChecks, stateFingerprint, type StoredChecklist } from "@/lib/checklist";
import type { AnswerResponse, EvidenceChunk, JourneyResponse } from "@/lib/contracts";

const scopeLabels: Record<string, string> = {
  activityAr: "النشاط",
  municipalityAr: "النطاق",
  legalFormAr: "الشكل القانوني",
  premisesTenureAr: "الموقع",
};

const suggestedQuestions = [
  "شو الوثيقة المطلوبة إذا المحل مستأجر؟",
  "وين أراجع لتسجيل المؤسسة؟",
  "شو الأدلة المتاحة لرخصة المهن؟",
];

function requestJourney(slots: Record<string, string>, flow="") {
  return fetchJson<JourneyResponse>("/api/journey", {
    method: "POST",
    ...(flow?{headers:{"x-request-id":flow}}:{}),
    body: JSON.stringify({ slots }),
  });
}

export function JourneyView() {
  const params = useSearchParams();
  const flow=params.get("flow")||"";
  const slots = useMemo(
    () => ({
      activityId: params.get("activityId") ?? "",
      municipalityId: params.get("municipalityId") ?? "",
      legalForm: params.get("legalForm") ?? "",
      premisesTenure: params.get("premisesTenure") ?? "",
    }),
    [params],
  );
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSources, setExpandedSources] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerResponse | null>(null);
  const [answeredQuestion, setAnsweredQuestion] = useState("");
  const [answering, setAnswering] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [checklistReady, setChecklistReady] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const hasCompleteParams = Object.values(slots).every(Boolean);

  async function retryJourney() {
    setLoading(true);
    setError("");
    try {
      const data = await requestJourney(slots,flow);
      setJourney(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر بناء الرحلة.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    if (!hasCompleteParams) {
      queueMicrotask(() => {
        if (!mounted) return;
        setError("بيانات الرحلة غير مكتملة. ابدأ من الصفحة الرئيسية للإجابة عن الأسئلة القصيرة أولًا.");
        setLoading(false);
      });
      return () => { mounted = false; };
    }
    requestJourney(slots,flow)
      .then((data) => {
        if (!mounted) return;
        setJourney(data);
        setError("");
      })
      .catch((caught) => {
        if (!mounted) return;
        setError(caught instanceof Error ? caught.message : "تعذر بناء الرحلة.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [hasCompleteParams, slots, flow]);

  const storageKey = journey
    ? `lifeevent.checklist:${journey.knowledgeVersion}:${stateFingerprint(slots)}`
    : "";

  useEffect(() => {
    if (!journey || !storageKey) return;
    let active = true;
    const documentIds = journey.documents.map((document) => document.id);
    queueMicrotask(() => { if (active) { setChecklistReady(false); setChecked([]); } });
    fetchJson<{ checklist: StoredChecklist | null }>(`/api/checklist?key=${encodeURIComponent(storageKey)}`)
      .then(({ checklist }) => {
        if (!active) return;
        setChecked(checklist?.knowledgeVersion === journey.knowledgeVersion ? retainSharedChecks(checklist.checkedIds, documentIds) : []);
        setStorageWarning(false);
        setChecklistReady(true);
      })
      .catch(() => { if (active) setStorageWarning(true); });
    return () => { active = false; };
  }, [journey, storageKey]);

  async function saveChecklist(next: string[]) {
    if (!journey || !storageKey || !checklistReady || savingChecklist) return;
    const payload: StoredChecklist = { knowledgeVersion: journey.knowledgeVersion, checkedIds: next };
    setSavingChecklist(true);
    try {
      await fetchJson("/api/checklist", { method: "PUT", body: JSON.stringify({ key: storageKey, ...payload }) });
      setChecked(next);
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    } finally { setSavingChecklist(false); }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setAnswering(true);
    setAnswer(null);
    setAnsweredQuestion(question);
    try {
      const data = await fetchJson<AnswerResponse>("/api/answer", {
        method: "POST",
        body: JSON.stringify({ question, slots }),
      });
      setAnswer(data);
    } catch (caught) {
      setAnswer({
        status: "insufficient_evidence",
        answer: caught instanceof Error ? caught.message : "تعذر إرسال السؤال.",
        aiMode: "fallback",
        citations: [],
      });
    } finally { setAnswering(false); }
  }

  if (loading) {
    return (
      <div className="shell py-12" role="status">
        <div className="mb-6 h-36 animate-pulse rounded-3xl bg-slate-200/70" />
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-40 animate-pulse rounded-3xl bg-slate-200/70" />)}</div>
          <div className="h-72 animate-pulse rounded-3xl bg-slate-200/70" />
        </div>
        <p className="mt-5 text-center text-sm text-slate-500">جاري ترتيب الرحلة حسب الاعتماديات…</p>
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div className="shell py-16">
        <section className="card mx-auto max-w-xl rounded-3xl p-8 text-center">
          <CircleAlert className="mx-auto text-red-700" size={42} />
          <h1 className="mt-4 text-2xl font-black">ما قدرنا نبني الرحلة</h1>
          <p className="mt-3 text-slate-600">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            {hasCompleteParams && <button onClick={retryJourney} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-3 font-bold text-white"><RefreshCw size={17} /> إعادة المحاولة</button>}
            <Link href="/" className="focus-ring rounded-xl border border-slate-300 px-4 py-3 font-bold">العودة</Link>
          </div>
        </section>
      </div>
    );
  }

  const documentIds = journey.documents.map((document) => document.id);
  const progress = progressPercent(checked, documentIds);
  const sourceMap = new Map(journey.sources.map((source) => [source.id, source]));
  const evidenceMap = new Map(journey.evidence.map((evidence) => [evidence.id, evidence]));
  const editGoal = `بدي أفتح محل ملابس ${slots.premisesTenure === "rent" ? "مستأجر" : "مملوك"} بعمّان كمؤسسة فردية`;

  return (
    <div className="shell py-6 sm:py-10">
      <section className="card overflow-hidden rounded-[2rem]">
        <div className="bg-teal-800 px-5 py-6 text-white sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-sm font-bold text-teal-100">رحلتك التوضيحية</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">تأسيس مؤسسة فردية لبيع الملابس</h1></div>
            <Link href={`/?goal=${encodeURIComponent(editGoal)}`} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold hover:bg-white/20"><Pencil size={16} /> تعديل الحالة</Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Object.entries(journey.scope).map(([key, value]) => (
              <div key={key} className="rounded-xl bg-white/10 px-3 py-2.5"><span className="block text-[11px] text-teal-100">{scopeLabels[key]}</span><strong className="mt-1 block text-sm">{value}</strong></div>
            ))}
          </div>
        </div>
        <div className="border-b border-teal-100 bg-teal-50 px-5 py-4 text-sm sm:px-8"><Link href={`/explore?goal=${encodeURIComponent(editGoal)}`} className="focus-ring rounded font-bold text-teal-800">اطّلع أيضًا على خطة التجهيز والتشغيل والتكاليف لمحل الملابس ←</Link></div>
        <div className="flex items-start gap-3 border-t border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950 sm:px-8">
          <ShieldAlert className="mt-0.5 shrink-0" size={19} /><p><strong>تنبيه المحتوى:</strong> {journey.contentNoticeAr}</p>
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-teal-700">المسار المقترح</p><h2 className="text-2xl font-black">خطواتك بالترتيب</h2></div><span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">{journey.steps.length} خطوات</span></div>
          {journey.steps.map((step) => {
            const stepEvidence = step.evidenceChunkIds.map((id) => evidenceMap.get(id)).filter(Boolean) as EvidenceChunk[];
            return (
              <article key={step.id} className="card overflow-hidden rounded-3xl">
                <div className="flex gap-4 p-5 sm:p-6">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-100 font-black text-teal-800">{String(step.order).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-teal-700">{step.authority}</p>
                    <h3 className="mt-1 text-lg font-black sm:text-xl">{step.titleAr}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{step.scope}</p>
                  </div>
                </div>
                <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                  <ol className="space-y-2 text-sm leading-6 text-slate-700">
                    {step.actionSteps.map((action) => <li key={action} className="flex gap-2"><Check className="mt-1 shrink-0 text-teal-700" size={15} /><span>{action}</span></li>)}
                  </ol>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <details className="group">
                      <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-50"><HelpCircle size={16} /> ليش هاي الخطوة؟ <ChevronDown className="group-open:rotate-180" size={15} /></summary>
                      <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">{step.explanationAr}</p>
                    </details>
                    <button onClick={() => setExpandedSources(expandedSources === step.id ? null : step.id)} className="focus-ring flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-50"><BookOpen size={16} /> المصدر ({stepEvidence.length})</button>
                  </div>
                  {expandedSources === step.id && (
                    <div className="mt-4 space-y-3 rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
                      {stepEvidence.map((evidence) => {
                        const source = sourceMap.get(evidence.sourceId);
                        return (
                          <div key={evidence.id} className="rounded-xl bg-white p-4 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{source?.titleAr}</strong><span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">بانتظار مراجعة بشرية</span></div>
                            <blockquote className="mt-3 border-r-2 border-teal-500 pr-3 leading-7 text-slate-600">{evidence.text}</blockquote>
                            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500"><span>{evidence.section}{evidence.page ? ` — ${evidence.page}` : ""}</span>{source && <a href={source.url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 rounded font-bold text-teal-700">الأصل <ExternalLink size={13} /></a>}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          <section className="card rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-800"><Bot size={20} /></span><div><h2 className="font-black">اسأل عن هذه الرحلة</h2><p className="text-xs text-slate-500">هنا السياق هو محل الملابس الحالي فقط</p></div></div>
              <Link href="/?mode=ask" className="focus-ring w-fit rounded-lg text-xs font-bold text-violet-700 hover:underline">سؤال جديد خارج الرحلة</Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="أسئلة مقترحة">
              {suggestedQuestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)} disabled={answering} className="focus-ring rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50">{suggestion}</button>
              ))}
            </div>
            <form onSubmit={ask} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <label htmlFor="journey-question" className="sr-only">اكتب سؤالك</label>
              <input id="journey-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1500} placeholder="مثال: شو بحتاج إذا المحل مستأجر؟" className="focus-ring min-h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4" />
              <button disabled={answering || !question.trim()} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 font-bold text-white disabled:opacity-50">{answering ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={17} />} اسأل</button>
            </form>
            {answering && <p className="mt-2 text-xs leading-5 text-slate-500" role="status">يقرأ النموذج المحلي المقاطع المتاحة. قد تستغرق الإجابة قرابة دقيقة على هذا الجهاز.</p>}
            {answer && <div className="mt-4"><AnswerPanel answer={answer} question={answeredQuestion}/></div>}
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-5">
          <section className="card rounded-3xl p-5">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><ClipboardCheck size={20} /></span><div><h2 className="font-black">قائمة التجهيز</h2><p className="text-xs text-slate-500">محفوظة في حسابك</p></div></div>
            <div className="mt-5 flex items-end justify-between"><span className="text-sm font-bold text-slate-600">نسبة التجهيز</span><strong className="text-3xl font-black text-teal-700">{progress}%</strong></div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">هذه نسبة تجهيز محلية وليست موافقة حكومية.</p>
            {storageWarning && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] leading-5 text-amber-900" role="status">تعذر تحميل أو حفظ التقدّم. أعد المحاولة أو حدّث الصفحة.</p>}
            {savingChecklist && <p role="status" className="mt-2 text-xs text-teal-700">جارٍ حفظ التقدّم…</p>}
            <div className="mt-5 space-y-2">
              {journey.documents.map((document) => {
                const isChecked = checked.includes(document.id);
                return (
                  <label key={document.id} className="focus-within:ring-2 focus-within:ring-teal-200 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                    <input type="checkbox" disabled={!checklistReady || savingChecklist} checked={isChecked} onChange={() => saveChecklist(isChecked ? checked.filter((id) => id !== document.id) : [...checked, document.id])} className="sr-only" />
                    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${isChecked ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white"}`}>{isChecked && <Check size={14} />}</span>
                    <span className={isChecked ? "text-sm text-slate-500 line-through" : "text-sm font-bold"}>{document.titleAr}</span>
                  </label>
                );
              })}
              {journey.documents.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-500">لا توجد مستندات منشورة لهذه الحالة في وضع المعرفة الحالي.</p>}
            </div>
            {checked.length > 0 && <button disabled={!checklistReady || savingChecklist} onClick={() => saveChecklist([])} className="focus-ring mt-4 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-50">مسح التقدم</button>}
          </section>
          <AIStatus />
          <SupportLink context={editGoal} interactionId={journey.historyStorage?.id}/>
          <section className="rounded-3xl border border-slate-200 bg-white/70 p-5">
            <div className="flex items-center gap-2"><FileText className="text-teal-700" size={18} /><h2 className="font-black">عن المصادر</h2></div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{journey.sources.length} مصادر رسمية مرتبطة بهذه الرحلة. جمع المصدر لا يعني اعتماد محتواه، وتاريخ كل مصدر ظاهر في السجل.</p>
            <Link href="/sources" className="focus-ring mt-3 inline-flex items-center gap-1 rounded-lg text-sm font-bold text-teal-700">عرض سجل المصادر <ArrowUpLeft size={15} /></Link>
          </section>
        </aside>
      </div>
      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500"><CheckCircle2 size={14} /> إصدار المعرفة: <span className="ltr">{journey.knowledgeVersion}</span></div>
    </div>
  );
}
