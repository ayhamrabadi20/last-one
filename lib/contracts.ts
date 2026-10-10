export type ReviewStatus = "pending" | "reviewed" | "rejected";

export type SourceRecord = {
  id: string;
  titleAr: string;
  authority: string;
  url: string;
  retrievedAt: string;
  reviewStatus: ReviewStatus;
  noteAr: string;
};

export type EvidenceChunk = {
  id: string;
  sourceId: string;
  text: string;
  section: string;
  page: string | null;
  reviewStatus: string;
};

export type JourneyStep = {
  order: number;
  id: string;
  titleAr: string;
  authority: string;
  scope: string;
  actionSteps: string[];
  dependsOn: string[];
  requiredDocumentIds: string[];
  evidenceChunkIds: string[];
  explanationAr: string;
  reviewStatus: string;
};

export type JourneyResponse = {
  historyStorage?: { saved: boolean; id?: string };
  scope: Record<string, string>;
  coverageStatus: string;
  contentNoticeAr: string;
  steps: JourneyStep[];
  documents: Array<{ id: string; titleAr: string; evidenceChunkIds: string[]; usedByStepIds: string[] }>;
  sources: SourceRecord[];
  evidence: EvidenceChunk[];
  knowledgeVersion: string;
};

export type AnswerResponse = {
  historyStorage?: { saved: boolean; id?: string };
  claims?: Array<{ text: string; evidenceChunkIds: string[] }>;
  status: "answered" | "insufficient_evidence";
  answer: string;
  aiMode: "ollama" | "extractive" | "fallback" | "not_called";
  contentStatus?: string;
  citations: Array<{ chunk: EvidenceChunk; source: SourceRecord }>;
  supportedServices?: Array<{ id: string; titleAr: string; descriptionAr: string }>;
};

export type AIStatusResponse = {
  available: boolean;
  model: string;
  messageAr: string;
};

export type IntakeQuestion = {
  id: string;
  textAr: string;
  options: Array<{ value: string; labelAr: string }>;
};

export type IntakeResponse = {
  historyStorage?: { saved: boolean; id?: string };
  normalizedSlots: Record<string, string | null | undefined>;
  missingSlots: string[];
  nextQuestion: IntakeQuestion | null;
  coverageStatus: string;
  coverageMessageAr: string | null;
  aiMode: "ollama" | "rules" | "fallback";
  requestIntent?: "business_journey" | "knowledge_question" | "unsupported_service" | "unclear";
  supportedServices?: Array<{ id: string; titleAr: string; descriptionAr: string }>;
};

export type ExplorationStep = {
  id: string;
  order: number;
  titleAr: string;
  purposeAr: string;
  actions: string[];
  completionEvidence: string[];
  sourceIds: string[];
  status: "research_required" | "supported_by_pending_source";
};

export type ExploreResponse = {
  historyStorage?: { saved: boolean; id?: string };
  overview: {
    sectorId: string;
    sectorAr: string;
    summaryAr: string;
    firstActionAr: string;
    questions: string[];
    risks: string[];
  };
  goal: string;
  profile: {
    activityAr: string;
    locationAr: string | null;
    category: "food" | "retail" | "services" | "digital" | "manufacturing" | "other";
    businessModel: "physical" | "online" | "mixed" | "unknown";
    premisesTenure: "rent" | "own" | "unknown";
  };
  titleAr: string;
  noticeAr: string;
  steps: ExplorationStep[];
  sources: SourceRecord[];
  aiMode: "ollama" | "fallback";
};
