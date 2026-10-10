import { describe, expect, it } from "vitest";
import { chunks, demoProcedures, sources } from "@/lib/knowledge";
import { validateProcedureGraph } from "@/lib/rules";

describe("knowledge integrity", () => {
  it("links every chunk to a known source", () => {
    const sourceIds = new Set(sources.map((source) => source.id));
    expect(chunks.filter((chunk) => !sourceIds.has(chunk.sourceId))).toEqual([]);
  });

  it("links every procedure and document claim to an existing evidence chunk", () => {
    const chunkIds = new Set(chunks.map((chunk) => chunk.id));
    const missing = demoProcedures.flatMap((procedure) => [
      ...procedure.evidenceChunkIds,
      ...procedure.requiredDocuments.flatMap((document) => document.evidenceChunkIds),
    ]).filter((id) => !chunkIds.has(id));
    expect(missing).toEqual([]);
  });

  it("keeps the demo dependency graph valid", () => {
    expect(() => validateProcedureGraph(demoProcedures)).not.toThrow();
  });

  it("does not mark collected government sources as human-reviewed", () => {
    expect(sources.every((source) => source.reviewStatus === "pending" && source.contentReviewedAt === null)).toBe(true);
  });
});
