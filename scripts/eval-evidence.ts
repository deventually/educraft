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
 *   OPENROUTER_API_KEY=… npm run eval:evidence -- --jev --label jev   # TypeSafe Jev instead
 *
 * The model is the app default (config/models.json) unless `--model` says otherwise. With
 * `--jev` the same cases go to Jev as typed decisions (`eval-evidence-jev-helpers.ts`), through
 * OpenRouter, and are scored by the same code; `--model` then names the Jev version. Jev's raw
 * answers go next to the report (`…-raw.json`), to tune the thresholds offline. Costs well
 * under €1 per run. Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { getRuntimePrompt } from "~/lib/prompts";
import {
  buildSortMessage,
  parseSortAnswer,
  SORT_PROMPT_ID,
  type SortProposal,
} from "~/lib/portfolio/batch";
import {
  answerUsable,
  caseDossier,
  type EvidenceEvalFile,
  type EvidenceRow,
  evidenceReportMarkdown,
  scoreSort,
} from "./eval-evidence-helpers";
import { askJev, buildJevRequest, JEV_MODEL, parseJevAnswer } from "./eval-evidence-jev-helpers";

const EVALS_DIR = join(process.cwd(), "evals");
const REPORTS_DIR = join(EVALS_DIR, "reports");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const jev = process.argv.includes("--jev");
  const model = arg("model") ?? (jev ? JEV_MODEL : DEFAULT_MODEL);
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (jev && !dryRun && !apiKey) throw new Error("--jev needs OPENROUTER_API_KEY");
  let costUsd: number | undefined;
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const suite = JSON.parse(
    readFileSync(join(EVALS_DIR, "portfolio-evidence", "cases.json"), "utf8"),
  ) as EvidenceEvalFile;
  const rows: EvidenceRow[] = [];
  /** Jev's answers as they came, so thresholds can be tuned offline without new calls. */
  const raw: { caseId: string; body: unknown }[] = [];

  for (const c of suite.cases) {
    const d = caseDossier(suite, c);
    const message = buildSortMessage(d, c.file, c.locale);
    const request = buildJevRequest(d, c.file, c.locale, model);
    if (dryRun) {
      console.log(
        jev
          ? `${c.id}: ${Object.keys(request.questions).length} questions`
          : `${c.id}: ${message.length} chars`,
      );
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      const caseId = repeat > 1 ? `${c.id}#${i + 1}` : c.id;
      const start = performance.now();
      let text: string;
      let usable: boolean;
      let proposal: SortProposal;
      let ms: number;
      let why: string[] | undefined;
      if (jev) {
        const answer = await askJev(request, { apiKey });
        const parsed = parseJevAnswer(answer.body, d, { key: c.id, ...c.file });
        ({ usable, proposal, why } = parsed);
        raw.push({ caseId, body: answer.body });
        if (parsed.costUsd !== undefined) costUsd = (costUsd ?? 0) + parsed.costUsd;
        text = `p(outcome)=${parsed.outcomeProbability?.toFixed(2) ?? "-"} ${JSON.stringify(proposal)}`;
        ms = answer.ms;
      } else {
        ({ text } = await providerForModel(model).generate({
          model,
          system: getRuntimePrompt(SORT_PROMPT_ID, c.locale),
          messages: [{ role: "user", content: message }],
          temperature: 0,
          maxTokens: 600,
        }));
        usable = answerUsable(text);
        proposal = parseSortAnswer(text, d, { key: c.id, ...c.file });
        ms = Math.round(performance.now() - start);
      }
      const row = { caseId, ms, ...(why ? { why } : {}), ...scoreSort(suite, c, usable, proposal) };
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
  writeFileSync(file, evidenceReportMarkdown({ date, model, repeat, rows, costUsd }));
  console.log(`Report: ${file}`);
  if (jev) {
    const rawFile = join(REPORTS_DIR, `${date}${label}-portfolio-evidence-raw.json`);
    writeFileSync(rawFile, `${JSON.stringify(raw, null, 2)}\n`);
    console.log(`Raw Jev answers: ${rawFile}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
