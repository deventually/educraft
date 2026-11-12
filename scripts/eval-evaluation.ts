/**
 * Course-evaluation eval (brief P33.2). Runs the REAL prompt, the REAL message builder and the
 * REAL code checks on fictional, already anonymised surveys, and scores deterministically (no
 * judge model). Whether the themes and improvements are good, a person reads in the saved
 * answers (`rubric.md`).
 *
 *   ANTHROPIC_API_KEY=… npm run eval:evaluation                 # every case once
 *   ANTHROPIC_API_KEY=… npm run eval:evaluation -- --repeat 3   # final measurement
 *   npm run eval:evaluation -- --dry-run                        # build messages only
 *
 * Costs well under €1 per run (BESLUIT-2026-11-04-18). Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import { buildEvaluationMessage, parseEvaluation } from "~/lib/courses/evaluation";
import { getRuntimePrompt } from "~/lib/prompts";
import {
  caseCourse,
  caseTestAnalysis,
  type EvaluationCase,
  type EvaluationScore,
  evaluationReportMarkdown,
  scoreEvaluationCase,
} from "./eval-evaluation-helpers";

const EVALS_DIR = join(process.cwd(), "evals");
const STEP = "course-evaluation";
const PROMPT_ID = `${STEP}@v1`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const model = arg("model") ?? DEFAULT_MODEL;
  const label = arg("label") ?? "";
  const only = arg("case");
  const cases = (
    JSON.parse(readFileSync(join(EVALS_DIR, STEP, "cases.json"), "utf8")).cases as EvaluationCase[]
  ).filter((c) => !only || c.id === only);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = join(EVALS_DIR, "output", date, STEP);
  mkdirSync(outDir, { recursive: true });
  const rows: EvaluationScore[] = [];
  let retries = 0;

  for (const c of cases) {
    const data = caseCourse(c);
    const message = buildEvaluationMessage({
      name: c.name,
      data,
      evaluation: c.evaluation,
      respondents: c.respondents,
      testAnalysis: caseTestAnalysis(c),
      context: c.context ?? "",
    });
    if (dryRun) {
      console.log(`--- ${c.id} (${message.length} chars)\n${message}\n`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      // The app's own budget, temperature and single retry on unreadable JSON
      // (app/server/courseEvaluation.server.ts).
      const ask = async () =>
        (
          await providerForModel(model).generate({
            model,
            system: getRuntimePrompt(PROMPT_ID, c.locale),
            messages: [{ role: "user", content: message }],
            temperature: 0,
            maxTokens: 6_000,
          })
        ).text;
      const check = (text: string) =>
        parseEvaluation(text, { data, evaluation: c.evaluation, respondents: c.respondents });
      const texts = [await ask()];
      let parsed = check(texts[0] ?? "");
      if (!parsed.ok) {
        retries++;
        texts.push(await ask());
        parsed = check(texts[1] ?? "");
      }
      const suffix = repeat > 1 ? `.run${i + 1}` : "";
      writeFileSync(
        join(outDir, `${c.id}${suffix}.md`),
        `${message}\n\n${texts.map((t) => `=== ANSWER ===\n\n${t}\n`).join("\n")}`,
      );
      const score = scoreEvaluationCase(c, parsed);
      rows.push({ ...score, caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id });
      console.log(`${score.pass ? "✓" : "×"} ${c.id}${repeat > 1 ? `#${i + 1}` : ""}`);
    }
  }
  if (dryRun) return;

  const reports = join(EVALS_DIR, "reports");
  mkdirSync(reports, { recursive: true });
  const file = join(reports, `${date}${label}-${STEP}.md`);
  writeFileSync(file, evaluationReportMarkdown({ date, model, repeat, rows, retries }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
