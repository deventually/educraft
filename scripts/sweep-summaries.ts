/**
 * Periodic sweep for abandoned tutoring sessions (Phase 7 fallback trigger).
 * Cron-scheduled: it summarises cohort-linked sessions a student left without an
 * explicit close, so mentor insight isn't blind to abandoned conversations.
 *
 * ⚠️ Runs a real model per abandoned session — with a hosted model this costs
 * money. Credentials come from `.env` (via `env.server`); pick the model with
 * `--model`. It hits the app's real database (DATABASE_URL). Run on a schedule:
 *
 *    npm run sweep                                   # default model (Sonnet)
 *    npm run sweep -- --model claude-haiku-4-5       # cheaper Anthropic model
 *    npm run sweep -- --model "ollama::llama3.1:8b"  # local, no key, no data leaves the box
 *    npm run sweep -- --model "compat::glm-4-plus"   # any configured OpenAI-compatible endpoint
 *    npm run sweep -- --idle-minutes 120 --limit 50 --lang nl
 *
 * A configured frontier/self-hosted model uses the `compat::<model>` id plus
 * `OPENAI_COMPAT_BASE_URL` / `OPENAI_COMPAT_API_KEY` in `.env` (see .env.example):
 * this reaches ChatGPT, Gemini, Mistral, GLM, DeepSeek, OpenRouter, vLLM, … — any
 * model that speaks the OpenAI API. Local Ollama/LM Studio and CLI agents need no key.
 *
 * Runs via `vite-node -c scripts/eval.config.ts` (the summariser prompt uses `?raw`,
 * and vite-node loads `.env`). Example crontab (hourly):
 *    0 * * * * cd /app && npm run sweep -- --model claude-haiku-4-5
 */
import type { OutputLanguage } from "~/lib/registry/types";
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL, isResolvableModel, resolveModelInfo } from "~/lib/ai/models";
import { credentialKeyFor } from "~/lib/ai/credentials";
import { env } from "~/server/env.server";
import { sweepAbandonedSessions } from "~/server/insight/sweep.server";

function intFlag(argv: string[], name: string): number | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const n = Number(argv[i + 1]);
  return Number.isFinite(n) ? n : undefined;
}

function stringFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
}

/** Fail fast with a clear message if the chosen model can't run in this env. */
function preflight(model: string): void {
  if (!isResolvableModel(model)) {
    console.error(
      `Unknown model "${model}". Use a catalog id (e.g. claude-haiku-4-5), a local id ` +
        `("ollama::<name>" / "lmstudio::<name>"), or a configured endpoint ("compat::<model>").`,
    );
    process.exit(1);
  }
  const { provider } = resolveModelInfo(model);
  if (provider === "openai-compat" && !env.OPENAI_COMPAT_BASE_URL) {
    console.error(
      `Model "${model}" needs OPENAI_COMPAT_BASE_URL (the endpoint URL) in your .env — see .env.example.`,
    );
    process.exit(1);
  }
  const keyVar = credentialKeyFor(provider);
  if (keyVar && !(env as Record<string, unknown>)[keyVar]) {
    console.error(`Model "${model}" (provider "${provider}") needs ${keyVar} in your .env.`);
    process.exit(1);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const model = stringFlag(argv, "model") ?? DEFAULT_MODEL;
  preflight(model);

  const idleMinutes = intFlag(argv, "idle-minutes");
  const minMessages = intFlag(argv, "min-messages");
  const limit = intFlag(argv, "limit");
  const outputLanguage: OutputLanguage = stringFlag(argv, "lang") === "en" ? "en" : "nl";

  const result = await sweepAbandonedSessions({
    now: new Date(),
    idleMs: idleMinutes != null ? idleMinutes * 60_000 : undefined,
    minMessages,
    limit,
    outputLanguage,
    complete: async ({ system, user }) => {
      const { text } = await providerForModel(model).generate({
        model,
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.2,
        maxTokens: 700,
      });
      return text;
    },
  });

  console.log(
    `Swept ${result.scanned} abandoned session(s) with "${model}": ` +
      `${result.summarised} summarised, ${result.emptied} marked empty.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
