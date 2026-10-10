export const metadata = { title: "رحلة الإجراءات | Mustanad Jo" };
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { JourneyView } from "@/components/journey-view";
import { requirePageSession } from "@/lib/auth";

export default async function JourneyPage() {
  await requirePageSession();
  return (
    <main className="min-h-screen">
      <SiteHeader compact />
      <div id="main-content" tabIndex={-1}><Suspense fallback={<div className="shell my-12 h-96 animate-pulse rounded-3xl bg-slate-200" />}>
        <JourneyView />
      </Suspense></div>
    </main>
  );
}
