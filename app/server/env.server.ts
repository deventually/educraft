import { z } from "zod";

/**
 * Dev-only fallback for the session-cookie secret. Boot refuses to use it in
 * production (see the guard below), so a forgotten env var fails loudly rather
 * than silently shipping a guessable signing key.
 */
const DEV_SESSION_SECRET = "dev-only-insecure-session-secret-change-me-please";

export const envSchema = z.object({
  // Optional at boot so the app can run/browse without a key; the Anthropic
  // adapter throws a friendly error only when a generation is actually requested.
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  // An own OpenAI-compatible endpoint (provider "openai-compat" in config/models.json;
  // also `compat::<model>` ids). The key is optional (a self-hosted endpoint may need
  // none). Other providers' keys are read by name through `providerSetting` below.
  OPENAI_COMPAT_BASE_URL: z.string().optional(),
  OPENAI_COMPAT_API_KEY: z.string().optional(),
  // Local OpenAI-compatible servers (no API key needed).
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434/v1"),
  LMSTUDIO_BASE_URL: z.string().default("http://localhost:1234/v1"),
  // Ollama's context window in tokens (see adapters/ollama.ts). Optional: the adapter
  // has a default that fits a long document; lower it on a machine with little memory.
  OLLAMA_NUM_CTX: z.coerce.number().int().min(2048).optional(),
  DATABASE_URL: z.string().default("file:./data/limeonit.db"),
  // Where the daily backup goes (backup.server). Unset: `backups/` next to the database in
  // production, off elsewhere. "off" turns it off. Read at call time by backupDir().
  BACKUP_DIR: z.string().optional(),
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
  // Per-user daily quotas (persisted, see repositories/usage.server). Admins are
  // exempt. The token limit is only enforced once the adapter surfaces usage.
  DAILY_REQUEST_LIMIT: z.coerce.number().default(50),
  DAILY_OUTPUT_TOKEN_LIMIT: z.coerce.number().default(200_000),
});

export const env = envSchema.parse(process.env);

// Refuse to boot in production with the guessable dev signing key.
if (process.env.NODE_ENV === "production" && env.SESSION_SECRET === DEV_SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET must be set to a strong (32+ char) value in production; the dev default is not allowed.",
  );
}

/** Filesystem path to the SQLite database (strips a leading file: scheme). */
export const DB_PATH = env.DATABASE_URL.replace(/^file:/, "");

/**
 * CLI agents and local (Ollama/LM Studio) models exist only in development: a
 * production process (`npm start`, the Docker image) has no business running
 * commands or probing localhost. Read at call time, so `vi.stubEnv` works.
 */
export function localModelsEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * A provider's server setting by name, as `config/models.json` names it (`keyEnv`,
 * `baseURLEnv`). Only `*_API_KEY` and `*_BASE_URL` names are read, so the config can
 * never point at another secret (the session key, the database). Read at call time.
 */
export function providerSetting(name: string): string | undefined {
  if (!/^[A-Z][A-Z0-9_]*_(API_KEY|BASE_URL)$/.test(name)) return undefined;
  const value = process.env[name];
  return value ? value : undefined;
}
