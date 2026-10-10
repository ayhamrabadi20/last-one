import { evidenceReviewStatus, reviewLabels } from "@/lib/review-status";
type Section = { title:string; paragraphs:string[] };
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
const strings=(value:unknown):string[]=>Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[];
const text=(value:unknown)=>typeof value==="string"?value:"";
const coverageLabels:Record<string,string>={needs_clarification:"بانتظار توضيح تفاصيل مشروعك",covered_demo:"اكتملت تفاصيل الحالة",route_to_knowledge:"تم تحويل الطلب إلى سؤال عن المصادر",needs_intent_clarification:"يحتاج الطلب وصفًا أوضح",unsupported_service:"الخدمة خارج النطاق الحالي"};
export function summarizeStoredResponse(response:unknown){
 const value=record(response);
 return text(value.answer)||text(value.coverageMessageAr)||text(value.titleAr)||coverageLabels[text(value.coverageStatus)]||"تم حفظ الاستجابة.";
}
export function storedResponseSections(response:unknown):Section[]{
 const value=record(response);const overview=record(value.overview);const sections:Section[]=[];
 const add=(title:string,paragraphs:string[])=>{const nonempty=paragraphs.filter(Boolean);if(nonempty.length)sections.push({title,paragraphs:nonempty});};
 add("الإجابة المحفوظة",[text(value.answer)]);
 add("ملاحظات مهمة",[text(value.noticeAr),text(value.contentNoticeAr),text(value.coverageMessageAr)]);
 add("ملخص مشروعك",[text(overview.summaryAr)]);
 add("خطوتك الأولى",[text(overview.firstActionAr)]);
 add("أسئلة تساعدك على القرار",strings(overview.questions));
 add("أمور انتبه لها",strings(overview.risks));
 if(Array.isArray(value.steps))for(const raw of value.steps){const step=record(raw);add(text(step.titleAr)||"خطوة",[text(step.authority),text(step.purposeAr),...strings(step.actions),...strings(step.actionSteps),text(step.explanationAr),...strings(step.completionEvidence)]);}
 if(Array.isArray(value.documents))add("الوثائق المطلوبة",value.documents.map(item=>text(record(item).titleAr)));
  if(Array.isArray(value.citations))for(const raw of value.citations){const citation=record(raw);const source=record(citation.source);const chunk=record(citation.chunk);add(text(source.titleAr)||"دليل الإجابة",[text(chunk.text),reviewLabels[evidenceReviewStatus([text(source.reviewStatus),text(chunk.reviewStatus)])]]);}
 const next=record(value.nextQuestion);add("التوضيح المطلوب",[text(next.textAr)]);
 return sections;
}
