import { z } from "zod";

/** Boundary limits for an assessment model. */
export const ASSESSMENT_MODEL_LIMITS = {
  name: 120,
  documentTypes: 20,
  documentType: 60,
  framework: 30_000,
  scale: 5_000,
} as const;

/**
 * What an assessment model holds: the document types it is meant for, the framework with its
 * success criteria (required: without it the AI would invent the norm) and the grading scale
 * with its pass rules (optional: empty means feedback only, no judgement).
 */
export const AssessmentModelDataSchema = z
  .object({
    documentTypes: z
      .array(z.string().min(1).max(ASSESSMENT_MODEL_LIMITS.documentType))
      .max(ASSESSMENT_MODEL_LIMITS.documentTypes),
    framework: z
      .string()
      .max(ASSESSMENT_MODEL_LIMITS.framework)
      .refine((s) => s.trim() !== ""),
    scale: z.string().max(ASSESSMENT_MODEL_LIMITS.scale),
  })
  .strict();

export type AssessmentModelData = z.infer<typeof AssessmentModelDataSchema>;
