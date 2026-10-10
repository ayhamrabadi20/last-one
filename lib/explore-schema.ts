import { z } from "zod";

export const exploreRequestSchema = z.object({
  goal: z.string().trim().min(3).max(1000),
});

export const explorationProfileSchema = z.object({
  activityAr: z.string().trim().min(1).max(120),
  locationAr: z.string().trim().min(1).max(120).nullable(),
  category: z.enum(["food", "retail", "services", "digital", "manufacturing", "other"]),
  businessModel: z.enum(["physical", "online", "mixed", "unknown"]),
  premisesTenure: z.enum(["rent", "own", "unknown"]),
});

export type ExplorationProfile = z.infer<typeof explorationProfileSchema>;
