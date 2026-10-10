export const metadata = { title: "خطة المشروع | Mustanad Jo" };
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { ExploreView } from "@/components/explore-view";
import { requirePageSession } from "@/lib/auth";

export default async function ExplorePage() {
  await requirePageSession();
  return (
    <main className="min-h-screen">
      <SiteHeader compact />
      <div id="main-content" tabIndex={-1}><Suspense fallback={<div className="shell my-12 h-96 animate-pulse rounded-3xl bg-slate-200" />}>
        <ExploreView />
      </Suspense></div>
    </main>
  );
}
