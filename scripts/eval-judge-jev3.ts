/**
 * Version 3 of Jev as judge of the hard checks (README "Versie 3"). Reuses the outputs and the
 * LLM judge's verdicts of an earlier judge-jev run (version 2), so all three judge the same
 * outputs, and asks Jev per piece (`eval-judge-jev-v3.ts`), once as written and once with the
 * kinds reversed (test 5). Optionally adds portfolio-rehearsal, the fresh holdout.
 *
 *   JEV_API_KEY=… npm run eval:judge-jev3 -- --from evals/reports/<date><label>-judge-jev-raw.json --label c3
 *   … -- --set tuning                    # only the tuning tools (the tuning round)
 *   … -- --rehearsal <date>              # + portfolio-rehearsal's public cases of that day
 *   … -- --labels 2026-11-14b2           # score on the labels of another report (same outputs)
 *   npm run eval:judge-jev3 -- --from … --dry-run          # count the requests, no API
 *   npm run eval:judge-jev3 -- --rescore evals/reports/<…>-judge-jev3-raw.json [--labels …]
 *   npm run eval:judge-jev3 -- --rescore … --label-items evals/output/<file>.json
 *                                        # the rows to label, for the labelling page
 *
 * Writes `evals/reports/<date><label>-judge-jev3.md` and `…-judge-jev3-raw.json` (per output
 * the answers per piece, without the requests, which the code rebuilds). Never part of CI.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ALL_TOOLS } from "~/lib/registry";
import { askJev, JEV_KEY_ENV, JEV_MODEL } from "./eval-evidence-jev-helpers";
import { loadCases, loadRubric, REPORTS_DIR } from "./eval-files";
import { type EvalCase, mapLimit, parallelism, parseHardChecks } from "./eval-helpers";
import {
  judgeFailed,
  labelsPath,
  loadJudgeSpecs,
  parseJudgeJevAnswer,
} from "./eval-judge-jev-helpers";
import {
  type CaseView,
  decideOutputV3,
  loadChecksV3,
  orderAgreement,
  planOutputV3,
} from "./eval-judge-jev-v3";
import { judgeJevV3Report, type JudgeSet, labelRows, type V3Row } from "./eval-judge-jev-v3-report";
import type { RehearsalCase } from "./eval-rehearsal-helpers";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const REHEARSAL = "portfolio-rehearsal";
const specs = loadChecksV3();
const v2specs = loadJudgeSpecs(2);

/** One output to judge: from the version 2 raw file, or a rehearsal transcript. */
interface Job {
  key: string;
  tool: Parameters<typeof planOutputV3>[0]["tool"];
  c: EvalCase;
  view?: CaseView;
  run: number;
  output: string;
  /** The judge's verdicts: its reply (19 tools), or its failed checks (rehearsal). */
  judge: string | { failed: string[] };
  /** Version 2's answer on the same output. */
  v2?: unknown;
}

interface Stored {
  answers: Record<string, Record<string, unknown>>;
  reversed: Record<string, Record<string, unknown>>;
  kept?: unknown;
}

type Raw = { meta: Meta; raw: (Omit<Job, "tool" | "c" | "view" | "run"> & { v3: Stored })[] };
interface Meta {
  date: string;
  jevModel: string;
  judgeModel: string;
  source: string;
  calls: number;
  jevMs: number[];
  jevCostUsd: number;
}

const setOf = (slug: string): JudgeSet =>
  specs.freshHoldout.includes(slug) ? "fresh" : specs.holdout.includes(slug) ? "holdout" : "tuning";

