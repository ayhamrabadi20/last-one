import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: { sub: "user-a" } as { sub: string } | null, save: vi.fn() }));
vi.mock("@/lib/auth", () => ({ sessionFromRequest: () => mocks.session }));
vi.mock("@/lib/interaction-history", () => ({ saveInteraction: mocks.save }));
import { jsonWithHistory } from "@/lib/api-history";
describe("required history persistence", () => {
  it("returns the result after saving it under the session identity", async () => {
    mocks.save.mockResolvedValueOnce({ saved: true });
    const response = await jsonWithHistory(new Request("http://localhost"), "intake", "goal", { answer: "result" });
    expect((await response.json()).answer).toBe("result");
    expect(mocks.save).toHaveBeenCalledWith({ userId: "user-a", type: "intake", input: "goal", response: { answer: "result" } });
  });
  it("reports storage failure instead of claiming success", async () => {
    mocks.save.mockResolvedValueOnce({ saved: false, reason: "unavailable" });
    const response = await jsonWithHistory(new Request("http://localhost"), "intake", "goal", {});
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("STORAGE_UNAVAILABLE");
  });
  it("rejects saving without an account", async () => {
    mocks.session = null;
    expect((await jsonWithHistory(new Request("http://localhost"), "intake", "goal", {})).status).toBe(401);
    mocks.session = { sub: "user-a" };
  });
});
