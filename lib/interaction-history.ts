import { getDatabase, mongoConfigured } from "@/lib/mongodb";
import { createHash } from "node:crypto";

export type InteractionType = "intake" | "journey" | "knowledge_answer" | "exploration";

export type StoredInteraction = {
  id: string;
  userId: string;
  type: InteractionType;
  input: string;
  response: unknown;
  requestKey?: string;
  createdAt: string;
};

function redactSensitive(value: string) {
  return value
    .replace(/\b\d{10}\b/g, "[رقم محجوب]")
    .replace(/(?:\+962|00962|0)?7[789]\d{7}\b/g, "[هاتف محجوب]");
}

export async function saveInteraction(entry: {
  userId: string;
  type: InteractionType;
  input: string;
  response: unknown;
  requestKey?: string;
}) {
  if (!mongoConfigured()) return { saved: false as const, reason: "not_configured" as const };
  try {
    const database = await getDatabase();
    if (!database) return { saved: false as const, reason: "not_configured" as const };
    await database.collection("interactions").createIndex({ userId: 1, createdAt: -1 });
    const interactions=database.collection("interactions");
    await interactions.createIndex({userId:1,requestKey:1},{unique:true,partialFilterExpression:{requestKey:{$type:"string"}}});
    const requestKey=entry.requestKey||createHash("sha256").update(JSON.stringify([entry.type,entry.input.trim()])).digest("hex");
    const filter={userId:entry.userId,requestKey};
    const update={$set:{type:entry.type,response:entry.response,updatedAt:new Date()},$setOnInsert:{userId:entry.userId,requestKey,input:redactSensitive(entry.input).slice(0,1500),createdAt:new Date()}};
    let result;
    try {result=await interactions.findOneAndUpdate(filter,update,{upsert:true,returnDocument:"after"});}
    catch(error){if((error as {code?:number}).code!==11000)throw error;result=await interactions.findOneAndUpdate(filter,update,{returnDocument:"after"});}
    if(!result)throw new Error("History write was not confirmed.");
    return { saved: true as const, id: result._id.toString() };
  } catch {
    return { saved: false as const, reason: "unavailable" as const };
  }
}

export async function listInteractions(userId: string, limit = 30) {
  if (!mongoConfigured()) return { configured: false, available: false, items: [] as StoredInteraction[] };
  try {
    const database = await getDatabase();
    if (!database) return { configured: false, available: false, items: [] as StoredInteraction[] };
    const documents = await database
      .collection("interactions")
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .toArray();
    return {
      configured: true,
      available: true,
      items: documents.map((document) => ({
        id: document._id.toString(),
        userId: String(document.userId),
        type: document.type as InteractionType,
        input: String(document.input),
        response: document.response,
        createdAt: document.createdAt instanceof Date ? document.createdAt.toISOString() : String(document.createdAt),
      })),
    };
  } catch {
    return { configured: true, available: false, items: [] as StoredInteraction[] };
  }
}
