/**
 * Version 4 of Jev as judge: the five dimension scores (README "Versie 4"). Reuses the outputs and
 * Sonnet's scores of a version 3 run, so both judge the same outputs, and asks Jev the questions
 * of `evals/judge-jev/dimensions.v4.json` per output (`eval-judge-jev-v4.ts`).
 *
 *   npm run eval:judge-jev4 -- --from evals/reports/2026-11-14b3t-judge-jev3-raw.json --dry-run
 *   JEV_API_KEY=… npm run eval:judge-jev4 -- --from <v3 raw file> --label t4
 *   npm run eval:judge-jev4 -- --rescore evals/reports/<…>-judge-jev4-raw.json [--labels <name>]
 *   npm run eval:judge-jev4 -- --from <v3 raw file> --label-items <file> --sample tuning|holdout
 *                                        # the outputs Bastiaan labels, for the labelling page
 *
 * Labels: `evals/judge-jev/labels/<name>-v4.json` ({ labels, retest? }, per output the five
 * scores, null for "weet ik niet"). Writes `evals/reports/<date><label>-judge-jev4.md` and
 * `…-judge-jev4-raw.json` (per output Jev's kept answers; the requests are rebuilt by code).
 * Calls only Jev, never Claude. Never part of CI.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { loc } from "~/lib/i18n/localized";
import { ALL_TOOLS } from "~/lib/registry";
import { askJev, JEV_KEY_ENV, JEV_MODEL } from "./eval-evidence-jev-helpers";
import { loadCases, loadRubric, REPORTS_DIR } from "./eval-files";
import { mapLimit, parallelism, parseJudgeResult, rubricForJudge } from "./eval-helpers";
import {
  type AskedV4,
  DIMENSIONS,
  decideDimensions,
  type DimensionsV4,
  keepScoreAnswers,
  loadDimensionsV4,
  type OutputInput,
  planRequestsV4,
} from "./eval-judge-jev-v4";
import {
  judgeJevV4Report,
  labelSample,
  retestAgreement,
  rubricSentences,
  type ScoreAnswer,
  scoreSpread,
  type V4Labels,
  type V4Row,
  withLabels,
} from "./eval-judge-jev-v4-report";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Jev 1.14's list price for input, per token (live docs, 15 November 2026). */
const JEV_INPUT_USD = 0.042 / 1e6;
const SEED = 20261115;

type Job = OutputInput & { tool: (typeof ALL_TOOLS)[number]; key: string; run: number; judge: string };
interface Meta {
  date: string;
  jevModel: string;
  judgeModel: string;
  source: string;
  calls: number;
  jevMs: number[];
  jevCostUsd: number;
  judgeCostUsd?: number;
  judgeOutputs?: number;
}
type Raw = { meta: Meta; raw: { key: string; output: string; judge: string; v4: Record<string, unknown> }[] };
type V3Meta = { date: string; judgeModel: string; judgeCostUsd?: number; judgeOutputs?: number };

function jobsFrom(file: string): { jobs: Job[]; meta: V3Meta } {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { meta: V3Meta; raw: { key: string; output: string; judge: unknown }[] };
  // portfolio-rehearsal takes no part: no per-run Sonnet scores in the repo (README "Versie 4").
  const jobs = parsed.raw.filter((e) => !e.key.startsWith("portfolio-rehearsal/")).map((e) => {
    const m = /^(.+?)\/(.+)#(\d+)$/.exec(e.key);
    const tool = ALL_TOOLS.find((t) => t.slug === m?.[1]);
    const c = tool && loadCases(tool).find((x) => x.id === m?.[2]);
    if (!m || !tool || !c || typeof e.judge !== "string") throw new Error(`not a 19-tool output: ${e.key}`);
    const sentences = rubricSentences(loadRubric(tool));
    return { key: e.key, tool, c, run: Number(m[3]), output: e.output, judge: e.judge, sentences };
  });
  return { jobs, meta: parsed.meta };
}

const setOf = (d: DimensionsV4, slug: string) => (d.holdout.includes(slug) ? "holdout" : "tuning");

