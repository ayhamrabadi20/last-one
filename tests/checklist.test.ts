import { describe, expect, it } from "vitest";
import { progressPercent, retainSharedChecks, stateFingerprint } from "@/lib/checklist";

describe("local checklist", () => {
  it("retains only shared document ids after changing state", () => {
    expect(retainSharedChecks(["lease", "occupancy"], ["ownership", "occupancy"]))
      .toEqual(["occupancy"]);
  });

  it("calculates preparation progress, not official approval", () => {
    expect(progressPercent(["one"], ["one", "two"])).toBe(50);
  });

  it("creates a stable fingerprint independent of key order", () => {
    expect(stateFingerprint({ b: "2", a: "1" })).toBe(stateFingerprint({ a: "1", b: "2" }));
  });
});
