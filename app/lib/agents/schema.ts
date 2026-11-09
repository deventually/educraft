import { z } from "zod";
import { SEVERITIES } from "./types";

/** Caps on what one hat may return (UI and storage bounds). */
export const AGENT_LIMITS = {
  findings: 15,
  message: 600,
  suggestion: 600,
} as const;

/** One finding as the model writes it: `target` is a short key (L1, A2, T1). */
const RawAgentFindingSchema = z.object({
  severity: z.enum(SEVERITIES),
  target: z.string().max(10).nullish(),
  message: z.string(),
  suggestion: z.string().nullish(),
});

/** The model's whole answer: `{ "findings": [...] }`. */
export const RawAgentReviewSchema = z.object({
  findings: z.array(RawAgentFindingSchema),
});