function jobsFromV2(file: string): { jobs: Job[]; date: string; judgeModel: string } {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    meta: { date: string; judgeModel: string; checksVersion?: number };
    raw: { key: string; output: string; body: unknown; judge: string }[];
  };
  if (parsed.meta.checksVersion !== 2) throw new Error(`${file} is not a version 2 run`);
  const jobs = parsed.raw.map((e) => {
    const m = /^(.+?)\/(.+)#(\d+)$/.exec(e.key);
    const tool = ALL_TOOLS.find((t) => t.slug === m?.[1]);
    const c = tool && loadCases(tool).find((x) => x.id === m?.[2]);
    if (!m || !tool || !c) throw new Error(`unknown output: ${e.key}`);
    return { key: e.key, tool, c, run: Number(m[3]), output: e.output, judge: e.judge, v2: e.body };
  });
  return { jobs, date: parsed.meta.date, judgeModel: parsed.meta.judgeModel };
}

/**
 * The fresh holdout: the public rehearsal cases of one day, with the judge's verdicts that
 * `npm run eval:rehearsal` stored next to each transcript. Private cases never take part.
 */
function rehearsalJobs(date: string): Job[] {
  const dir = join(process.cwd(), "evals/output", date, REHEARSAL);
  const cases = (
    JSON.parse(readFileSync(join(process.cwd(), "evals", REHEARSAL, "cases.json"), "utf8")) as {
      cases: RehearsalCase[];
    }
  ).cases;
  return readdirSync(dir).flatMap((f) => {
    const m = /^(.+)\.run(\d+)\.md$/.exec(f);
    const c = m && cases.find((x) => x.id === m[1]);
    const judgeFile = join(dir, f.replace(/\.md$/, ".judge.json"));
    if (!m || !c || !existsSync(judgeFile)) return [];
    const judged = JSON.parse(readFileSync(judgeFile, "utf8")) as { failed: string[] | null };
    if (!judged.failed) return [];
    // `values` holds what code decides on (`when`); the dossier goes to Jev through the view.
    const evalCase: EvalCase = {
      id: c.id,
      description: c.description,
      outputLanguage: c.locale,
      values: c.thinnest ? { thinnest: c.thinnest } : {},
      userTurns: c.teacherTurns,
    };
    const view: CaseView = {
      description: c.description,
      output_language: c.locale,
      inputs: { dossier: c.dossier, ...(c.thinnest ? { thinnest: c.thinnest } : {}) },
      known_error: null,
      user_turns: c.teacherTurns,
    };
    return [
      {
        key: `${REHEARSAL}/${c.id}#${m[2]}`,
        tool: { slug: REHEARSAL, name: "Rehearsal assessment", does: "An assessment committee holds a practice interview about the teacher's portfolio." },
        c: evalCase,
        view,
        run: Number(m[2]),
        output: readFileSync(join(dir, f), "utf8"),
        judge: { failed: judged.failed },
      },
    ];
  });
}

/** The rehearsal judge answers only the checks that are not counted in code. */
function rehearsalJudged(j: { failed: string[] }): { judged: string[]; failed: string[] } {
  const rubric = readFileSync(join(process.cwd(), "evals", REHEARSAL, "rubric.md"), "utf8");
  const judged = parseHardChecks(rubric)
    .filter((h) => !h.counted)
    .map((h) => h.id);
  return { judged, failed: j.failed.filter((id) => judged.includes(id)) };
}

