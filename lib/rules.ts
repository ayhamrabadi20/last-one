import type { CompleteSlots, Slots } from "@/lib/schemas";
import {
  activeProcedures,
  chunkById,
  sourceById,
  type Procedure,
  type RuleCondition,
} from "@/lib/knowledge";

export type Decision = "true" | "false" | "unknown";

export function evaluateCondition(
  condition: RuleCondition,
  facts: Record<string, unknown>,
): Decision {
  if (condition.op === "equals" || condition.op === "in") {
    const fact = facts[condition.field];
    if (fact === undefined || fact === null || fact === "unknown") return "unknown";
    if (condition.op === "equals") return fact === condition.value ? "true" : "false";
    return condition.values.includes(String(fact)) ? "true" : "false";
  }

  const decisions = condition.conditions.map((item) => evaluateCondition(item, facts));
  if (condition.op === "all") {
    if (decisions.includes("false")) return "false";
    return decisions.includes("unknown") ? "unknown" : "true";
  }
  if (decisions.includes("true")) return "true";
  return decisions.includes("unknown") ? "unknown" : "false";
}

export function validateProcedureGraph(procedures: Procedure[]) {
  const ids = new Set(procedures.map((procedure) => procedure.id));
  for (const procedure of procedures) {
    for (const dependency of procedure.dependsOn) {
      if (!ids.has(dependency)) {
        throw new Error(`MISSING_DEPENDENCY:${procedure.id}:${dependency}`);
      }
    }
  }
  topologicalSort(procedures);
}

export function topologicalSort(procedures: Procedure[]) {
  const byId = new Map(procedures.map((procedure) => [procedure.id, procedure]));
  const inDegree = new Map(procedures.map((procedure) => [procedure.id, 0]));
  const outgoing = new Map(procedures.map((procedure) => [procedure.id, [] as string[]]));

  for (const procedure of procedures) {
    for (const dependency of procedure.dependsOn) {
      if (!byId.has(dependency)) throw new Error(`MISSING_DEPENDENCY:${procedure.id}:${dependency}`);
      inDegree.set(procedure.id, (inDegree.get(procedure.id) ?? 0) + 1);
      outgoing.get(dependency)?.push(procedure.id);
    }
  }

  const queue = procedures.filter((procedure) => inDegree.get(procedure.id) === 0);
  const sorted: Procedure[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const nextId of outgoing.get(current.id) ?? []) {
      const nextDegree = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, nextDegree);
      if (nextDegree === 0) queue.push(byId.get(nextId)!);
    }
  }

  if (sorted.length !== procedures.length) throw new Error("CYCLIC_DEPENDENCY");
  return sorted;
}

export function selectProcedures(slots: Slots, procedures = activeProcedures()) {
  validateProcedureGraph(procedures);
  const selected: Procedure[] = [];
  const unknown: Procedure[] = [];
  for (const procedure of procedures) {
    const decision = evaluateCondition(procedure.conditions, slots);
    if (decision === "true") selected.push(procedure);
    if (decision === "unknown") unknown.push(procedure);
  }

  const selectedIds = new Set(selected.map((procedure) => procedure.id));
  for (const procedure of selected) {
    const unavailable = procedure.dependsOn.find((id) => !selectedIds.has(id));
    if (unavailable) throw new Error(`INACTIVE_DEPENDENCY:${procedure.id}:${unavailable}`);
  }

  return { selected: topologicalSort(selected), unknown };
}

export function buildJourney(slots: CompleteSlots) {
  const { selected, unknown } = selectProcedures(slots);
  const demoMode = process.env.KNOWLEDGE_MODE !== "production";
  const documentMap = new Map<
    string,
    { id: string; titleAr: string; evidenceChunkIds: string[]; usedByStepIds: string[] }
  >();
  const evidenceIds = new Set<string>();

  for (const procedure of selected) {
    procedure.evidenceChunkIds.forEach((id) => evidenceIds.add(id));
    for (const document of procedure.requiredDocuments) {
      document.evidenceChunkIds.forEach((id) => evidenceIds.add(id));
      const current = documentMap.get(document.id);
      if (current) {
        current.usedByStepIds.push(procedure.id);
      } else {
        documentMap.set(document.id, { ...document, usedByStepIds: [procedure.id] });
      }
    }
  }

  const evidence = [...evidenceIds]
    .map((id) => chunkById(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const sourceIds = [...new Set(evidence.map((chunk) => chunk.sourceId))];

  return {
    scope: {
      activityAr: "بيع الملابس بالتجزئة",
      municipalityAr: "أمانة عمّان الكبرى",
      legalFormAr: "مؤسسة فردية",
      premisesTenureAr: slots.premisesTenure === "rent" ? "محل مستأجر" : "محل مملوك",
    },
    coverageStatus: demoMode
      ? "demo_only"
      : selected.length > 0
        ? "reviewed"
        : "insufficient_verified_knowledge",
    contentNoticeAr:
      !demoMode
        ? selected.length > 0
          ? "تتضمن الرحلة المحتوى الذي اجتاز بوابة المراجعة فقط."
          : "لا توجد حاليًا قواعد اجتازت المراجعة البشرية لهذه الحالة؛ لن نعرض خطوات رسمية تخمينية."
        : "مثال تجريبي مبني على مقاطع رسمية لم تُراجع بشريًا بعد؛ لا يُعد قائمة متطلبات حكومية معتمدة.",
    steps: selected.map((procedure, index) => ({
      order: index + 1,
      id: procedure.id,
      titleAr: procedure.titleAr,
      authority: procedure.authority,
      scope: procedure.scope,
      actionSteps: procedure.actionSteps,
      dependsOn: procedure.dependsOn,
      requiredDocumentIds: procedure.requiredDocuments.map((document) => document.id),
      evidenceChunkIds: procedure.evidenceChunkIds,
      explanationAr: procedure.explanationAr,
      reviewStatus: procedure.reviewStatus,
    })),
    documents: [...documentMap.values()],
    sources: sourceIds.map((id) => sourceById(id)).filter(Boolean),
    evidence,
    unresolvedRuleIds: unknown.map((procedure) => procedure.id),
    knowledgeVersion: "2026-10-09.demo.1",
  };
}
