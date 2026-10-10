"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, Check, CircleOff, ListChecks, LoaderCircle, RotateCcw, Send } from "lucide-react";
import { AnswerPanel } from "@/components/answer-panel";
import { fetchJson } from "@/lib/client-api";
import type { AnswerResponse, IntakeQuestion, IntakeResponse } from "@/lib/contracts";
import { SupportLink } from "@/components/support-link";
import { RequestWaiting } from "@/components/request-waiting";

type Slots = Record<string, string | null | undefined>;

const labels: Record<string, string> = {
  "clothing-retail": "بيع الملابس",
  amman: "أمانة عمّان",
  "sole-proprietorship": "مؤسسة فردية",
  rent: "مستأجر",
  own: "مملوك",
};

export function IntakeWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [goal, setGoal] = useState(searchParams.get("goal") ?? "");
  const [result, setResult] = useState<IntakeResponse | null>(null);
  const [history, setHistory] = useState<Array<{ question: IntakeQuestion; value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelled,setCancelled]=useState(false);
  const [mode, setMode] = useState<"journey" | "ask">(searchParams.get("mode") === "ask" ? "ask" : "journey");
  const [knowledgeAnswer, setKnowledgeAnswer] = useState<AnswerResponse | null>(null);
  const requestRef = useRef(0);
  const flowRef=useRef("");
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => { controllerRef.current?.abort(); requestRef.current += 1; }, []);
  function cancelRequest() { controllerRef.current?.abort(); requestRef.current += 1; setLoading(false); setCancelled(true); }

  async function submit(slots: Slots = {}) {
    if(!flowRef.current)flowRef.current=crypto.randomUUID();
    setCancelled(false);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    setKnowledgeAnswer(null);
    try {
      const data = await fetchJson<IntakeResponse>("/api/intake", {
        method: "POST",
        headers:{"x-request-id":flowRef.current},
        signal: controller.signal,
        body: JSON.stringify({ goal, slots, history: [] }),
      });
      if (requestRef.current !== requestId) return;
      if (data.coverageStatus === "route_to_knowledge") {
        setLoading(false);
        void askKnowledge();
        return;
      }
      if (data.coverageStatus.startsWith("unsupported") && data.coverageStatus !== "unsupported_service") {
        router.push(`/explore?${new URLSearchParams({goal:goal.trim(),flow:flowRef.current})}`);
        return;
      }
      setResult(data);
      if (data.coverageStatus === "covered_demo" && !data.nextQuestion) {
        const params = new URLSearchParams();
        params.set("flow",flowRef.current);
        Object.entries(data.normalizedSlots).forEach(([key, value]) => value && params.set(key, String(value)));
        router.push(`/journey?${params.toString()}`);
      }
    } catch (caught) {
      if (requestRef.current !== requestId) return;
      setError(caught instanceof Error ? caught.message : "حدث خطأ غير متوقع.");
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }

  async function askKnowledge() {
    if(!flowRef.current)flowRef.current=crypto.randomUUID();
    setCancelled(false);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestRef.current;
    setMode("ask");
    setLoading(true);
    setError("");
    setResult(null);
    setKnowledgeAnswer(null);
    try {
      const data = await fetchJson<AnswerResponse>("/api/answer", {
        method: "POST",
        headers:{"x-request-id":flowRef.current},
        signal: controller.signal,
        body: JSON.stringify({ question: goal, slots: {} }),
      });
      if (requestRef.current === requestId) setKnowledgeAnswer(data);
    } catch (caught) {
      if (requestRef.current !== requestId) return;
      setError(caught instanceof Error ? caught.message : "تعذر إرسال السؤال.");
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }

  function start(event: FormEvent) {
    event.preventDefault();
    if (!goal.trim()) return;
    flowRef.current=crypto.randomUUID();
    if (mode === "ask") void askKnowledge();
    else void submit();
  }

  function choose(value: string, label: string) {
    if (!result?.nextQuestion) return;
    const question = result.nextQuestion;
    setHistory((items) => [...items.filter(item=>item.question.id!==question.id), { question, value, label }]);
    void submit({ ...result.normalizedSlots, [question.id]: value });
  }

  function edit(index: number) {
    const target = history[index];
    const kept = history.slice(0, index);
    const slots = { ...(result?.normalizedSlots ?? {}) };
    for (const item of history.slice(index)) delete slots[item.question.id];
    delete slots[target.question.id];
    setHistory(kept);
    setResult((current) => current ? { ...current, normalizedSlots: slots, nextQuestion: target.question } : current);
  }

  function reset() {
    setCancelled(false);
    controllerRef.current?.abort();
    requestRef.current += 1;
    setLoading(false);
    setResult(null);
    setHistory([]);
    setError("");
    setKnowledgeAnswer(null);
  }

  function changeMode(nextMode: "journey" | "ask") {
    if (nextMode === mode) return;
    setCancelled(false);
    controllerRef.current?.abort();
    requestRef.current += 1;
    setMode(nextMode);
    setGoal("");
    setLoading(false);
    setResult(null);
    setHistory([]);
    setKnowledgeAnswer(null);
    setError("");
  }

  if (!result) {
    return (
      <form onSubmit={start} className="card min-w-0 max-w-full rounded-[2rem] p-4 sm:p-6" aria-label="وصف هدف المشروع">
        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1" role="group" aria-label="نوع الطلب">
          <button type="button" aria-pressed={mode === "journey"} onClick={() => changeMode("journey")} className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${mode === "journey" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><ListChecks size={17} /> خطّة مشروع</button>
          <button type="button" aria-pressed={mode === "ask"} onClick={() => changeMode("ask")} className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${mode === "ask" ? "bg-white text-violet-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><Bot size={17} /> سؤال عن الإجراءات</button>
        </div>
        <label htmlFor="goal" className="mb-3 block text-sm font-bold text-slate-700">{mode === "journey" ? "شو مشروعك ووين بدك تبدأ؟" : "شو حاب تعرف من المصادر المتاحة؟"}</label>
        <textarea
          id="goal"
          value={goal}
          onChange={(event) => { setGoal(event.target.value); setKnowledgeAnswer(null); }}
          maxLength={1000}
          rows={3}
          disabled={loading}
          aria-describedby="goal-help"
          placeholder={mode === "journey" ? "مثال: بدي أفتح مغسلة سيارات في إربد، المحل مستأجر، وبدي أعرف التجهيزات وخطوات البداية." : "مثال: شو الوثيقة المطلوبة إذا كان المحل مستأجرًا؟"}
          className="focus-ring block w-full min-w-0 max-w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base leading-7 shadow-inner placeholder:text-slate-400"
          required
        />
        <p id="goal-help" className="mt-2 text-xs leading-6 text-slate-500">{mode==="journey"?"اذكر نوع المشروع والمدينة. نسألك عن التفاصيل الناقصة إذا احتجناها.":"نسند الإجابة إلى النصوص المتاحة، ونبيّن حالة مراجعتها."}</p>
        {mode === "journey" && <div className="mt-2 flex flex-wrap gap-2">{["مغسلة سيارات", "محل حلويات", "صالون نسائي"].map((example) => <button key={example} type="button" disabled={loading} onClick={() => { setGoal(`بدي أفتح ${example}`); setError(""); }} className="focus-ring min-h-11 rounded-full border border-teal-100 bg-teal-50/60 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100">{example}</button>)}</div>}
        {error && <p className="mt-2 text-sm font-bold text-red-700" role="alert">{error}</p>}
        <div className="mt-4 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">لا تدخل رقمًا وطنيًا أو بيانات شخصية. الخدمة إرشادية وليست معاملة حكومية.</p>
          <button
            type="submit"
            disabled={loading || !goal.trim()}
            className="focus-ring inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-6 font-bold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="animate-spin" size={19} /> : mode === "journey" ? <ArrowLeft size={19} /> : <Send size={18} />}
            {loading ? (mode === "journey" ? "جاري الفهم والبحث…" : "جاري البحث…") : (mode === "journey" ? "ابدأ خطّتي" : "احصل على الإجابة")}
          </button>
        </div>
        {loading && <RequestWaiting onCancel={cancelRequest}/>}
        {cancelled&&<p role="status" className="mt-3 text-sm leading-7 text-slate-600">تم إيقاف الانتظار. يمكنك تعديل طلبك وإرساله مجددًا.</p>}
        {knowledgeAnswer && <div className="mt-5"><AnswerPanel answer={knowledgeAnswer} question={goal}/></div>}
        {error && <SupportLink context={goal}/>}
      </form>
    );
  }

  if (result.coverageStatus === "unsupported_service" || result.coverageStatus === "needs_intent_clarification") {
    return (
      <section className="card animate-rise rounded-[2rem] p-6 sm:p-8" aria-live="polite">
        <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-800"><CircleOff /></div>
        <h2 className="text-2xl font-black">{result.coverageStatus === "unsupported_service" ? "هذه الخدمة ليست ضمن خدماتنا" : "نحتاج وصفًا أوضح"}</h2>
        <p className="mt-3 max-w-xl leading-8 text-slate-600">{result.coverageMessageAr}</p>
        {result.supportedServices && (
          <div className="mt-6">
            <h3 className="text-sm font-black text-slate-800">شو بنقدر نساعدك فيه؟</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {result.supportedServices.map((service) => (
                <article key={service.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="font-black text-teal-800">{service.titleAr}</h4>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{service.descriptionAr}</p>
                </article>
              ))}
            </div>
          </div>
        )}
        <p className="mt-4 text-sm text-slate-500">لن نحوّل طلبك إلى رحلة ملابس، ولن نخترع إجراءات غير موجودة في مصادرنا.</p>
        <SupportLink context={goal} interactionId={result.historyStorage?.id}/>
        <button onClick={reset} className="focus-ring mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 font-bold hover:bg-slate-50">
          <RotateCcw size={17} /> ابدأ من جديد
        </button>
      </section>
    );
  }

  const completedCount = Object.entries(result.normalizedSlots)
    .filter(([key, value]) => ["activityId", "municipalityId", "legalForm", "premisesTenure"].includes(key) && value && value !== "unknown")
    .length;
  const currentStep = Math.min(4, completedCount + (result.nextQuestion ? 1 : 0));
  return (
    <section className="card animate-rise overflow-hidden rounded-[2rem]" aria-live="polite">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-bold text-teal-800">توضيح الحالة</span>
          <span className="text-slate-500">{currentStep} من 4</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${(currentStep / 4) * 100}%` }} />
        </div>
      </div>
      <div className="p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap gap-2">
          {Object.values(result.normalizedSlots).filter((value) => value && labels[value]).map((value) => (
            <span key={value} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
              <Check size={13} /> {labels[value!]}
            </span>
          ))}
        </div>
        {history.map((item, index) => (
          <div key={`${item.question.id}-${index}`} className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
            <span><span className="text-slate-500">{item.question.textAr}</span> <strong className="mr-2">{item.label}</strong></span>
            <button onClick={() => edit(index)} className="focus-ring shrink-0 rounded-lg px-2 py-1 font-bold text-teal-700 hover:bg-teal-50">تعديل</button>
          </div>
        ))}
        {result.nextQuestion && (
          <div className="mt-6 animate-rise">
            <h2 className="text-xl font-black sm:text-2xl">{result.nextQuestion.textAr}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {result.nextQuestion.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={loading}
                  onClick={() => choose(option.value, option.labelAr)}
                  className="focus-ring flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-right font-bold transition hover:border-teal-500 hover:bg-teal-50 disabled:opacity-50"
                >
                  {option.labelAr}
                  {loading ? <LoaderCircle className="animate-spin text-slate-400" size={18} /> : <ArrowLeft className="text-teal-700" size={18} />}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="mt-4 text-sm font-bold text-red-700" role="alert">{error}</p>}
        {loading && <RequestWaiting onCancel={cancelRequest}/>}
        {cancelled&&<p role="status" className="mt-3 text-sm leading-7 text-slate-600">تم إيقاف الانتظار. اختر إجابتك للمتابعة.</p>}
        <SupportLink context={goal} interactionId={result.historyStorage?.id}/>
        <button onClick={reset} className="focus-ring mt-6 inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">
          <ArrowRight size={16} /> تغيير وصف الهدف
        </button>
      </div>
    </section>
  );
}
