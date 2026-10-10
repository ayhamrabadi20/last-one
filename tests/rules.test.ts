import { describe, expect, it } from "vitest";
import { buildJourney, evaluateCondition, topologicalSort } from "@/lib/rules";
import type { Procedure } from "@/lib/knowledge";

const base = (id: string, dependsOn: string[] = []): Procedure => ({
  id,
  titleAr: id,
  authority: "test",
  scope: "test",
  conditions: { op: "equals", field: "enabled", value: "yes" },
  dependsOn,
  requiredDocuments: [],
  actionSteps: [],
  evidenceChunkIds: [],
  reviewStatus: "reviewed",
  explanationAr: "test",
});

describe("rule evaluation", () => {
  it("distinguishes true, false, and unknown", () => {
    const condition = { op: "equals", field: "tenure", value: "rent" } as const;
    expect(evaluateCondition(condition, { tenure: "rent" })).toBe("true");
    expect(evaluateCondition(condition, { tenure: "own" })).toBe("false");
    expect(evaluateCondition(condition, {})).toBe("unknown");
  });

  it("handles all and any without treating unknown as false", () => {
    expect(evaluateCondition({ op: "all", conditions: [
      { op: "equals", field: "a", value: "1" },
      { op: "equals", field: "b", value: "2" },
    ] }, { a: "1" })).toBe("unknown");
    expect(evaluateCondition({ op: "any", conditions: [
      { op: "equals", field: "a", value: "1" },
      { op: "equals", field: "b", value: "2" },
    ] }, { a: "0" })).toBe("unknown");
  });
});

describe("procedure graph", () => {
  it("orders dependencies", () => {
    expect(topologicalSort([base("license", ["register"]), base("register")]).map((item) => item.id))
      .toEqual(["register", "license"]);
  });

  it("rejects cycles", () => {
    expect(() => topologicalSort([base("a", ["b"]), base("b", ["a"])])).toThrow("CYCLIC_DEPENDENCY");
  });

  it("rejects missing references", () => {
    expect(() => topologicalSort([base("a", ["missing"])])).toThrow("MISSING_DEPENDENCY");
  });
});

describe("journey branching", () => {
  it("changes premises evidence between rent and ownership", () => {
    process.env.KNOWLEDGE_MODE = "demo";
    const common = { activityId: "clothing-retail", municipalityId: "amman", legalForm: "sole-proprietorship" } as const;
    const rent = buildJourney({ ...common, premisesTenure: "rent" });
    const own = buildJourney({ ...common, premisesTenure: "own" });
    expect(rent.documents.map((item) => item.id)).toContain("certified-lease-contract");
    expect(rent.documents.map((item) => item.id)).not.toContain("property-registration-copy");
    expect(own.documents.map((item) => item.id)).toContain("property-registration-copy");
    expect(own.documents.map((item) => item.id)).not.toContain("certified-lease-contract");
  });

  it("reports a verified-knowledge gap instead of claiming an empty production journey is reviewed", () => {
    process.env.KNOWLEDGE_MODE = "production";
    const journey = buildJourney({
      activityId: "clothing-retail",
      municipalityId: "amman",
      legalForm: "sole-proprietorship",
      premisesTenure: "rent",
    });
    expect(journey.steps).toEqual([]);
    expect(journey.coverageStatus).toBe("insufficient_verified_knowledge");
    process.env.KNOWLEDGE_MODE = "demo";
  });
});
