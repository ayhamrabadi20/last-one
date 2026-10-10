import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth";

describe("local signed session", () => {
  it("accepts a valid signed token", () => {
    expect(verifySessionToken(createSessionToken("demo"))?.sub).toBe("demo");
  });

  it("rejects a modified token", () => {
    const token = createSessionToken("demo");
    expect(verifySessionToken(`${token}changed`)).toBeNull();
  });
});
