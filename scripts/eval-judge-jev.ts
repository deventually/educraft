/**
 * Jev as judge of the hard checks (experiment, 2026-11-13). Reads the outputs a normal eval run
 * wrote (`npm run eval -- --cases-only`), and has both the LLM judge (the eval's own prompt) and
 * TypeSafe's Jev judge the same outputs, timing and pricing each.
 *
 *   ANTHROPIC_API_KEY=… JEV_API_KEY=… npm run eval:judge-jev -- --runs 3 --label a
 *   … -- --date 2026-11-13          # the outputs of that day (default: the latest)
 *   … -- --tool mentorai,lesson-plan
 *   … -- --checks 1                  # the questions of version 1 (default: the latest)
 *   npm run eval:judge-jev -- --dry-run   # build the requests only, no API
 *   npm run eval:judge-jev -- --rescore evals/reports/<date><label>-judge-jev-raw.json
 *                                    # the report again with the labels as they are now, no API
 *
 * Writes `evals/reports/<date><label>-judge-jev.md` and `…-judge-jev-raw.json` (each exact Jev
 * request with its answer, and the judge's reply). Labels for the rows where the two disagree
 * go in `evals/judge-jev/labels/<date><label>.json` (row key → the check failed); the report scores both
 * judges on them. Never part of CI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { providerForModel } from "~/lib/ai/provider";
import { ALL_TOOLS } from "~/lib/registry";
import type { Tool } from "~/lib/registry/types";
import { askJev, JEV_KEY_ENV, JEV_MODEL } from "./eval-evidence-jev-helpers";
import {
  latestOutputDate,
  loadCases,
  loadRubric,
  REPORTS_DIR,
  readExistingOutput,
} from "./eval-files";
import {
  buildJudgePrompt,
  DEFAULT_JUDGE_MODEL,
  type EvalCase,
  JUDGE_MAX_TOKENS,
  mapLimit,
  parallelism,
  parseHardChecks,
  parseJudgeResult,
  unjudgeableReason,
  verifyEvidence,
} from "./eval-helpers";
import {
  buildJudgeJevRequest,
  catalogPrice,
  type JudgeRow,
  judgeJevReport,
  LATEST_CHECKS,
  labelsPath,
  listPriceUsd,
  loadJudgeSpecs,
  parseJudgeJevAnswer,
} from "./eval-judge-jev-helpers";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** One row per judged check of one output: Jev's verdict next to the LLM judge's. */
function rowsOf(
  job: { tool: Tool; c: EvalCase; run: number; rubric: string },
  output: string,
  body: unknown,
  judgeText: string,
  specs: ReturnType<typeof loadJudgeSpecs>,
) {
  const { tool, c, run, rubric } = job;
  const judgedIds = parseHardChecks(rubric)
    .filter((h) => !h.counted)
    .map((h) => h.id);
  const parsed = parseJudgeResult(judgeText);
  const { kept } = verifyEvidence(
    (parsed?.failedChecks ?? []).filter((id) => judgedIds.includes(id)),
    parsed?.evidence,
    output,
  );
  const jev = parseJudgeJevAnswer(body, tool, c, specs);
  const rows: JudgeRow[] = judgedIds.map((check) => {
    const v = jev.verdicts[check];
    return {
      tool: tool.slug,
      caseId: c.id,
      run,
      check,
      holdout: specs.holdout.includes(tool.slug),
      jev: v?.verdict ?? "unsettled",
      ...(v?.p !== undefined ? { jevP: v.p } : {}),
      sonnet: kept.includes(check),
    };
  });
  return { rows, costUsd: jev.costUsd };
}

function loadLabels(report: string): Record<string, boolean> | undefined {
  const file = labelsPath(report);
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as { labels: Record<string, boolean> }).labels
    : undefined;
}

const order = (r: JudgeRow) => `${r.tool}/${r.caseId}/${r.run}/${r.check}`;

