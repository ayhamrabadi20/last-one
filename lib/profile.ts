import { requireDatabase } from "@/lib/mongodb";
import type { Account } from "@/lib/accounts";
export type PublicProfile = { name: string; email: string; phone: string; username?: string; role: "user" | "admin"; createdAt: string | null };
export async function getProfile(identity: string): Promise<PublicProfile | null> {
  const user = await (await requireDatabase()).collection<Account>("accounts").findOne({ $or: [{ email: identity }, { username: identity }] }, { projection: { name: 1, email: 1, phone: 1, username: 1, role: 1, createdAt: 1 } });
  if (!user) return null;
  return { name: user.name, email: user.email, phone: user.phone, username: user.username, role: user.role === "admin" ? "admin" : "user", createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : null };
}
