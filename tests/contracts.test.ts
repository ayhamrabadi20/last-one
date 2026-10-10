import { describe, expect, it, vi } from "vitest";
// Contract cases run as an authenticated user with successful persistence.
vi.mock("@/lib/auth", () => ({ sessionFromRequest: () => ({ sub: "contract-user" }) }));
vi.mock("@/lib/interaction-history", () => ({ saveInteraction: async () => ({ saved: true }) }));
import { POST as buildJourneyRoute } from "@/app/api/journey/route";
import { POST as answerRoute } from "@/app/api/answer/route";
import { POST as intakeRoute } from "@/app/api/intake/route";
import { answerOutputSchema, intakeRequestSchema } from "@/lib/schemas";
import { validateGrounding } from "@/lib/ai/service";
import { chunks } from "@/lib/knowledge";

describe("API contracts", () => {
  it("rejects overly long goals", () => {
    expect(intakeRequestSchema.safeParse({ goal: "س".repeat(1001), slots: {}, history: [] }).success).toBe(false);
  });

  it("rejects unknown enum values", () => {
    expect(intakeRequestSchema.safeParse({ goal: "مشروع", slots: { municipalityId: "irbid" }, history: [] }).success).toBe(false);
  });

  it("does not generalize Amman journey to another municipality", async () => {
    const response = await buildJourneyRoute(new Request("http://localhost/api/journey", {
      method: "POST",
      body: JSON.stringify({ slots: {
        activityId: "clothing-retail",
        municipalityId: "other",
        legalForm: "sole-proprietorship",
        premisesTenure: "rent",
      } }),
    }));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("OUT_OF_SCOPE");
  });

  it("does not answer a restaurant question with clothing evidence", async () => {
    const response = await answerRoute(new Request("http://localhost/api/answer", {
      method: "POST",
      body: JSON.stringify({ question: "شو متطلبات فتح مطعم في عمان؟", slots: {} }),
    }));
    const body = await response.json();
    expect(body.status).toBe("insufficient_evidence");
    expect(body.aiMode).toBe("not_called");
    expect(body.citations).toEqual([]);
    expect(body.answer).toContain("لن أجيب بمتطلبات محل الملابس");
  });

  it("recognizes a laundry as a different activity instead of assuming clothing", async () => {
    const response = await answerRoute(new Request("http://localhost/api/answer", {
      method: "POST",
      body: JSON.stringify({ question: "شو متطلبات فتح مغسلة؟", slots: {} }),
    }));
    const body = await response.json();
    expect(body.status).toBe("insufficient_evidence");
    expect(body.aiMode).toBe("not_called");
    expect(body.citations).toEqual([]);
    expect(body.answer).toContain("لن أجيب بمتطلبات محل الملابس");
  });

  it("does not inherit clothing context when a journey question introduces a new goal", async () => {
    const response = await answerRoute(new Request("http://localhost/api/answer", {
      method: "POST",
      body: JSON.stringify({
        question: "شو متطلبات فتح مغسلة؟",
        slots: { activityId: "clothing-retail", municipalityId: "amman", legalForm: "sole-proprietorship", premisesTenure: "rent" },
      }),
    }));
    const body = await response.json();
    expect(body.aiMode).toBe("not_called");
    expect(body.citations).toEqual([]);
    expect(body.answer).toContain("لن أجيب بمتطلبات محل الملابس");
  });

  it("routes a knowledge phrase to RAG without requiring question wording", async () => {
    const response = await intakeRoute(new Request("http://localhost/api/intake", {
      method: "POST",
      body: JSON.stringify({ goal: "عقد الايجار المصدق", slots: {}, history: [] }),
    }));
    const body = await response.json();
    expect(body.requestIntent).toBe("knowledge_question");
    expect(body.coverageStatus).toBe("route_to_knowledge");
    expect(body.aiMode).toBe("rules");
  });

  it("does not route unrelated text into RAG", async () => {
    const response = await intakeRoute(new Request("http://localhost/api/intake", {
      method: "POST",
      body: JSON.stringify({ goal: "وصفة كيك بالشوكولاتة", slots: {}, history: [] }),
    }));
    const body = await response.json();
    expect(body.requestIntent).toBe("unclear");
    expect(body.coverageStatus).toBe("needs_intent_clarification");
  });

  it("answers a short knowledge phrase extractively without requiring question syntax", async () => {
    const response = await answerRoute(new Request("http://localhost/api/answer", {
      method: "POST",
      body: JSON.stringify({ question: "عقد الاجيار المصدق", slots: {} }),
    }));
    const body = await response.json();
    expect(body.status).toBe("answered");
    expect(body.aiMode).toBe("extractive");
    expect(body.citations[0].chunk.id).toBe("gam-tenure-documents");
    expect(body.answer).toContain("عقد إيجار مصدق");
  });
});

describe("AI output validation", () => {
  it("requires evidence for every answered claim", () => {
    expect(answerOutputSchema.safeParse({ status: "answered", answer: "نص", claims: [{ text: "ادعاء", evidenceChunkIds: [] }] }).success).toBe(false);
  });

  it("rejects citations that were not retrieved", () => {
    const valid = answerOutputSchema.parse({
      status: "answered",
      answer: "إجابة",
      claims: [{ text: "ادعاء", evidenceChunkIds: ["invented-id"] }],
    });
    expect(() => validateGrounding(valid, [chunks[0]])).toThrow("استشهادًا غير موجود");
  });

  it("publishes validated claims instead of an unverified free-form answer", () => {
    const chunk = chunks.find((item) => item.id === "gam-tenure-documents")!;
    const result = validateGrounding({
      status: "answered",
      answer: "راجع رابطًا غير موجود: https://invented.example.com",
      claims: [{ text: "عقد إيجار مصدق في حال الموقع مستأجر.", evidenceChunkIds: [chunk.id] }],
    }, [chunk]);
    expect(result.answer).toBe("عقد إيجار مصدق في حال الموقع مستأجر.");
    expect(result.answer).not.toContain("invented");
  });

  it("rejects an invented URL inside a cited claim", () => {
    const chunk = chunks.find((item) => item.id === "mit-sanad-access")!;
    expect(() => validateGrounding({
      status: "answered",
      answer: "رابط التسجيل",
      claims: [{ text: "التسجيل عبر https://invented.gov.sa باستخدام تطبيق سند.", evidenceChunkIds: [chunk.id] }],
    }, [chunk])).toThrow("لا يمكن التحقق");
  });

  it("rejects a claim that only repeats the user phrase", () => {
    const chunk = chunks.find((item) => item.id === "gam-tenure-documents")!;
    expect(() => validateGrounding({
      status: "answered",
      answer: "إجابة",
      claims: [{ text: "عقد الإيجار المصدق", evidenceChunkIds: [chunk.id] }],
    }, [chunk], "عقد الإيجار المصدق")).toThrow("لا يمكن التحقق");
  });
});
