import { z } from "zod";

const schema = z.object({
  // Optional at boot so the app can run/browse without a key; the Anthropic
  // adapter throws a friendly error only when a generation is actually requested.
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  // Local OpenAI-compatible servers (no API key needed).
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434/v1"),
  LMSTUDIO_BASE_URL: z.string().default("http://localhost:1234/v1"),
  DATABASE_URL: z.string().default("file:./data/limeonit.db"),
});

export const env = schema.parse(process.env);

/** Filesystem path to the SQLite database (strips a leading file: scheme). */
export const DB_PATH = env.DATABASE_URL.replace(/^file:/, "");
