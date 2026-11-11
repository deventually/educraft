/**
 * Framework-extraction eval. Runs the REAL extraction prompt and the REAL code
 * checks on synthetic assessment forms, and scores the result deterministically
 * (no judge model): criteria, the chapter outline, its criterion links and the
 * literature.
 *
 *   ANTHROPIC_API_KEY=… npm run eval:framework                       # every case once, @v2
 *   ANTHROPIC_API_KEY=… npm run eval:framework -- --repeat 3         # consistency
 *   ANTHROPIC_API_KEY=… npm run eval:framework -- --prompt portfolio-framework@v1 --label v1
 *   npm run eval:framework -- --dry-run                              # build messages only, no API
 *
 * The model is the app default (config/models.json) unless `--model` says
 * otherwise. `--label x` writes `<date>x-portfolio-framework.md`, so a second
 * run on the same day does not overwrite the first. Costs well under €1 per run.
 * Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { getRuntimePrompt } from "~/lib/prompts";
import { buildExtractMessage, FRAMEWORK_PROMPT_ID, parseExtraction } from "~/lib/portfolio/extract";
import {
  type FrameworkCase,
  type FrameworkScore,
  frameworkReportMarkdown,
  scoreFrameworkCase,
} from "./eval-framework-helpers";

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
  const promptId = arg("prompt") ?? FRAMEWORK_PROMPT_ID;
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const cases = JSON.parse(
    readFileSync(join(EVALS_DIR, "portfolio-framework", "cases.json"), "utf8"),
  ).cases as FrameworkCase[];
  const rows: FrameworkScore[] = [];

  for (const c of cases) {
    const message = buildExtractMessage(c.form);
    if (dryRun) {
      console.log(`${c.id}: ${message.length} chars`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      const { text } = await providerForModel(model).generate({
        model,
        system: getRuntimePrompt(promptId, c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 8_000,
      });
      const score = scoreFrameworkCase(c, parseExtraction(text, c.form));
      rows.push({ ...score, caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id });
      console.log(`${score.pass ? "✓" : "×"} ${c.id}${repeat > 1 ? `#${i + 1}` : ""}`);
    }
  }
  if (dryRun) return;

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-portfolio-framework.md`);
  writeFileSync(file, frameworkReportMarkdown({ date, model, promptId, repeat, rows }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
