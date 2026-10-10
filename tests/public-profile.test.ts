import { describe, expect, it, vi } from "vitest";
const findOne = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mongodb", () => ({ requireDatabase: async () => ({collection:()=>({findOne})}) }));
import { getProfile } from "@/lib/profile";
describe("safe public profile", () => {
  it("does not serialize passwords or recovery secrets even if the database returns them", async () => {
    findOne.mockResolvedValue({name:"Owner",email:"owner@example.com",phone:"0791234567",passwordHash:"private-hash",resetHash:"private-token",createdAt:new Date()});
    const result=await getProfile("owner@example.com");
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result?.name).toBe("Owner");
    expect(findOne.mock.calls[0][1].projection.passwordHash).toBeUndefined();
  });
});