type Meta = Omit<Parameters<typeof judgeJevReport>[0], "rows" | "labels">;

interface RawEntry {
  key: string;
  /** The output as the eval wrote it (version 2: the request holds it by stage). */
  output?: string;
  request: { state: { output: string } };
  body: unknown;
  judge: string;
}

/** Date, models, speed and cost as the first report printed them (its raw file has no meta). */
function metaFromReport(md: string): Meta {
  const text = readFileSync(md, "utf8");
  const pick = (re: RegExp) => re.exec(text)?.[1] ?? "";
  const num = (re: RegExp) => Number(pick(re));
  return {
    date: pick(/Datum: (\S+)/),
    jevModel: pick(/Jev: (\S+) ·/),
    checksVersion: num(/checks: v(\d+)/) || 1,
    judgeModel: pick(/judge: (\S+)\n/),
    jevMs: { mean: num(/Jev: gemiddeld (\d+) ms/), max: num(/Jev: gemiddeld \d+ ms, hoogst (\d+)/) },
    judgeMs: {
      mean: num(/Sonnet-judge: gemiddeld (\d+) ms/),
      max: num(/Sonnet-judge: gemiddeld \d+ ms, hoogst (\d+)/),
    },
    jevCostUsd: num(/Kosten Jev: \$([\d.]+)/),
    judgeCostUsd: num(/Kosten judge: \$([\d.]+)/),
  };
}

/** The report again from a raw file, with the labels as they are now: no API. */
function rescore(rawFile: string) {
  const file = rawFile.replace(/-raw\.json$/, ".md");
  const parsed = JSON.parse(readFileSync(rawFile, "utf8")) as
    | { meta: Meta; raw: RawEntry[] }
    | RawEntry[];
  const entries = Array.isArray(parsed) ? parsed : parsed.raw;
  const meta = Array.isArray(parsed) ? metaFromReport(file) : parsed.meta;
  const specs = loadJudgeSpecs(meta.checksVersion ?? 1);
  const rows = entries.flatMap((e) => {
    const m = /^(.+?)\/(.+)#(\d+)$/.exec(e.key);
    const tool = ALL_TOOLS.find((t) => t.slug === m?.[1]);
    const c = tool && loadCases(tool).find((x) => x.id === m?.[2]);
    if (!m || !tool || !c) throw new Error(`unknown output in the raw file: ${e.key}`);
    const job = { tool, c, run: Number(m[3]), rubric: loadRubric(tool) };
    return rowsOf(job, e.output ?? e.request.state.output, e.body, e.judge, specs).rows;
  });
  rows.sort((a, b) => order(a).localeCompare(order(b)));
  const labels = loadLabels(basename(rawFile).replace(/-judge-jev-raw\.json$/, ""));
  writeFileSync(file, judgeJevReport({ ...meta, rows, ...(labels ? { labels } : {}) }));
  console.log(`Report: ${file}`);
}

