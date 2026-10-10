"use client";

import { useEffect, useState } from "react";
import { BookOpen, CircleAlert, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/client-api";
import type { EvidenceChunk, SourceRecord } from "@/lib/contracts";
import { ReviewBadge } from "@/components/review-badge";

type SourcesResponse = { sources: SourceRecord[]; chunks: EvidenceChunk[]; knowledgeMode: string };

export function SourcesView() {
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState(0);
  useEffect(() => {
    let mounted = true;
    fetchJson<SourcesResponse>("/api/sources")
      .then((nextData) => { if (mounted) setData(nextData); })
      .catch((caught) => {
        if (!mounted) return;
        setError(caught instanceof Error ? caught.message : "تعذر تحميل سجل المصادر.");
      });
    return () => { mounted = false; };
  }, [requestId]);
  function retry() {
    setError("");
    setData(null);
    setRequestId((value) => value + 1);
  }
  if (error && !data) return (
    <div className="shell py-20 text-center" role="alert">
      <CircleAlert className="mx-auto text-red-700" size={40} />
      <h1 className="mt-4 text-2xl font-black">تعذر تحميل المصادر</h1>
      <p className="mt-2 text-slate-600">{error}</p>
      <button onClick={retry} className="focus-ring mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-3 font-bold text-white"><RefreshCw size={17} /> إعادة المحاولة</button>
    </div>
  );
  if (!data) return <div className="flex items-center justify-center gap-2 py-24 text-slate-500" role="status"><LoaderCircle className="animate-spin" /> تحميل سجل المصادر…</div>;
  return (
    <div className="shell py-10">
      <div className="max-w-3xl"><p className="text-sm font-bold text-teal-700">الشفافية أولًا</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">سجل المصادر والأدلة</h1><p className="mt-4 leading-8 text-slate-600">راجع النصوص الداعمة وروابط الجهات وحالة مراجعة كل مصدر. وجود رابط رسمي لا يعني أن النص المحفوظ مكتمل أو محدّث؛ تحقّق من الجهة المختصة قبل التنفيذ.</p></div>
      <div className="mt-8 space-y-5">
        {data.sources.map((source) => {
          const chunks = data.chunks.filter((chunk) => chunk.sourceId === source.id);
          return (
            <article key={source.id} className="card rounded-3xl p-5 sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold text-teal-700">{source.authority}</p><h2 className="mt-1 text-xl font-black">{source.titleAr}</h2></div><ReviewBadge statuses={[source.reviewStatus]}/></div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{source.noteAr}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span>تاريخ الجمع: {source.retrievedAt}</span><a href={source.url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 rounded font-bold text-teal-700">فتح المصدر الرسمي <ExternalLink size={13} /></a></div>
              {chunks.length > 0 && <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">{chunks.map((chunk) => <div key={chunk.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><BookOpen size={14} /> {chunk.section}{chunk.page ? ` — ${chunk.page}` : ""}</div><blockquote className="mt-2 border-r-2 border-teal-500 pr-3 text-sm leading-7 text-slate-700">{chunk.text}</blockquote><code className="ltr mt-2 block text-left text-[11px] text-slate-400">{chunk.id}</code></div>)}</div>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
