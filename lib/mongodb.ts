import { MongoClient, type Db } from "mongodb";

declare global {
  var __lifeEventMongoPromise: Promise<MongoClient> | undefined;
}

export function mongoConfigured() {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export async function requireDatabase(): Promise<Db> {
  const database = await getDatabase();
  if (!database) throw new Error("MongoDB is required for persistent storage.");
  return database;
}

export async function getDatabase(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return null;

  if (!global.__lifeEventMongoPromise) {
    const client = new MongoClient(uri, {
      connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS ?? 2500),
      serverSelectionTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS ?? 2500),
      maxPoolSize: 5,
    });
    global.__lifeEventMongoPromise = client.connect().catch((error) => {
      global.__lifeEventMongoPromise = undefined;
      throw error;
    });
  }

  const client = await global.__lifeEventMongoPromise;
  return client.db(process.env.MONGODB_DB_NAME?.trim() || "lifeevent_ai");
}
