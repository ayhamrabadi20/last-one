import { MongoClient } from "mongodb";
import { randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || "lifeevent_ai");
  const users = db.collection("accounts");
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ username: 1 }, { unique: true, sparse: true });
  const username = (process.env.DEMO_USERNAME?.trim() || "demo").toLowerCase();
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync(process.env.DEMO_PASSWORD || "demo1234", salt, 64).toString("hex")}`;
  const result = await users.updateOne({ username }, { $setOnInsert: {
    username, email: `${username}@lifeevent.local`, name: "حساب العرض", phone: "", passwordHash, createdAt: new Date(),
  } }, { upsert: true });
  let imported = 0;
  let localAccounts = [];
  try { localAccounts = JSON.parse(await readFile(new URL("../.local-data/accounts.json", import.meta.url), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const account of localAccounts) {
    const migrated = await users.updateOne({ email: account.email }, { $setOnInsert: { ...account, createdAt: new Date() } }, { upsert: true });
    imported += migrated.upsertedCount;
  }
  await db.collection("checklists").createIndex({ userId: 1, key: 1 }, { unique: true });
  await db.collection("interactions").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("support_tickets").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  console.log(JSON.stringify({ connected: true, demoUsername: username, demoCreated: result.upsertedCount > 0, importedLocalAccounts: imported, accounts: await users.countDocuments() }));
} finally { await client.close(); }
