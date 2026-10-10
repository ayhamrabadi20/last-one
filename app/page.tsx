import { Suspense } from "react";
import { ArrowLeft, BookOpenCheck, CircleOff, Compass, ListChecks, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { IntakeWizard } from "@/components/intake-wizard";
import { AIStatus } from "@/components/ai-status";
import { requirePageSession } from "@/lib/auth";

export default async function HomePage() {
  await requirePageSession();
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <section id="main-content" tabIndex={-1} className="shell grid items-center gap-10 py-6 lg:grid-cols-[1.05fr_.95fr] lg:py-14">
        <div className="min-w-0 animate-rise">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-bold text-teal-800">
            <span className="size-2 rounded-full bg-teal-500" /> من فكرتك إلى خطوات واضحة
          </div>
          <h1 className="max-w-3xl text-3xl font-black leading-[1.35] tracking-tight sm:text-5xl">
            فكرتك تستحق بداية.<br /><span className="text-teal-700">خلّينا نرتّب خطّتك.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            اكتب مشروعك وموقعه. نرتّب لك خطوات البداية والتجهيز والتشغيل، ونوضّح ما يحتاج التحقق من الجهة المختصة.
          </p>
          <div className="mt-7">
            <Suspense fallback={<div className="card h-52 animate-pulse rounded-[2rem]" />}>
              <IntakeWizard />
            </Suspense>
          </div>
          <div className="mt-4"><AIStatus compact /></div>
        </div>

        <div className="relative hidden lg:block" aria-hidden="true">
          <div className="absolute -right-8 top-12 size-40 rounded-full bg-amber-200/40 blur-2xl" />
          <div className="card relative rotate-1 rounded-[2.5rem] p-7">
            <div className="mb-6 flex items-center justify-between">
              <div><p className="text-xs font-bold text-teal-700">رحلتك المقترحة</p><h2 className="mt-1 text-xl font-black">فتح محل ملابس</h2></div>
              <span className="grid size-12 place-items-center rounded-2xl bg-teal-700 text-white"><ArrowLeft /></span>
            </div>
            {[
              ["01", "تسجيل المؤسسة الفردية", "وزارة الصناعة والتجارة"],
              ["02", "إثبات إشغال الموقع", "حسب ملكية المحل"],
              ["03", "مراجعة رخصة المهن", "أمانة عمّان الكبرى"],
            ].map(([number, title, authority], index) => (
              <div key={number} className="relative flex gap-4 pb-6 last:pb-0">
                {index < 2 && <span className="absolute right-[1.15rem] top-10 h-[calc(100%-1.5rem)] w-px bg-teal-200" />}
                <span className="relative grid size-10 shrink-0 place-items-center rounded-full border-4 border-white bg-teal-100 text-xs font-black text-teal-800">{number}</span>
                <div className="pt-1"><h3 className="font-black">{title}</h3><p className="mt-1 text-sm text-slate-500">{authority}</p></div>
              </div>
            ))}
            <div className="mt-7 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              كل المحتوى الحكومي في العرض الحالي موسوم كمسودة تحتاج مراجعة بشرية.
            </div>
          </div>
        </div>
      </section>

      <section className="shell pb-12" aria-labelledby="service-scope-title">
        <div className="card rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-800"><Compass size={21} /></span><div><p className="text-sm font-bold text-teal-700">نطاق النسخة الحالية</p><h2 id="service-scope-title" className="text-2xl font-black">شو بنقدر نعمل لك؟</h2></div></div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">رحلة موثقة بالقواعد</h3><p className="mt-2 text-sm leading-7 text-slate-600">بيع ملابس بالتجزئة، مؤسسة فردية، داخل أمانة عمّان، ومحل مستأجر أو مملوك.</p></article>
            <article className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">خطة تناسب نوع مشروعك</h3><p className="mt-2 text-sm leading-7 text-slate-600">مغسلة سيارات، صالون، مطعم، سوبرماركت، متجر وغيرها: تفاصيل التجهيز والتشغيل والتكاليف، وأسئلة تساعدك في تحديد الخطوة التالية.</p></article>
            <article className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">إجابة من المصادر</h3><p className="mt-2 text-sm leading-7 text-slate-600">نسند الإجابة إلى مقطع موجود؛ وإذا لم نجد دليلًا نقول ذلك بوضوح.</p></article>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-950"><CircleOff className="mt-1 shrink-0" size={17} /><p><strong>ليست ضمن خدماتنا:</strong> تنفيذ أو تجديد الهوية والجواز ورخصة القيادة وأي معاملة حكومية شخصية. لن نحوّل هذه الطلبات إلى رحلة مختلفة.</p></div>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/60 py-10">
        <div className="shell grid gap-4 sm:grid-cols-3">
          {[
            [ListChecks, "خطوات حسب حالتك", "أسئلة تؤثر فعلًا في القواعد، لا استبيان طويل."],
            [BookOpenCheck, "مصدر لكل معلومة", "نحتفظ بالمقطع الداعم وحالة مراجعته، لا بالرابط فقط."],
            [ShieldCheck, "مساحة خاصة بحسابك", "طلباتك وتقدّمك محفوظة لحسابك. لا تضع معلومات حساسة في وصف المشروع."],
          ].map(([Icon, title, text]) => {
            const FeatureIcon = Icon as typeof ListChecks;
            return (
              <article key={String(title)} className="rounded-2xl border border-slate-100 bg-white p-5">
                <FeatureIcon className="text-teal-700" size={24} /><h2 className="mt-4 font-black">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{String(text)}</p>
              </article>
            );
          })}
        </div>
      </section>
      <footer className="shell py-8 text-center text-xs leading-6 text-slate-500">Mustanad Jo أداة إرشادية تجريبية، وليست جهة حكومية أو بديلًا عن التحقق من الجهة المختصة.</footer>
    </main>
  );
}
