import Link from "next/link";
import { ArrowUpLeft, LifeBuoy } from "lucide-react";
export function SupportLink({ context = "", interactionId }: { context?: string; interactionId?: string }) {
  const params = new URLSearchParams();
  if (context) params.set("context", context.slice(0,1500));
  if (interactionId) params.set("request", interactionId);
  return <Link href={`/support?${params.toString()}`} className="focus-ring mt-4 flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-teal-900 transition hover:bg-teal-100"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white"><LifeBuoy size={20} /></span><span className="flex-1"><strong className="block text-sm">في مشكلة بهذا الطلب؟</strong><span className="mt-1 block text-xs text-teal-800/80">اكتب للدعم، وأرفق وصف الطلب تلقائيًا.</span></span><ArrowUpLeft size={19} /></Link>;
}
