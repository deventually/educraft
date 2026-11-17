/**
 * The Bloom check in the course wizard (experiment, 2026-11-17): does Jev's check speak up where
 * the wizard's intended level is off, and stay quiet where it is right? Two steps, so the labels
 * stay blind:
 *
 *   npm run eval:bloom-check -- --generate --model claude-code::claude-sonnet-5-5
 *       the wizard writes outcomes for every course (`loadCheckCourses`), as the app asks it;
 *       writes `evals/bloom-check/outcomes.json`. Bastiaan labels them in `labels.json`
 *       (outcome → level, or null for "no level") without seeing a level.
 *   JEV_API_KEY=… npm run eval:bloom-check -- --repeat 3 --label a
 *       Jev checks each outcome, with the app's request and `bloomCheck`; writes
 *       `evals/reports/<date><label>-bloom-check.md` and `…-raw.json`.
 *   npm run eval:bloom-check -- --rescore evals/reports/<date><label>-bloom-check-raw.json
 *
 * Nothing is tuned: the questions and the threshold (0.7) are the import's. Never part of CI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import { buildBloomJevRequest, parseBloomJevAnswer } from "~/lib/courses/bloomJev";
import { buildOutcomesDesignMessage, parseOutcomesDesign } from "~/lib/courses/design";
import { emptyCourseData } from "~/lib/courses/schema";
import { getRuntimePrompt } from "~/lib/prompts";
import {
  type CheckRow,
  checkReport,
  type Labels,
  loadCheckCourses,
  uniqueOutcomes,
  type WizardOutcome,
} from "./eval-bloom-check-helpers";
import { askJev, JEV_KEY_ENV, JEV_MODEL } from "./eval-evidence-jev-helpers";
import { EVALS_DIR, REPORTS_DIR } from "./eval-files";
import { mapLimit, parallelism } from "./eval-helpers";

const DIR = join(EVALS_DIR, "bloom-check");
const OUTCOMES = join(DIR, "outcomes.json");
const PROMPT_ID = "course-design-outcomes@v1";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadLabels(): Labels {
  const file = join(DIR, "labels.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { labels: Labels }).labels : {};
}

type Meta = Omit<Parameters<typeof checkReport>[0], "rows" | "labels">;

/** Step 1: the wizard's outcomes, as the app asks for them (app/server/courseDesign.server.ts). */
async function generate() {
  const model = arg("model") ?? DEFAULT_MODEL;
  const runs = Math.max(1, Number(arg("runs") ?? 1));
  const all: WizardOutcome[] = [];
  for (const c of loadCheckCourses()) {
    const message = buildOutcomesDesignMessage({
      name: c.name,
      brief: c.brief,
      disciplines: c.disciplines ?? [],
      context: c.context ?? "",
    });
    for (let run = 1; run <= runs; run++) {
      const { text } = await providerForModel(model).generate({
        model,
        system: getRuntimePrompt(PROMPT_ID, c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 4_000,
      });
      const parsed = parseOutcomesDesign(text, emptyCourseData());
      const outcomes = parsed.ok ? parsed.proposal.outcomes : [];
      for (const o of outcomes)
        all.push({ course: c.id, locale: c.locale, text: o.text, intended: o.bloom ?? null });
      console.log(`  ✓ ${c.id}#${run}: ${outcomes.length} outcomes`);
    }
  }
  const outcomes = uniqueOutcomes(all);
  mkdirSync(DIR, { recursive: true });
  writeFileSync(OUTCOMES, `${JSON.stringify({ model, runs, outcomes }, null, 2)}\n`);
  console.log(`${outcomes.length} outcomes: ${OUTCOMES}`);
}

function rescore(rawFile: string) {
  const { meta, rows } = JSON.parse(readFileSync(rawFile, "utf8")) as { meta: Meta; rows: CheckRow[] };
  const file = rawFile.replace(/-raw\.json$/, ".md");
  writeFileSync(file, checkReport({ ...meta, rows, labels: loadLabels() }));
  console.log(`Report: ${file}`);
}

/** Step 2: Jev checks every outcome, `repeat` times. */
async function check() {
  const apiKey = process.env[JEV_KEY_ENV] ?? "";
  if (!apiKey) throw new Error(`needs ${JEV_KEY_ENV}`);
  const { model: llmModel, outcomes } = JSON.parse(readFileSync(OUTCOMES, "utf8")) as {
    model: string;
    outcomes: WizardOutcome[];
  };
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const jevModel = arg("jev-model") ?? JEV_MODEL;
  const limit = parallelism(arg("parallel") ?? "4");
  const rows: CheckRow[] = [];
  const raw: unknown[] = [];
  const jevMs: number[] = [];
  let jevCostUsd = 0;
  for (let run = 1; run <= repeat; run++) {
    const answers = await mapLimit(outcomes, limit, async (o) => {
      const request = buildBloomJevRequest(o.text, o.locale, jevModel);
      const answer = await askJev(request, { apiKey }).catch(() => ({ body: null, ms: 0 }));
      jevMs.push(answer.ms);
      const v = parseBloomJevAnswer(answer.body);
      if (v.costUsd !== undefined) jevCostUsd += v.costUsd;
      raw.push({ run, outcome: o.text, request, body: answer.body });
      return v.usable ? v.p : null;
    });
    outcomes.forEach((o, i) => rows.push({ ...o, run, p: answers[i] ?? null }));
    console.log(`  ✓ run ${run}: ${outcomes.length} outcomes`);
  }
  const date = new Date().toISOString().slice(0, 10);
  const meta: Meta = { date, jevModel, llmModel, repeat, jevMs, jevCostUsd };
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-bloom-check.md`);
  writeFileSync(file, checkReport({ ...meta, rows, labels: loadLabels() }));
  writeFileSync(
    join(REPORTS_DIR, `${date}${label}-bloom-check-raw.json`),
    `${JSON.stringify({ meta, rows, raw }, null, 2)}\n`,
  );
  console.log(`Report: ${file}`);
}

async function main() {
  const again = arg("rescore");
  if (again) return rescore(again);
  if (process.argv.includes("--generate")) return generate();
  return check();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
