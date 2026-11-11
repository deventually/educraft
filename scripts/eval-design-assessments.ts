/**
 * Test-programme eval (the course wizard, step 2). Runs the REAL prompt, the REAL message builder
 * and the REAL code checks on fictional courses after step 1, and scores deterministically (no
 * judge model). Whether the programme is good, a person reads in the saved answers (`rubric.md`).
 *
 *   ANTHROPIC_API_KEY=… npm run eval:design-assessments                 # every case once
 *   ANTHROPIC_API_KEY=… npm run eval:design-assessments -- --repeat 3   # final measurement
 *   npm run eval:design-assessments -- --dry-run                        # build messages only
 *
 * Costs well under €1 per run (BESLUIT-2026-11-04-18). Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import {
  buildAssessmentsDesignMessage,
  parseAssessmentsDesign,
} from "~/lib/courses/designAssessments";
import { getRuntimePrompt } from "~/lib/prompts";
import {
  type AssessmentsCase,
  type AssessmentsScore,
  assessmentsReportMarkdown,
  caseCourse,
  scoreAssessmentsCase,
} from "./eval-design-assessments-helpers";

const EVALS_DIR = join(process.cwd(), "evals");
const STEP = "course-design-assessments";
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
    JSON.parse(readFileSync(join(EVALS_DIR, STEP, "cases.json"), "utf8")).cases as AssessmentsCase[]
  ).filter((c) => !only || c.id === only);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = join(EVALS_DIR, "output", date, STEP);
  mkdirSync(outDir, { recursive: true });
  const rows: AssessmentsScore[] = [];

  for (const c of cases) {
    const course = caseCourse(c);
    const forms = c.formsText ?? c.forms?.join(", ");
    const message = buildAssessmentsDesignMessage({
      name: c.name,
      data: course,
      brief: forms ? { forms } : {},
      context: c.context ?? "",
    });
    if (dryRun) {
      console.log(`--- ${c.id} (${message.length} chars)\n${message}\n`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      // The app's own budget and temperature (app/server/courseDesign.server.ts).
      const { text } = await providerForModel(model).generate({
        model,
        system: getRuntimePrompt(PROMPT_ID, c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 4_000,
      });
      const suffix = repeat > 1 ? `.run${i + 1}` : "";
      writeFileSync(join(outDir, `${c.id}${suffix}.md`), `${message}\n\n=== ANSWER ===\n\n${text}\n`);
      const score = scoreAssessmentsCase(c, parseAssessmentsDesign(text, course));
      rows.push({ ...score, caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id });
      console.log(`${score.pass ? "✓" : "×"} ${c.id}${repeat > 1 ? `#${i + 1}` : ""}`);
    }
  }
  if (dryRun) return;

  const reports = join(EVALS_DIR, "reports");
  mkdirSync(reports, { recursive: true });
  const file = join(reports, `${date}${label}-${STEP}.md`);
  writeFileSync(file, assessmentsReportMarkdown({ date, model, repeat, rows }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
