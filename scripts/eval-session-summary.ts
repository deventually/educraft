/**
 * Session-summary de-personalisation eval (Phase 7, owner-run — NOT in CI).
 *
 * The unit test `tests/lib/summary-parse.test.ts` pins the *contract* (the
 * post-processor rejects quotes/disclosure). This eval checks the *live model*:
 * it builds the real `session-summary` prompt, calls Anthropic on transcripts
 * that deliberately carry a personal disclosure + quotable phrases, and asserts
 * the returned summary parses AND passes the leakage guard. A leak fails the run.
 *
 * ⚠️ Calls a real Anthropic API — costs money, needs ANTHROPIC_API_KEY. Run by hand:
 *
 *    ANTHROPIC_API_KEY=sk-… npm run eval:summary
 *
 * Runs via `vite-node -c scripts/eval.config.ts` (the prompt files use `?raw`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OutputLanguage } from "~/lib/registry/types";
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { buildSummarySystemPrompt } from "~/lib/insight/summarise";
import { parseSessionSummary, checkLeakage } from "~/lib/insight/summary";

interface Case {
  id: string;
  description?: string;
  outputLanguage: OutputLanguage;
  transcript: string;
}

const CASES_PATH = join(process.cwd(), "evals", "session-summary", "cases.json");

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY to run the session-summary eval.");
    process.exit(1);
  }
  const { cases } = JSON.parse(readFileSync(CASES_PATH, "utf8")) as { cases: Case[] };
  let failures = 0;

  for (const c of cases) {
    const system = buildSummarySystemPrompt(c.transcript, c.outputLanguage);
    const trigger =
      c.outputLanguage === "en"
        ? "Produce the summary as a single JSON object."
        : "Geef de samenvatting als één JSON-object.";
    const { text } = await providerForModel(DEFAULT_MODEL).generate({
      model: DEFAULT_MODEL,
      system,
      messages: [{ role: "user", content: trigger }],
      temperature: 0.2,
      maxTokens: 700,
    });

    const summary = parseSessionSummary(text);
    if (!summary) {
      failures++;
      console.error(`✗ ${c.id}: model output did not parse as a valid summary`);
      console.error(`   raw: ${text.slice(0, 200)}…`);
      continue;
    }
    const leak = checkLeakage(summary, c.transcript);
    if (!leak.ok) {
      failures++;
      console.error(`✗ ${c.id}: DE-PERSONALISATION LEAK (${leak.reason})`);
      console.error(`   summary: ${JSON.stringify(summary)}`);
      continue;
    }
    console.log(`✓ ${c.id}: clean, de-personalised — ${JSON.stringify(summary)}`);
  }

  console.log(`\n${cases.length - failures}/${cases.length} cases passed.`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
