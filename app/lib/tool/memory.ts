import { z } from "zod";
import { SandboxMemorySchema } from "~/lib/hooks/useSandbox";

/**
 * What each tool workspace keeps for Back and Forward (`useEntryMemory`), checked when it
 * comes back, so a stale or changed shape is simply not restored.
 */
const OutputLanguageSchema = z.enum(["nl", "en"]);

/** One-shot (`GeneratorView`): the form, the result, and the code table of anonymised names. */
export const GeneratorMemorySchema = z.object({
  sandbox: SandboxMemorySchema,
  output: z.string(),
  generationId: z.string().nullable(),
  outputLanguage: OutputLanguageSchema,
  model: z.string(),
  codes: z.record(z.string(), z.string()).nullable(),
  sentRedacted: z.record(z.string(), z.object({ from: z.string(), to: z.string() })),
});

/** Multi-stage (`StageStepper`): the form and each finished step. */
export const StagesMemorySchema = z.object({
  sandbox: SandboxMemorySchema,
  outputs: z.record(z.string(), z.string()),
  lastGenerationId: z.string().nullable(),
  savedIds: z.record(z.string(), z.string()),
  outputLanguage: OutputLanguageSchema,
  model: z.string(),
});

/** Chat (`ChatView`): the setup and the conversation, which goes on in the same saved chat. */
export const ChatMemorySchema = z.object({
  sandbox: SandboxMemorySchema,
  submitted: z.boolean(),
  outputLanguage: OutputLanguageSchema,
  model: z.string(),
  chat: z.object({
    sessionId: z.string(),
    savedId: z.string().nullable(),
    turns: z.array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        id: z.string(),
        interrupted: z.boolean().optional(),
      }),
    ),
  }),
});
