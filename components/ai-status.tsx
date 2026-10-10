"use client";

import { useEffect, useState } from "react";
import { Bot, CircleAlert, LoaderCircle } from "lucide-react";
import { fetchJson } from "@/lib/client-api";
import type { AIStatusResponse } from "@/lib/contracts";

export function AIStatus({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<AIStatusResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchJson<AIStatusResponse>("/api/status")
      .then((nextStatus) => {
        if (mounted) setStatus(nextStatus);
      })
      .catch(() => {
        if (mounted) setStatus({ available: false, model: "", messageAr: "تعذر فحص Ollama. وضع القواعد متاح." });
      });
    return () => { mounted = false; };
  }, []);

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
        <LoaderCircle className="animate-spin" size={16} /> جارٍ فحص النموذج المحلي…
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm ${status.available ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-600"}`}
      role="status"
    >
      {status.available ? <Bot className="mt-0.5 shrink-0" size={17} /> : <CircleAlert className="mt-0.5 shrink-0" size={17} />}
      <span>{compact ? status.available ? "المساعد الذكي متاح للإجابة من المصادر" : "خطط المشروع متاحة. صياغة الإجابات الذكية غير متاحة الآن." : status.messageAr}</span>
    </div>
  );
}