function rowsOf(job: Job, d: DimensionsV4, answers: Record<string, unknown>): V4Row[] {
  const jev = decideDimensions(job, d, answers);
  const sonnet = parseJudgeResult(job.judge)?.scores ?? {};
  return DIMENSIONS.map((dim) => ({
    key: job.key,
    tool: job.tool.slug,
    caseId: job.c.id,
    run: job.run,
    set: setOf(d, job.tool.slug),
    dim,
    ...(typeof sonnet[dim] === "number" ? { sonnet: sonnet[dim] } : {}),
    ...(jev[dim] ? { jev: jev[dim].score, jevX: jev[dim].x, parts: jev[dim].parts } : {}),
  }));
}

/** Every Score answer, with its part and number of levels, for the distributions. */
function scoreAnswers(jobs: Job[], d: DimensionsV4, stored: Map<string, Record<string, unknown>>): ScoreAnswer[] {
  return jobs.flatMap((j) =>
    DIMENSIONS.flatMap((dim) =>
      (d.tools[j.tool.slug]?.[dim] ?? []).flatMap((p) => {
        const a = stored.get(j.key)?.[`${dim}.${p.id}`] as Omit<ScoreAnswer, "part" | "levels"> | undefined;
        return p.type === "score" && a?.probabilities
          ? [{ part: `${j.tool.slug} ${dim}.${p.id}`, levels: p.levels.length, ...a }]
          : [];
      }),
    ),
  );
}

