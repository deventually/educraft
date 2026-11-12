/**
 * Evidence-sorting eval (advice "vereenvoudigen", point 3: evidence in one go). Runs the REAL
 * `portfolio-evidence-sort@v1` prompt with the app's own message and code checks on synthetic
 * files, and scores the proposal deterministically (no judge model): the right outcome, kind,
 * criteria and required-evidence line, "Controleren" where it must be, and no names or injected
 * words in what the teacher reads.
 *
 *   ANTHROPIC_API_KEY=… npm run eval:evidence                    # every case once
 *   ANTHROPIC_API_KEY=… npm run eval:evidence -- --repeat 3      # consistency
 *   ANTHROPIC_API_KEY=… npm run eval:evidence -- --label b       # <date>b-portfolio-evidence.md
 *   npm run eval:evidence -- --dry-run                           # build messages only, no API
 *
 * The model is the app default (config/models.json) unless `--model` says otherwise. Costs
 * well under €1 per run. Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { getRuntimePrompt } from "~/lib/prompts";
import { buildSortMessage, parseSortAnswer, SORT_PROMPT_ID } from "~/lib/portfolio/batch";
import {
  caseDossier,
  type EvidenceEvalFile,
  type EvidenceRow,
  evidenceReportMarkdown,
  scoreSort,
} from "./eval-evidence-helpers";

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
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const suite = JSON.parse(
    readFileSync(join(EVALS_DIR, "portfolio-evidence", "cases.json"), "utf8"),
  ) as EvidenceEvalFile;
  const rows: EvidenceRow[] = [];

  for (const c of suite.cases) {
    const d = caseDossier(suite, c);
    const message = buildSortMessage(d, c.file, c.locale);
    if (dryRun) {
      console.log(`${c.id}: ${message.length} chars`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      const { text } = await providerForModel(model).generate({
        model,
        system: getRuntimePrompt(SORT_PROMPT_ID, c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 600,
      });
      const proposal = parseSortAnswer(text, d, { key: c.id, ...c.file });
      const row = { caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id, ...scoreSort(suite, c, text, proposal) };
      rows.push(row);
      console.log(`${row.pass ? "✓" : "×"} ${row.caseId}`);
      if (!row.pass) {
        const failed = Object.entries(row.checks).filter(([, ok]) => !ok).map(([k]) => k);
        console.log(`   ${failed.join(", ")}: ${text}`);
      }
    }
  }
  if (dryRun) return;

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-portfolio-evidence.md`);
  writeFileSync(file, evidenceReportMarkdown({ date, model, repeat, rows }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
