import { evidenceReviewStatus, reviewLabels } from "@/lib/review-status";
export function ReviewBadge({statuses}:{statuses:Array<string|undefined>}) {
 const status=evidenceReviewStatus(statuses);
 return <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${status==="reviewed"?"bg-teal-100 text-teal-800":status==="rejected"?"bg-red-100 text-red-700":"bg-amber-100 text-amber-900"}`}>{reviewLabels[status]}</span>;
}
