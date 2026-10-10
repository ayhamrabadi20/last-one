import { z } from "zod";

export const activityIdSchema = z.enum(["clothing-retail", "other"]);
export const municipalityIdSchema = z.enum(["amman", "other"]);
export const legalFormSchema = z.enum(["sole-proprietorship", "company", "other"]);
export const premisesTenureSchema = z.enum(["rent", "own", "unknown"]);

export const slotsSchema = z.object({
  activityId: activityIdSchema.nullable().optional(),
  municipalityId: municipalityIdSchema.nullable().optional(),
  legalForm: legalFormSchema.nullable().optional(),
  premisesTenure: premisesTenureSchema.nullable().optional(),
});

export type Slots = z.infer<typeof slotsSchema>;
export type SlotKey = keyof Slots;

export const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(1500),
});

export const intakeRequestSchema = z.object({
  goal: z.string().trim().min(1).max(1000),
  slots: slotsSchema.default({}),
  history: z.array(historyMessageSchema).max(6).default([]),
});

export const completeSlotsSchema = z.object({
  activityId: z.literal("clothing-retail"),
  municipalityId: z.literal("amman"),
  legalForm: z.literal("sole-proprietorship"),
  premisesTenure: z.enum(["rent", "own"]),
});

export type CompleteSlots = z.infer<typeof completeSlotsSchema>;

export const journeyRequestSchema = z.object({
  slots: slotsSchema,
});

export const answerRequestSchema = z.object({
  question: z.string().trim().min(1).max(1500),
  slots: slotsSchema,
  procedureId: z.string().trim().max(100).optional(),
});

export const extractionOutputSchema = z.object({
  activityId: activityIdSchema.nullable(),
  municipalityId: municipalityIdSchema.nullable(),
  legalForm: legalFormSchema.nullable(),
  premisesTenure: premisesTenureSchema.nullable(),
});

export const requestIntentOutputSchema = z.object({
  intent: z.enum(["business_journey", "knowledge_question", "unsupported_service", "unclear"]),
});

export const answerOutputSchema = z.object({
  status: z.enum(["answered", "insufficient_evidence"]),
  answer: z.string().max(4000),
  claims: z.array(
    z.object({
      text: z.string().min(1).max(1000),
      evidenceChunkIds: z.array(z.string()).min(1).max(5),
    }),
  ).max(4),
});

export type GroundedAnswer = z.infer<typeof answerOutputSchema>;

export const apiError = (
  code: string,
  messageAr: string,
  retryable = false,
) => ({ error: { code, messageAr, retryable } });
