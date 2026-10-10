import { describe, expect, it } from "vitest";
import { evidenceReviewStatus } from "@/lib/review-status";
import { storedResponseSections, summarizeStoredResponse } from "@/lib/history-presentation";
describe("honest review state",()=>{
 it("only labels evidence reviewed when every source and chunk is reviewed",()=>{expect(evidenceReviewStatus(["reviewed","pending"])).toBe("pending");expect(evidenceReviewStatus(["reviewed",undefined])).toBe("pending");expect(evidenceReviewStatus([])).toBe("pending");expect(evidenceReviewStatus(["reviewed","reviewed"])).toBe("reviewed");});
 it("never hides a rejected source behind a reviewed chunk",()=>{expect(evidenceReviewStatus(["reviewed","rejected","pending"])).toBe("rejected");});
});
describe("saved response reading",()=>{
 it("shows the entire saved answer rather than a truncated summary",()=>{const answer="نص ".repeat(500);expect(storedResponseSections({answer})[0].paragraphs[0]).toBe(answer);});
 it("recovers project actions and documents without generating a new answer",()=>{const response={steps:[{titleAr:"التجهيز",actions:["حدد الموقع","قارن المعدات"],completionEvidence:["قائمة المعدات"]}],documents:[{titleAr:"وثيقة الإشغال"}]};expect(storedResponseSections(response)).toEqual([{title:"التجهيز",paragraphs:["حدد الموقع","قارن المعدات","قائمة المعدات"]},{title:"الوثائق المطلوبة",paragraphs:["وثيقة الإشغال"]}]);});
 it("handles older or malformed records without exposing raw JSON",()=>{expect(storedResponseSections(null)).toEqual([]);expect(storedResponseSections({steps:[null,{actions:[{},"خطوة"]}]})).toEqual([{title:"خطوة",paragraphs:["خطوة"]}]);expect(summarizeStoredResponse({coverageStatus:"needs_clarification"})).toBe("بانتظار توضيح تفاصيل مشروعك");expect(summarizeStoredResponse({internalSecret:"hidden"})).toBe("تم حفظ الاستجابة.");});
});
