import sourcesData from "@/data/sources.json";
import chunksData from "@/data/chunks.json";
import proceduresData from "@/data/procedures.json";
import demoProceduresData from "@/data/demo-procedures.json";

export type ReviewStatus = "pending" | "reviewed" | "rejected";

export type Source = {
  id: string;
  titleAr: string;
  authority: string;
  url: string;
  retrievedAt: string;
  publishedAt: string | null;
  contentReviewedAt: string | null;
  reviewStatus: ReviewStatus;
  noteAr: string;
};

export type Chunk = {
  id: string;
  sourceId: string;
  text: string;
  page: string | null;
  section: string;
  topicTags: string[];
  scope: string[];
  procedureIds: string[];
  reviewStatus: ReviewStatus;
};

export type DocumentRequirement = {
  id: string;
  titleAr: string;
  evidenceChunkIds: string[];
};

export type RuleCondition =
  | { op: "equals"; field: string; value: string }
  | { op: "in"; field: string; values: string[] }
  | { op: "all"; conditions: RuleCondition[] }
  | { op: "any"; conditions: RuleCondition[] };

export type Procedure = {
  id: string;
  titleAr: string;
  authority: string;
  scope: string;
  conditions: RuleCondition;
  dependsOn: string[];
  requiredDocuments: DocumentRequirement[];
  actionSteps: string[];
  evidenceChunkIds: string[];
  reviewStatus: ReviewStatus | "demo";
  explanationAr: string;
};

export const sources = sourcesData as Source[];
export const chunks = chunksData as Chunk[];
export const reviewedProcedures = proceduresData as Procedure[];
export const demoProcedures = demoProceduresData as Procedure[];

export function isDemoKnowledge() {
  return process.env.KNOWLEDGE_MODE !== "production";
}

export function activeProcedures() {
  return isDemoKnowledge() ? demoProcedures : reviewedProcedures;
}

export function activeChunks() {
  return chunks.filter((chunk) =>
    isDemoKnowledge() ? chunk.reviewStatus !== "rejected" : chunk.reviewStatus === "reviewed",
  );
}

export function sourceById(id: string) {
  return sources.find((source) => source.id === id);
}

export function chunkById(id: string) {
  return chunks.find((chunk) => chunk.id === id);
}