function loadLabels(name: string): { labels: V4Labels; retest?: V4Labels } {
  const file = join(process.cwd(), "evals/judge-jev/labels", `${name}-v4.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { labels: V4Labels; retest?: V4Labels }) : { labels: {} };
}

function write(file: string, meta: Meta, jobs: Job[], d: DimensionsV4, stored: Map<string, Record<string, unknown>>, labelsFrom: string) {
  const { labels, retest } = loadLabels(labelsFrom);
  const rows = withLabels(
    jobs.flatMap((j) => rowsOf(j, d, stored.get(j.key) ?? {})),
    labels,
  );
  writeFileSync(
    file,
    judgeJevV4Report({
      ...meta,
      read: d.read,
      outputs: jobs.length,
      rows,
      ...(retest ? { retest: retestAgreement(labels, retest) } : {}),
      spread: scoreSpread(scoreAnswers(jobs, d, stored)),
    }),
  );
  console.log(`Report: ${file}`);
}

/**
 * The items of the labelling page: what Sonnet saw (the case, the rubric without its hard checks,
 * the output), never a judge's score. Opaque ids; the holdout sample ends with five repeats.
 */
function labelItems(jobs: Job[], d: DimensionsV4, sample: "tuning" | "holdout") {
  const keys = jobs.filter((j) => setOf(d, j.tool.slug) === sample).map((j) => j.key);
  const picked =
    sample === "tuning" ? labelSample(keys, { perTool: 1, tools: 8, seed: SEED }) : labelSample(keys, { perTool: 5, seed: SEED });
  const shuffled = shuffleKeys(picked);
  const repeats = sample === "holdout" ? labelSample(picked, { perTool: 1, tools: 5, seed: SEED + 2 }) : [];
  const byKey = new Map(jobs.map((j) => [j.key, j]));
  return [...shuffled, ...repeats].map((key, i) => {
    const j = byKey.get(key) as Job;
    const rubric = loadRubric(j.tool);
    return {
      id: `item-${String(i + 1).padStart(2, "0")}`,
      key,
      repeat: i >= shuffled.length,
      tool: loc(j.tool.name, "nl"),
      case: { description: j.c.description ?? "", outputLanguage: j.c.outputLanguage, eqf: j.c.profile?.eqf ?? null, inputs: j.c.values ?? {} },
      rubric: rubricForJudge(rubric),
      dimensions: rubricSentences(rubric),
      output: j.output,
    };
  });
}

/** A seeded shuffle of all keys together, so tools are mixed in the labelling order. */
function shuffleKeys(keys: string[]): string[] {
  const one = keys.map((k) => `all/${k}`);
  return labelSample(one, { perTool: one.length, seed: SEED + 1 }).map((k) => k.slice(4));
}

function rescore(rawFile: string) {
  const parsed = JSON.parse(readFileSync(rawFile, "utf8")) as Raw;
  const { jobs: all } = jobsFrom(join(REPORTS_DIR, `${parsed.meta.source}-judge-jev3-raw.json`));
  const keys = new Set(parsed.raw.map((e) => e.key));
  const jobs = all.filter((j) => keys.has(j.key));
  const stored = new Map(parsed.raw.map((e) => [e.key, e.v4]));
  const report = basename(rawFile).replace(/-judge-jev4-raw\.json$/, "");
  write(rawFile.replace(/-raw\.json$/, ".md"), parsed.meta, jobs, loadDimensionsV4(), stored, arg("labels") ?? report);
}

/** One request, tried up to four times with a growing pause; undefined when it keeps failing. */
async function askWithRetry(request: Parameters<typeof askJev>[0], apiKey: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await askJev(request, { apiKey });
    } catch (e) {
      if (attempt === 3) console.log(`  ✗ ${(e as Error).message.slice(0, 120)}`);
      else await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  return undefined;
}

async function main() {
  const again = arg("rescore");
  if (again) return rescore(again);
  const from = arg("from");
  if (!from) throw new Error("needs --from <a version 3 judge-jev3 raw file>");
  const d = loadDimensionsV4();
  const v3 = jobsFrom(from);
  const items = arg("label-items");
  if (items) {
    const sample = arg("sample");
    if (sample !== "tuning" && sample !== "holdout") throw new Error("needs --sample tuning|holdout");
    const list = labelItems(v3.jobs, d, sample);
    writeFileSync(items, `${JSON.stringify(list, null, 2)}\n`);
    console.log(`Outputs to label: ${list.length} → ${items}`);
    return;
  }
  const dryRun = process.argv.includes("--dry-run");
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const model = arg("model") ?? JEV_MODEL;
  const apiKey = process.env[JEV_KEY_ENV] ?? "";
  if (!dryRun && !apiKey) throw new Error(`needs ${JEV_KEY_ENV}`);
  const only = arg("set");
  const jobs = v3.jobs.filter((j) => !only || setOf(d, j.tool.slug) === only);
  const tasks = jobs.flatMap((job) => planRequestsV4(job, d, { model }).map((r) => ({ job: job.key, request: r.request })));
  if (dryRun) {
    const chars = tasks.reduce((n, t) => n + JSON.stringify(t.request).length, 0);
    const questions = tasks.reduce((n, t) => n + Object.keys(t.request.questions).length, 0);
    console.log(
      `${jobs.length} outputs, ${tasks.length} requests, ${questions} questions; about ${Math.round(chars / 4 / 1000)}k input tokens, about $${((chars / 4) * JEV_INPUT_USD).toFixed(2)} at the input price`,
    );
    return;
  }
  const stored = new Map<string, Record<string, unknown>>(jobs.map((j) => [j.key, {}]));
  const jevMs: number[] = [];
  let jevCostUsd = 0;
  let done = 0;
  let failures = 0;
  await mapLimit(tasks, parallelism(arg("parallel") ?? "16"), async (t) => {
    const r = await askWithRetry(t.request as Parameters<typeof askJev>[0], apiKey);
    if (!r) {
      failures++;
      return; // these parts stay unanswered; the report counts outputs without a score
    }
    jevMs.push(r.ms);
    const cost = (r.body as { usage?: { cost?: unknown } } | null)?.usage?.cost;
    if (typeof cost === "number" && Number.isFinite(cost) && cost >= 0) jevCostUsd += cost;
    Object.assign(stored.get(t.job) as object, keepScoreAnswers(r.body, t.request.questions as AskedV4));
    if (++done % 200 === 0) console.log(`  ${done}/${tasks.length}`);
  });
  if (failures) console.log(`  ${failures} requests failed after retries`);
  const meta: Meta = {
    date: new Date().toISOString().slice(0, 10),
    jevModel: model,
    judgeModel: v3.meta.judgeModel,
    source: basename(from).replace(/-judge-jev3-raw\.json$/, ""),
    calls: tasks.length,
    jevMs,
    jevCostUsd,
    ...(v3.meta.judgeCostUsd !== undefined ? { judgeCostUsd: v3.meta.judgeCostUsd, judgeOutputs: v3.meta.judgeOutputs } : {}),
  };
  const raw: Raw = {
    meta,
    raw: jobs.map((j) => ({ key: j.key, output: j.output, judge: j.judge, v4: stored.get(j.key) ?? {} })),
  };
  const rawFile = join(REPORTS_DIR, `${meta.date}${label}-judge-jev4-raw.json`);
  writeFileSync(rawFile, `${JSON.stringify(raw)}\n`);
  write(rawFile.replace(/-raw\.json$/, ".md"), meta, jobs, d, stored, arg("labels") ?? `${meta.date}${label}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
