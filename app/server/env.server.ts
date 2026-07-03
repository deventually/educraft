import { z } from "zod";

/**
 * Dev-only fallback for the session-cookie secret. Boot refuses to use it in
 * production (see the guard below), so a forgotten env var fails loudly rather
 * than silently shipping a guessable signing key.
 */
const DEV_SESSION_SECRET = "dev-only-insecure-session-secret-change-me-please";

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
  // Where the drizzle migrations live; overridable for the built/Docker image.
  MIGRATIONS_DIR: z.string().default("./drizzle"),
  // Signs the session cookie. Min 32 chars; a dev default keeps local/test boots
  // frictionless while the production guard below rejects it.
  SESSION_SECRET: z.string().min(32).default(DEV_SESSION_SECRET),
  // Origin used to print absolute invite URLs from the ops script.
  APP_ORIGIN: z.string().default("http://localhost:5173"),
  // Abuse limits for the streaming endpoint (in-memory, per client key).
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(10),
  RATE_LIMIT_CONCURRENT: z.coerce.number().default(3),
});

export const env = schema.parse(process.env);

// Refuse to boot in production with the guessable dev signing key.
if (process.env.NODE_ENV === "production" && env.SESSION_SECRET === DEV_SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET must be set to a strong (32+ char) value in production; the dev default is not allowed.",
  );
}

/** Filesystem path to the SQLite database (strips a leading file: scheme). */
export const DB_PATH = env.DATABASE_URL.replace(/^file:/, "");
