import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import { requireDatabase } from "@/lib/mongodb";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "lifeevent_session";
const SESSION_SECONDS = 60 * 60 * 8;

type SessionPayload = { sub: string; exp: number; accountId?: string; version?: number; nonce?: string };

function authSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be configured in production.");
  }
  return "lifeevent-local-demo-only-change-me";
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

export function createSessionToken(username: string, accountId?: string, version = 0) {
  const payload: SessionPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    accountId, version, nonce: randomBytes(16).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function requestToken(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];
  return token;
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function createAccountSession(identity: string) {
  const db = await requireDatabase();
  const account = await db.collection("accounts").findOne({ $or: [{ email: identity }, { username: identity }] }, { projection: { sessionVersion: 1, status: 1 } });
  if (!account || (account.status && account.status !== "active")) throw new Error("Account is unavailable.");
  const token = createSessionToken(identity, account._id.toString(), account.sessionVersion || 0);
  const sessions = db.collection("sessions");
  await sessions.createIndex({ tokenHash: 1 }, { unique: true });
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await sessions.insertOne({ tokenHash: tokenHash(token), accountId: account._id.toString(), userId: identity, createdAt: new Date(), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
  return token;
}
async function validateStoredSession(token?: string): Promise<SessionPayload | null> {
  const payload = verifySessionToken(token);
  if (!payload?.accountId || !ObjectId.isValid(payload.accountId) || !token) return null;
  // Fail closed on unavailable storage; a valid signature alone cannot grant access.
  try {
    const db = await requireDatabase();
    const [account, stored] = await Promise.all([
      db.collection("accounts").findOne({ _id: new ObjectId(payload.accountId) }, { projection: { status: 1, sessionVersion: 1, email: 1, username: 1 } }),
      db.collection("sessions").findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } }),
    ]);
    if (!stored || !account || (account.status && account.status !== "active") || (account.sessionVersion || 0) !== (payload.version || 0) || (account.username || account.email) !== payload.sub) return null;
    return payload;
  } catch { return null; }
}
export async function sessionFromRequest(request: Request) { return validateStoredSession(requestToken(request)); }
export async function revokeRequestSession(request: Request) {
  const token = requestToken(request);
  if (token) await (await requireDatabase()).collection("sessions").deleteOne({ tokenHash: tokenHash(token) });
}

export async function currentSession() {
  const store = await cookies();
  return validateStoredSession(store.get(SESSION_COOKIE)?.value);
}

export async function requirePageSession() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return session;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_SECONDS,
};
