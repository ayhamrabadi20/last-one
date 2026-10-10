import { Bot, CircleAlert, ExternalLink } from "lucide-react";
import type { AnswerResponse } from "@/lib/contracts";
import { SupportLink } from "@/components/support-link";
import { ReviewBadge } from "@/components/review-badge";
import { evidenceReviewStatus } from "@/lib/review-status";

export function AnswerPanel({ answer, question = "" }: { answer: AnswerResponse; question?: string }) {
  const answered = answer.status === "answered";
  const points = answer.claims?.length && answer.claims.length > 1 ? answer.claims : null;
  const review=evidenceReviewStatus(answer.citations.flatMap(citation=>[citation.source.reviewStatus,citation.chunk.reviewStatus]));
  return (
    <div className={`rounded-2xl border p-4 ${answered ? "border-violet-200 bg-violet-50" : "border-amber-200 bg-amber-50"}`} aria-live="polite">
      {question && <p className="mb-4 break-words text-sm font-bold text-slate-700">سؤالك: {question}</p>}
      {answered && answer.citations.length > 0 && <div className="mb-4 space-y-2"><ReviewBadge statuses={[review]}/>{review!=="reviewed"&&<p className="text-xs leading-6 text-amber-900">{review==="rejected"?"يتضمن الدليل مقطعًا مرفوضًا؛ راجع الجهة المختصة قبل الاعتماد على الإجابة.":"النصوص الداعمة لم تكتمل مراجعتها البشرية. تحقّق من الجهة المختصة قبل تنفيذ إجراء."}</p>}</div>}
      <div className="flex items-start gap-2">
        {answered
          ? <Bot className="mt-1 shrink-0 text-violet-700" size={18} />
          : <CircleAlert className="mt-1 shrink-0 text-amber-700" size={18} />}
        <div className="min-w-0 flex-1"><p className="mb-2 text-xs font-bold text-slate-500">{answered ? "الإجابة حسب المصادر المتاحة" : "ما نحتاج توضيحه"}</p>{points ? <ol className="space-y-3">{points.map((point, index) => <li key={`${index}-${point.text}`} className="flex gap-3"><span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-violet-800">{index + 1}</span><p className="whitespace-pre-line leading-8">{point.text}</p></li>)}</ol> : <p className="whitespace-pre-line leading-8">{answer.answer}</p>}</div>
      </div>
      {answer.supportedServices && (
        <div className="mt-4 grid gap-2 border-t border-black/10 pt-4 sm:grid-cols-3">
          {answer.supportedServices.map((service) => (
            <div key={service.id} className="rounded-xl bg-white/80 p-3">
              <strong className="text-sm text-teal-800">{service.titleAr}</strong>
              <p className="mt-1 text-xs leading-5 text-slate-600">{service.descriptionAr}</p>
            </div>
          ))}
        </div>
      )}
      {answer.citations.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-black/10 pt-3">
          <p className="text-xs font-black text-slate-700">الأدلة المرتبطة بالإجابة</p>
          {answer.citations.map((citation) => (
            <details key={citation.chunk.id} className="rounded-xl bg-white/80 px-3 py-2 text-xs">
              <summary className="focus-ring min-h-11 cursor-pointer py-2 font-bold text-violet-800">{citation.source.titleAr}</summary>
              <div className="mt-2"><ReviewBadge statuses={[citation.source.reviewStatus,citation.chunk.reviewStatus]}/></div>
              <blockquote className="mt-2 border-r-2 border-violet-300 pr-3 leading-6 text-slate-600">{citation.chunk.text}</blockquote>
              <a href={citation.source.url} target="_blank" rel="noopener noreferrer" className="focus-ring mt-2 inline-flex items-center gap-1 rounded font-bold text-teal-700">فتح المصدر الرسمي <ExternalLink size={12} /></a>
            </details>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-500">
        {answer.aiMode === "ollama"
          ? "صيغت الإجابة بالذكاء الاصطناعي مع فحص ارتباط الادعاءات بالنصوص الداعمة."
          : answer.aiMode === "extractive"
            ? "هذه إجابة مباشرة من نص محفوظ في المصادر المتاحة."
            : "لم نتمكن من صياغة إجابة موثوقة من المصادر المتاحة لهذا السؤال."}
      </p>
      <SupportLink context={question} interactionId={answer.historyStorage?.id}/>
    </div>
  );
}