async function main() {
  const again = arg("rescore");
  if (again) return rescore(again);
  const dryRun = process.argv.includes("--dry-run");
  const runs = Math.max(1, Number(arg("runs") ?? 1));
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const jevModel = arg("model") ?? JEV_MODEL;
  const judgeModel = arg("judge-model") ?? DEFAULT_JUDGE_MODEL;
  const checksVersion = Number(arg("checks") ?? LATEST_CHECKS);
  const specs = loadJudgeSpecs(checksVersion);
  const apiKey = process.env[JEV_KEY_ENV] ?? "";
  if (!dryRun && !apiKey) throw new Error(`needs ${JEV_KEY_ENV}`);
  const date = arg("date") ?? latestOutputDate();
  if (!date) throw new Error("No outputs yet: run `npm run eval -- --cases-only` first.");
  const only = arg("tool")?.split(",");
  const price = catalogPrice(judgeModel);

  const tools = ALL_TOOLS.filter(
    (t) =>
      (!only || only.includes(t.slug)) &&
      Object.keys(specs.checks).some((k) => k.startsWith(`${t.slug}/`)),
  );
  const jobs = tools.flatMap((tool) =>
    loadCases(tool).flatMap((c) =>
      Array.from({ length: runs }, (_, i) => ({ tool, c, run: i + 1, rubric: loadRubric(tool) })),
    ),
  );

  const rows: JudgeRow[] = [];
  const raw: unknown[] = [];
  const jevMs: number[] = [];
  const judgeMs: number[] = [];
  let jevCostUsd = 0;
  let judgeCostUsd = 0;
  let judgePriced = true;

  await mapLimit(jobs, parallelism(arg("parallel") ?? "4"), async ({ tool, c, run, rubric }) => {
    const out = readExistingOutput(date, tool.slug, c.id, run);
    const tag = `${tool.slug}/${c.id}#${run}`;
    if (!out || unjudgeableReason(out.output)) {
      console.log(`  · ${tag}: no output to judge, skipped`);
      return;
    }
    const { request, asked } = buildJudgeJevRequest({ tool, c, output: out.output }, specs, {
      model: jevModel,
    });
    if (dryRun) {
      console.log(`  · ${tag}: ${asked.length} checks, ${Object.keys(request.questions).length} questions`);
      return;
    }

    // The LLM judge, exactly as `npm run eval` asks it.
    const provider = providerForModel(judgeModel);
    const judgeStart = performance.now();
    // The model's own time when the provider measures it (Claude Code: without the CLI starting).
    let judgeApiMs: number | undefined = 0;
    let judgeText = "";
    let parsed = null;
    for (const maxTokens of JUDGE_MAX_TOKENS) {
      const r = await provider.generate({
        model: judgeModel,
        system: "You output only valid JSON.",
        messages: [{ role: "user", content: buildJudgePrompt(rubric, c, out.output) }],
        temperature: 0,
        maxTokens,
      });
      const cost = r.usage ? listPriceUsd(r.usage, price) : undefined;
      if (cost === undefined) judgePriced = false;
      else judgeCostUsd += cost;
      judgeApiMs = judgeApiMs !== undefined && r.apiMs !== undefined ? judgeApiMs + r.apiMs : undefined;
      judgeText = r.text;
      parsed = parseJudgeResult(r.text);
      if (parsed) break;
    }
    judgeMs.push(judgeApiMs ?? Math.round(performance.now() - judgeStart));

    // Jev on the same output.
    // Nothing to ask (every check decided in code or left to the judge): no call.
    const answer = Object.keys(request.questions).length
      ? await askJev(request, { apiKey })
      : { body: { answers: {} }, ms: undefined };
    if (answer.ms !== undefined) jevMs.push(answer.ms);
    const judged = rowsOf({ tool, c, run, rubric }, out.output, answer.body, judgeText, specs);
    if (judged.costUsd !== undefined) jevCostUsd += judged.costUsd;
    rows.push(...judged.rows);
    raw.push({ key: tag, output: out.output, request, body: answer.body, judge: judgeText });
    console.log(`  ✓ ${tag}`);
  });
  if (dryRun) return;

  const labels = loadLabels(`${date}${label}`);
  rows.sort((a, b) => order(a).localeCompare(order(b)));
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-judge-jev.md`);
  const meta: Meta = {
    date,
    jevModel,
    checksVersion,
    judgeModel,
    jevMs,
    judgeMs,
    jevCostUsd,
    ...(judgePriced ? { judgeCostUsd } : {}),
  };
  writeFileSync(file, judgeJevReport({ ...meta, rows, ...(labels ? { labels } : {}) }));
  writeFileSync(
    join(REPORTS_DIR, `${date}${label}-judge-jev-raw.json`),
    `${JSON.stringify({ meta, raw }, null, 2)}\n`,
  );
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
