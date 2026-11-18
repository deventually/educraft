/**
 * Quotes eval. Runs the REAL quotes prompt and the REAL code checks on synthetic answers to the
 * feedback questionnaires (strong, vague, mixed), and scores the result deterministically (no
 * judge model).
 *
 *   npm run eval:quotes -- --model claude-code::claude-sonnet-5-5 --label <label>   # Claude Code
 *   ANTHROPIC_API_KEY=… npm run eval:quotes -- --label <label>                      # the API
 *   npm run eval:quotes -- --repeat 3                                               # consistency
 *   npm run eval:quotes -- --dry-run                                                # no model
 *
 * The model is the app default (config/models.json) unless `--model` says otherwise. Never part
 * of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { getRuntimePrompt } from "~/lib/prompts";
import { buildQuotesMessage, parseQuotesAnswer, QUOTES_PROMPT_ID } from "~/lib/portfolio/quotes";
import {
  caseToDossier,
  type QuotesCase,
  type QuotesScore,
  quotesReportMarkdown,
  scoreQuotesCase,
} from "./eval-quotes-helpers";

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
  const label = arg("label") ?? "portfolio-quotes";
  const cases = JSON.parse(readFileSync(join(EVALS_DIR, "portfolio-quotes", "cases.json"), "utf8"))
    .cases as QuotesCase[];
  const rows: QuotesScore[] = [];

  for (const c of cases) {
    const d = caseToDossier(c);
    const item = d.evidence[0];
    if (!item) continue;
    const message = buildQuotesMessage(d, item, c.role, c.locale);
    if (dryRun) {
      console.log(`${c.id}: ${message.length} chars`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      const { text } = await providerForModel(model).generate({
        model,
        system: getRuntimePrompt(QUOTES_PROMPT_ID, c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 1_500,
      });
      const score = scoreQuotesCase(c, d, parseQuotesAnswer(text, d, item.text));
      rows.push({ ...score, caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id });
      console.log(`${score.pass ? "✓" : "×"} ${c.id}${repeat > 1 ? `#${i + 1}` : ""}`);
    }
  }
  if (dryRun) return;

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}-${label}.md`);
  writeFileSync(file, quotesReportMarkdown({ date, model, repeat, rows }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
