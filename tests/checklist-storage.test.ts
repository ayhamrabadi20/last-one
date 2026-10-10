import { describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ createIndex: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() }));
const auth = vi.hoisted(() => ({ session: { sub: "user-a" } as { sub: string } | null }));
vi.mock("@/lib/mongodb", () => ({ requireDatabase: async () => ({ collection: () => db }) }));
vi.mock("@/lib/auth", () => ({ sessionFromRequest: () => auth.session }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ allowed: true }), requestKey: () => "test" }));
import { GET, PUT } from "@/app/api/checklist/route";
describe("database checklist ownership", () => {
  it("loads only the signed-in user's checklist", async () => {
    db.findOne.mockResolvedValue({ knowledgeVersion: "v1", checkedIds: ["doc-a"] });
    const response = await GET(new Request("http://localhost/api/checklist?key=journey-a"));
    expect(response.status).toBe(200);
    expect(db.findOne).toHaveBeenCalledWith({ userId: "user-a", key: "journey-a" });
  });
  it("saves using the session identity instead of a client-supplied user", async () => {
    const response = await PUT(new Request("http://localhost/api/checklist", { method: "PUT", body: JSON.stringify({ userId: "user-b", key: "journey-a", knowledgeVersion: "v1", checkedIds: ["doc-a", "doc-a"] }) }));
    expect(response.status).toBe(200);
    const [filter, update] = db.updateOne.mock.calls.at(-1)!;
    expect(filter).toEqual({ userId: "user-a", key: "journey-a" });
    expect(update.$set.checkedIds).toEqual(["doc-a"]);
    expect(update.$set.userId).toBeUndefined();
  });
  it("reports database failures and rejects anonymous access", async () => {
    db.findOne.mockRejectedValueOnce(new Error("unavailable"));
    expect((await GET(new Request("http://localhost/api/checklist?key=a"))).status).toBe(503);
    auth.session = null;
    expect((await GET(new Request("http://localhost/api/checklist?key=a"))).status).toBe(401);
    expect((await PUT(new Request("http://localhost/api/checklist", { method: "PUT" }))).status).toBe(401);
    auth.session = { sub: "user-a" };
  });
});
