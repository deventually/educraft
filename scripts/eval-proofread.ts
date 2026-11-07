/**
 * Proofreading eval. Runs the REAL proofread prompt and the REAL code checks on
 * synthetic chapters with planted errors, and scores the result
 * deterministically (no judge model).
 *
 *   ANTHROPIC_API_KEY=… npm run eval:proofread                # every case once
 *   ANTHROPIC_API_KEY=… npm run eval:proofread -- --repeat 3  # consistency
 *   npm run eval:proofread -- --dry-run                       # build messages only, no API
 *
 * The model is the app default (config/models.json) unless `--model` says
 * otherwise. Costs well under €1 per run. Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { getRuntimePrompt } from "~/lib/prompts";
import { buildProofreadMessage, parseProofread } from "~/lib/portfolio/proofread";
import { OUTCOME_ID } from "./eval-coach-helpers";
import {
  type ProofreadCase,
  type ProofreadScore,
  caseToDossier,
  proofreadReportMarkdown,
  scoreProofreadCase,
} from "./eval-proofread-helpers";

const EVALS_DIR = join(process.cwd(), "evals");
const REPORTS_DIR = join(EVALS_DIR, "reports");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const model = arg("model") ?? DEFAULT_MODEL;
  const cases = JSON.parse(
    readFileSync(join(EVALS_DIR, "portfolio-proofread", "cases.json"), "utf8"),
  ).cases as ProofreadCase[];
  const rows: ProofreadScore[] = [];

  for (const c of cases) {
    const d = caseToDossier(c);
    const message = buildProofreadMessage(d, OUTCOME_ID, c.locale);
    if (dryRun) {
      console.log(`${c.id}: ${message.length} chars`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      const { text } = await providerForModel(model).generate({
        model,
        system: getRuntimePrompt("portfolio-proofread@v1", c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 4_000,
      });
      const score = scoreProofreadCase(c, parseProofread(text, d, OUTCOME_ID));
      rows.push({ ...score, caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id });
      console.log(`${score.pass ? "✓" : "×"} ${c.id}${repeat > 1 ? `#${i + 1}` : ""}`);
    }
  }
  if (dryRun) return;

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}-portfolio-proofread.md`);
  writeFileSync(file, proofreadReportMarkdown({ date, model, repeat, rows }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