/** The answer without what the decision does not read, so the raw file stays small. */
function slim(body: unknown): Record<string, unknown> {
  const answers = (body as { answers?: Record<string, { noul?: number; probabilities?: Record<string, number> }> })?.answers ?? {};
  return Object.fromEntries(
    Object.entries(answers).map(([q, a]) => [
      q,
      a.probabilities
        ? { probabilities: Object.fromEntries(Object.entries(a.probabilities).map(([k, p]) => [k, Math.round(p * 1e4) / 1e4])) }
        : { noul: a.noul },
    ]),
  );
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

function rowsOf(job: Job, stored: Stored): V3Row[] {
  const { tool, c } = job;
  const isRegistry = "tagline" in tool;
  const { judged, failed } =
    typeof job.judge === "string" && isRegistry
      ? judgeFailed(loadRubric(tool), job.judge, job.output)
      : rehearsalJudged(job.judge as { failed: string[] });
  const v3 = decideOutputV3(job, specs, stored);
  const v2 = isRegistry && job.v2 !== undefined ? parseJudgeJevAnswer(job.v2, tool, c, v2specs).verdicts : undefined;
  return judged.map((check) => {
    const spec = specs.checks[`${tool.slug}/${check}`];
    const d = v3[check];
    return {
      tool: tool.slug,
      caseId: c.id,
      run: job.run,
      check,
      set: setOf(tool.slug),
      family: !spec ? "llm" : "family" in spec ? spec.family : "keep" in spec ? "v2" : "llm",
      judge: failed.includes(check),
      ...(v2 ? { v2: v2[check]?.verdict ?? "unsettled" } : {}),
      v3: d?.verdict ?? "unsettled",
      ...(d?.p !== undefined ? { v3P: d.p } : {}),
      ...(d?.by ? { by: d.by } : {}),
      ...(d?.evidence ? { evidence: d.evidence } : {}),
    };
  });
}

function loadLabels(report: string): { labels?: Record<string, boolean>; evidence?: Record<string, boolean> } {
  const file = labelsPath(report);
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as { labels?: Record<string, boolean>; evidence?: Record<string, boolean> })
    : {};
}

const order = (r: V3Row) => `${r.tool}/${r.caseId}/${r.run}/${r.check}`;

function write(file: string, meta: Meta, jobs: Job[], stored: Map<string, Stored>, labelsFrom: string) {
  const rows = jobs.flatMap((j) => rowsOf(j, stored.get(j.key) as Stored)).sort((a, b) => order(a).localeCompare(order(b)));
  const counts: Record<JudgeSet, { same: number; total: number }> = {
    tuning: { same: 0, total: 0 },
    holdout: { same: 0, total: 0 },
    fresh: { same: 0, total: 0 },
  };
  for (const j of jobs) {
    const o = orderAgreement(j, specs, stored.get(j.key) as Stored);
    const at = counts[setOf(j.tool.slug)];
    at.same += o.same;
    at.total += o.total;
  }
  const { labels, evidence } = loadLabels(labelsFrom);
  writeFileSync(
    file,
    judgeJevV3Report({ ...meta, rows, order: counts, ...(labels ? { labels } : {}), ...(evidence ? { evidence } : {}) }),
  );
  console.log(`Report: ${file}`);
  const items = arg("label-items");
  if (items) {
    const picked = labelRows(rows, { sample: 40, seed: 20261115, tuning: process.argv.includes("--tuning") });
    const outputs = new Map(jobs.map((j) => [`${j.tool.slug}/${j.c.id}#${j.run}`, j.output]));
    writeFileSync(
      items,
      `${JSON.stringify(picked.map((r) => ({ ...r, output: outputs.get(`${r.tool}/${r.caseId}#${r.run}`) })), null, 2)}\n`,
    );
    console.log(`Rows to label: ${picked.length} → ${items}`);
  }
}

function rescore(rawFile: string) {
  const parsed = JSON.parse(readFileSync(rawFile, "utf8")) as Raw;
  const fromV2 = jobsFromV2(join(REPORTS_DIR, `${parsed.meta.source}-judge-jev-raw.json`)).jobs;
  const byKey = new Map(fromV2.map((j) => [j.key, j]));
  const rehearsal = new Map<string, Job>();
  const jobs = parsed.raw.map((e) => {
    const j = byKey.get(e.key);
    if (j) return j;
    const m = /^portfolio-rehearsal\/(.+)#(\d+)$/.exec(e.key);
    if (!m) throw new Error(`unknown output: ${e.key}`);
    if (!rehearsal.size) {
      const date = arg("rehearsal");
      if (!date) throw new Error("this raw file holds rehearsal outputs: pass --rehearsal <date>");
      for (const r of rehearsalJobs(date)) rehearsal.set(r.key, r);
    }
    const r = rehearsal.get(e.key);
    if (!r) throw new Error(`rehearsal output not found: ${e.key}`);
    return r;
  });
  const stored = new Map(parsed.raw.map((e) => [e.key, e.v3]));
  const report = basename(rawFile).replace(/-judge-jev3-raw\.json$/, "");
  write(rawFile.replace(/-raw\.json$/, ".md"), parsed.meta, jobs, stored, arg("labels") ?? report);
}

