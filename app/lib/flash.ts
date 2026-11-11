import { z } from "zod";

/**
 * Flash toasts across a redirect (P16). A redirecting action names one of these
 * keys; the root loader hands it to the client once, which shows the message
 * (`toast.flash.<key>`) as a success toast. Only a key travels in the cookie, so
 * the server stays locale-neutral and no free text can be injected.
 */
export const FLASH_KEYS = [
  "accountDeleted",
  "dossierCreated",
  "passwordReset",
  "rubricDeleted",
  "rubricDuplicated",
  "signedIn",
  "signedOut",
  "signedOutEverywhere",
  "steppedDown",
  "teamDeleted",
  "userDeleted",
  "welcome",
] as const;

export type FlashKey = (typeof FLASH_KEYS)[number];

/** `id` is unique per flash, so the same message twice in a row toasts twice. */
export const FlashSchema = z.object({
  key: z.enum(FLASH_KEYS),
  id: z.string().min(1).max(64),
});

export type Flash = z.infer<typeof FlashSchema>;
