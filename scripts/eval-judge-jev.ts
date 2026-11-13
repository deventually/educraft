/**
 * Jev as judge of the hard checks (experiment, 2026-11-13). Reads the outputs a normal eval run
 * wrote (`npm run eval -- --cases-only`), and has both the LLM judge (the eval's own prompt) and
 * TypeSafe's Jev judge the same outputs, timing and pricing each.
 *
 *   ANTHROPIC_API_KEY=… OPENROUTER_API_KEY=… npm run eval:judge-jev -- --runs 3 --label a
 *   … -- --date 2026-11-13          # the outputs of that day (default: the latest)
 *   … -- --tool mentorai,lesson-plan
 *   npm run eval:judge-jev -- --dry-run   # build the requests only, no API
 *
 * Writes `evals/reports/<date><label>-judge-jev.md` and `…-judge-jev-raw.json` (each exact Jev
 * request with its answer, and the judge's reply). Labels for the rows where the two disagree
 * go in `evals/judge-jev/labels.json` (row key → the check failed); the report scores both
 * judges on them. Never part of CI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { providerForModel } from "~/lib/ai/provider";
import { ALL_TOOLS } from "~/lib/registry";
import { askJev, JEV_MODEL } from "./eval-evidence-jev-helpers";
import {
  EVALS_DIR,
  latestOutputDate,
  loadCases,
  loadRubric,
  REPORTS_DIR,
  readExistingOutput,
} from "./eval-files";
import {
  buildJudgePrompt,
  DEFAULT_JUDGE_MODEL,
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
  listPriceUsd,
  loadJudgeSpecs,
  parseJudgeJevAnswer,
} from "./eval-judge-jev-helpers";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const runs = Math.max(1, Number(arg("runs") ?? 1));
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const jevModel = arg("model") ?? JEV_MODEL;
  const judgeModel = arg("judge-model") ?? DEFAULT_JUDGE_MODEL;
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!dryRun && !apiKey) throw new Error("needs OPENROUTER_API_KEY");
  const date = arg("date") ?? latestOutputDate();
  if (!date) throw new Error("No outputs yet: run `npm run eval -- --cases-only` first.");
  const only = arg("tool")?.split(",");
  const specs = loadJudgeSpecs();
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
      judgeText = r.text;
      parsed = parseJudgeResult(r.text);
      if (parsed) break;
    }
    judgeMs.push(Math.round(performance.now() - judgeStart));
    const judgedIds = parseHardChecks(rubric)
      .filter((h) => !h.counted)
      .map((h) => h.id);
    const { kept } = verifyEvidence(
      (parsed?.failedChecks ?? []).filter((id) => judgedIds.includes(id)),
      parsed?.evidence,
      out.output,
    );

    // Jev on the same output.
    // Nothing to ask (every check decided in code or left to the judge): no call.
    const answer = Object.keys(request.questions).length
      ? await askJev(request, { apiKey })
      : { body: { answers: {} }, ms: undefined };
    if (answer.ms !== undefined) jevMs.push(answer.ms);
    const jev = parseJudgeJevAnswer(answer.body, tool, c, specs);
    if (jev.costUsd !== undefined) jevCostUsd += jev.costUsd;

    for (const check of judgedIds) {
      const v = jev.verdicts[check];
      rows.push({
        tool: tool.slug,
        caseId: c.id,
        run,
        check,
        holdout: specs.holdout.includes(tool.slug),
        jev: v?.verdict ?? "unsettled",
        ...(v?.p !== undefined ? { jevP: v.p } : {}),
        sonnet: kept.includes(check),
      });
    }
    raw.push({ key: tag, request, body: answer.body, judge: judgeText });
    console.log(`  ✓ ${tag}`);
  });
  if (dryRun) return;

  const labelsFile = join(EVALS_DIR, "judge-jev", "labels.json");
  const labels = existsSync(labelsFile)
    ? (JSON.parse(readFileSync(labelsFile, "utf8")) as { labels: Record<string, boolean> }).labels
    : undefined;
  const order = (r: JudgeRow) => `${r.tool}/${r.caseId}/${r.run}/${r.check}`;
  rows.sort((a, b) => order(a).localeCompare(order(b)));
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-judge-jev.md`);
  writeFileSync(
    file,
    judgeJevReport({
      date,
      jevModel,
      judgeModel,
      rows,
      jevMs,
      judgeMs,
      jevCostUsd,
      ...(judgePriced ? { judgeCostUsd } : {}),
      ...(labels ? { labels } : {}),
    }),
  );
  writeFileSync(join(REPORTS_DIR, `${date}${label}-judge-jev-raw.json`), `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