async function main() {
  const again = arg("rescore");
  if (again) return rescore(again);
  const from = arg("from");
  if (!from) throw new Error("needs --from <a version 2 judge-jev raw file>");
  const dryRun = process.argv.includes("--dry-run");
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const model = arg("model") ?? JEV_MODEL;
  const apiKey = process.env[JEV_KEY_ENV] ?? "";
  if (!dryRun && !apiKey) throw new Error(`needs ${JEV_KEY_ENV}`);
  const only = arg("set") as JudgeSet | "all" | undefined;
  const source = basename(from).replace(/-judge-jev-raw\.json$/, "");
  const v2 = jobsFromV2(from);
  const rehearsalDate = arg("rehearsal");
  const jobs = [...v2.jobs, ...(rehearsalDate ? rehearsalJobs(rehearsalDate) : [])].filter(
    (j) => !only || only === "all" || setOf(j.tool.slug) === only,
  );

  // Every request of every output in one queue, so the parallel limit holds across outputs.
  const stored = new Map<string, Stored>(jobs.map((j) => [j.key, { answers: {}, reversed: {} }]));
  const tasks = jobs.flatMap((job) => {
    const plan = planOutputV3(job, specs, { model });
    const reversed = planOutputV3(job, specs, { model, reversed: true });
    return [
      ...plan.calls.map((c) => ({ job: job.key, into: "answers" as const, unit: c.unit, request: c.request as object })),
      ...reversed.calls.map((c) => ({ job: job.key, into: "reversed" as const, unit: c.unit, request: c.request as object })),
      ...(plan.kept ? [{ job: job.key, into: "kept" as const, unit: "", request: plan.kept.request as object }] : []),
    ];
  });
  if (dryRun) {
    console.log(`${jobs.length} outputs, ${tasks.length} requests to Jev (reversed included)`);
    return;
  }
  const jevMs: number[] = [];
  let jevCostUsd = 0;
  let done = 0;
  let failures = 0;
  await mapLimit(tasks, parallelism(arg("parallel") ?? "16"), async (t) => {
    const r = await askWithRetry(t.request as Parameters<typeof askJev>[0], apiKey);
    if (!r) {
      failures++;
      return; // the pieces of this request stay unsettled, for the judge
    }
    jevMs.push(r.ms);
    jevCostUsd += (r.body as { usage?: { cost?: number } })?.usage?.cost ?? 0;
    const s = stored.get(t.job) as Stored;
    if (t.into === "kept") s.kept = { answers: slim(r.body) };
    else s[t.into][t.unit] = { ...s[t.into][t.unit], ...slim(r.body) };
    if (++done % 500 === 0) console.log(`  ${done}/${tasks.length}`);
  });
  if (failures) console.log(`  ${failures} requests failed after retries: their pieces stay unsettled`);
  const calls = tasks.length;
  const date = v2.date;
  const meta: Meta = { date, jevModel: model, judgeModel: v2.judgeModel, source, calls, jevMs, jevCostUsd };
  mkdirSync(REPORTS_DIR, { recursive: true });
  const raw: Raw = {
    meta,
    raw: jobs.map((j) => ({
      key: j.key,
      output: j.output,
      judge: j.judge,
      ...(j.v2 !== undefined ? { v2: j.v2 } : {}),
      v3: stored.get(j.key) as Stored,
    })),
  };
  const rawFile = join(REPORTS_DIR, `${date}${label}-judge-jev3-raw.json`);
  writeFileSync(rawFile, `${JSON.stringify(raw)}\n`);
  write(rawFile.replace(/-raw\.json$/, ".md"), meta, jobs, stored, arg("labels") ?? `${date}${label}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
