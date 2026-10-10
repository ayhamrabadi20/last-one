export const metadata = { title: "مركز الدعم | Mustanad Jo" };
import { Suspense } from "react";
import { requirePageSession } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SupportView } from "@/components/support-view";
export default async function SupportPage() {
  await requirePageSession();
  return <main className="min-h-screen"><SiteHeader/><div id="main-content" tabIndex={-1}><Suspense fallback={<div className="shell py-20 text-center">جارٍ تحميل مركز الدعم…</div>}><SupportView/></Suspense></div></main>;
}
