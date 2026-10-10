import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { requireDatabase } from "@/lib/mongodb";

export type Account = { email: string; username?: string; name: string; phone: string; role?: "user" | "admin"; status?: "active" | "suspended" | "banned" | "deleted"; protectedAdmin?: boolean; sessionVersion?: number; theme?: "light" | "dark" | "system"; passwordHash: string; createdAt: Date; resetHash?: string; resetExpires?: number };

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
async function accounts() {
  const users = (await requireDatabase()).collection<Account>("accounts");
  await users.createIndex({ email: 1 }, { unique: true });
  return users;
}
export async function registerAccount(data: { email: string; name: string; phone: string; password: string }) {
  const users = await accounts();
  try {
    await users.insertOne({ email: data.email, name: data.name, phone: data.phone, role: "user", status: "active", sessionVersion: 0, passwordHash: hashPassword(data.password), createdAt: new Date() });
    return true;
  } catch (error) { if ((error as { code?: number }).code === 11000) return false; throw error; }
}
export async function authenticateAccount(identity: string, password: string) {
  const user = await (await accounts()).findOne({ $or: [{ email: identity }, { username: identity }] });
  return user && (!user.status || user.status === "active") && checkPassword(password, user.passwordHash) ? user : null;
}
export async function createPasswordReset(email: string) {
  const token = randomBytes(32).toString("hex");
  const resetHash = createHash("sha256").update(token).digest("hex");
  const result = await (await accounts()).updateOne({ email }, { $set: { resetHash, resetExpires: Date.now() + 30 * 60_000 } });
  return result.matchedCount ? token : null;
}
export async function resetPassword(token: string, password: string) {
  const resetHash = createHash("sha256").update(token).digest("hex");
  const result = await (await accounts()).updateOne({ resetHash, resetExpires: { $gt: Date.now() }, status: { $nin: ["banned", "suspended", "deleted"] } }, { $set: { passwordHash: hashPassword(password) }, $inc: { sessionVersion: 1 }, $unset: { resetHash: "", resetExpires: "" } });
  return result.modifiedCount > 0;
}
