export const metadata = { title: "طلباتي وردودي | Mustanad Jo" };
import { SiteHeader } from "@/components/site-header";
import { HistoryView } from "@/components/history-view";
import { requirePageSession } from "@/lib/auth";

export default async function HistoryPage() {
  await requirePageSession();
  return <main className="min-h-screen"><SiteHeader compact /><div id="main-content" tabIndex={-1} className="shell py-8 sm:py-12"><p className="text-sm font-bold text-teal-700">مساحة طلباتك</p><h1 className="mt-1 text-3xl font-black">الطلبات والردود السابقة</h1><p className="mt-3 mb-7 text-slate-600">ارجع لطلباتك وإجاباتك المحفوظة، أو أرسل للدعم عن مشكلة مرتبطة بطلب محدد.</p><HistoryView /></div></main>;
}
