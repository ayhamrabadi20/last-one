import { NextResponse } from "next/server";
import { activeChunks, sources } from "@/lib/knowledge";

export async function GET() {
  return NextResponse.json({
    sources,
    chunks: activeChunks(),
    knowledgeMode: process.env.KNOWLEDGE_MODE === "production" ? "production" : "demo",
  });
}
