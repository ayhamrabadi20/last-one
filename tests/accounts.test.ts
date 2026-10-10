import { describe, expect, it, vi } from "vitest";
const collection = vi.hoisted(() => ({ createIndex: vi.fn(), insertOne: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() }));
vi.mock("@/lib/mongodb", () => ({ requireDatabase: async () => ({ collection: () => collection }) }));
import { registerAccount, authenticateAccount, createPasswordReset, resetPassword, hashPassword, checkPassword } from "@/lib/accounts";
describe("MongoDB accounts", () => {
  it("salts passwords and rejects incorrect passwords", () => {
    const hash = hashPassword("test-password");
    expect(hash).not.toBe(hashPassword("test-password"));
    expect(checkPassword("test-password", hash)).toBe(true);
    expect(checkPassword("wrong", hash)).toBe(false);
  });
  it("stores only a password hash and handles duplicate database accounts", async () => {
    const user = { name: "Test User", email: "test@example.com", phone: "0791234567", password: "test-password" };
    collection.insertOne.mockResolvedValueOnce({});
    expect(await registerAccount(user)).toBe(true);
    const stored = collection.insertOne.mock.calls[0][0];
    expect(stored.password).toBeUndefined();
    expect(stored.role).toBe("user");
    expect(checkPassword(user.password, stored.passwordHash)).toBe(true);
    collection.insertOne.mockRejectedValueOnce({ code: 11000 });
    expect(await registerAccount(user)).toBe(false);
    collection.insertOne.mockRejectedValueOnce(new Error("unavailable"));
    await expect(registerAccount(user)).rejects.toThrow("unavailable");
  });
  it("authenticates only database accounts", async () => {
    collection.findOne.mockResolvedValue({ email: "test@example.com", passwordHash: hashPassword("test-password") });
    expect(await authenticateAccount("test@example.com", "test-password")).toBeTruthy();
    expect(await authenticateAccount("test@example.com", "wrong")).toBeNull();
    collection.findOne.mockResolvedValue(null);
    expect(await authenticateAccount("demo", "demo1234")).toBeNull();
  });
  it("hashes reset tokens and consumes them with an atomic expiry filter", async () => {
    collection.updateOne.mockResolvedValueOnce({ matchedCount: 1 });
    const token = await createPasswordReset("test@example.com");
    expect(token).toHaveLength(64);
    const issued = collection.updateOne.mock.calls.at(-1)!;
    expect(issued[1].$set.resetHash).not.toBe(token);
    collection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    expect(await resetPassword(token!, "new-password")).toBe(true);
    const consumed = collection.updateOne.mock.calls.at(-1)!;
    expect(consumed[0].resetHash).toBe(issued[1].$set.resetHash);
    expect(consumed[0].resetExpires.$gt).toBeGreaterThan(0);
    expect(consumed[1].$unset).toEqual({ resetHash: "", resetExpires: "" });
    collection.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    expect(await resetPassword(token!, "new-password")).toBe(false);
  });
});
