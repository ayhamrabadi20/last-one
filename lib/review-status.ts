export function evidenceReviewStatus(statuses: Array<string | undefined>) {
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.length && statuses.every(status => status === "reviewed")) return "reviewed";
  return "pending";
}
export const reviewLabels = { pending: "بانتظار مراجعة بشرية", reviewed: "تمت مراجعته بشريًا", rejected: "مرفوض في المراجعة" };
