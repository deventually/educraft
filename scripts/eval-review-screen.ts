/**
 * The quick check before the review team (TypeSafe's Jev): would it skip a reviewer that had
 * something to say? Two steps, because the reviewers and Jev run on different keys:
 *
 *   1. What the reviewers really say, on every case, every reviewer (the truth):
 *      npm run eval:review-screen -- --reviewers --model claude-code::claude-sonnet-5-5 --repeat 2 --parallel 6
 *      → evals/review-screen/reviews.json (committed; the courses are synthetic)
 *   2. Jev's verdicts on the same cases, scored against those reviews:
 *      JEV_API_KEY=… npm run eval:review-screen -- --jev --repeat 3 --label a
 *      → evals/reports/<date><label>-review-screen.md and …-raw.json (every exact request)
 *
 *   … -- --rescore evals/reports/<date><label>-review-screen-raw.json   # report again, no API
 *   … -- --dry-run                                                      # the requests only
 *
 * The questions, the thresholds and the holdout were fixed before step 2 ever ran
 * (`evals/review-screen/README.md`). Never part of CI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAgentReview } from "~/lib/agents/filter";
import { buildReviewMessage, courseKeys } from "~/lib/agents/input";
import { AGENTS } from "~/lib/agents/registry";
import { buildScreenRequest, parseScreenAnswer, screenVerdicts } from "./review-screen/screen";
import { providerForModel } from "~/lib/ai/provider";
import { checkAlignment } from "~/lib/courses/alignment";
import { getRuntimePrompt } from "~/lib/prompts";
import { askJev, JEV_KEY_ENV, JEV_MODEL } from "./eval-evidence-jev-helpers";
import { EVALS_DIR, REPORTS_DIR } from "./eval-files";
import { mapLimit, parallelism } from "./eval-helpers";
import { catalogPrice, listPriceUsd } from "./eval-judge-jev-helpers";
import {
  type HatReview,
  loadScreenCases,
  type ScreenMeta,
  type ScreenRow,
  screenReport,
} from "./eval-review-screen-helpers";

const REVIEWS_FILE = join(EVALS_DIR, "review-screen", "reviews.json");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface ReviewsFile {
  model: string;
  reviews: HatReview[];
}

function loadReviews(): ReviewsFile {
  return existsSync(REVIEWS_FILE)
    ? (JSON.parse(readFileSync(REVIEWS_FILE, "utf8")) as ReviewsFile)
    : { model: "", reviews: [] };
}

function meanReviewCost(f: ReviewsFile): number | undefined {
  const price = catalogPrice(f.model);
  const costs = f.reviews.flatMap((r) => {
    const c = r.usage ? listPriceUsd(r.usage, price) : undefined;
    return c === undefined ? [] : [c];
  });
  return costs.length ? costs.reduce((s, x) => s + x, 0) / costs.length : undefined;
}

/** Step 1: every reviewer on every case, `repeat` times; keeps what is already there. */
async function runReviewers(model: string, repeat: number, parallel: number) {
  const cases = loadScreenCases();
  const file = loadReviews();
  if (file.model && file.model !== model)
    throw new Error(`reviews.json holds ${file.model}; remove it to measure with ${model}`);
  const done = new Set(file.reviews.map((r) => `${r.caseId}/${r.agent}#${r.run}`));
  const jobs = cases.flatMap((c) =>
    AGENTS.flatMap((a) =>
      Array.from({ length: repeat }, (_, i) => ({ c, a, run: i + 1 })).filter(
        (j) => !done.has(`${c.id}/${a.id}#${j.run}`),
      ),
    ),
  );
  console.log(`${jobs.length} reviews to run (${done.size} already in reviews.json)`);
  const reviews = [...file.reviews];
  let n = 0;
  await mapLimit(jobs, parallel, async ({ c, a, run }) => {
    const rejected = c.rejected ?? [];
    const linked = a.watches.includes("generation") ? c.linkedWork : undefined;
    const message = buildReviewMessage(
      { course: c.course, alignment: checkAlignment(c.course), rejected, ...(linked ? { linkedWork: linked } : {}) },
      c.locale,
    );
    const start = performance.now();
    const res = await providerForModel(model)
      .generate({
        model,
        system: getRuntimePrompt(a.promptId, c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 4_000,
      })
      .catch((e: unknown) => {
        console.error(`${c.id}/${a.id}#${run}: ${String(e)}`);
        return null;
      });
    if (!res) return;
    const parsed = parseAgentReview(res.text, c.course, rejected);
    const keys = new Map(Object.entries(courseKeys(c.course)).map(([k, id]) => [id, k]));
    reviews.push({
      caseId: c.id,
      agent: a.id,
      run,
      parsed: parsed.ok,
      findings: parsed.ok
        ? parsed.findings.map((f) => ({
            severity: f.severity,
            ...(f.targetId ? { target: keys.get(f.targetId) ?? f.targetId } : {}),
            message: f.message,
          }))
        : [],
      ...(res.usage ? { usage: res.usage } : {}),
      ms: Math.round(performance.now() - start),
    });
    console.log(`${++n}/${jobs.length} ${c.id}/${a.id}#${run}`);
    // Save as we go: a long run that stops halfway keeps what it did.
    if (n % 10 === 0) writeFileSync(REVIEWS_FILE, `${JSON.stringify({ model, reviews }, null, 1)}\n`);
  });
  reviews.sort((x, y) => `${x.caseId}/${x.agent}#${x.run}`.localeCompare(`${y.caseId}/${y.agent}#${y.run}`));
  writeFileSync(REVIEWS_FILE, `${JSON.stringify({ model, reviews }, null, 1)}\n`);
  console.log(`Reviews: ${REVIEWS_FILE}`);
}

/** The reviewers that read linked work on this case (Jev never sees it, so they always run). */
const withLinked = (c: ReturnType<typeof loadScreenCases>[number]) =>
  c.linkedWork?.length ? AGENTS.filter((a) => a.watches.includes("generation")).map((a) => a.id) : [];

function writeReport(meta: ScreenMeta, rows: ScreenRow[]) {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${meta.date}${meta.label}-review-screen.md`);
  writeFileSync(file, screenReport(meta, loadScreenCases(), rows, loadReviews().reviews));
  console.log(`Report: ${file}`);
}

/** Step 2: one Jev request per case (all reviewers), `repeat` times. */
async function runJev(repeat: number, label: string, dryRun: boolean) {
  const cases = loadScreenCases();
  const agents = AGENTS.map((a) => a.id);
  const apiKey = process.env[JEV_KEY_ENV];
  if (!dryRun && !apiKey) throw new Error(`${JEV_KEY_ENV} is not set`);
  const date = new Date().toISOString().slice(0, 10);
  const rows: ScreenRow[] = [];
  const raw: unknown[] = [];
  for (const c of cases) {
    const request = buildScreenRequest(c.course, agents, c.locale, JEV_MODEL);
    if (dryRun) {
      console.log(`${c.id}: ${Object.keys(request.questions).length} questions`);
      continue;
    }
    for (let i = 1; i <= repeat; i++) {
      const { body, ms } = await askJev(request, { apiKey: apiKey as string });
      const answer = parseScreenAnswer(body);
      raw.push({ caseId: c.id, repeat: i, request, body, ms });
      const verdicts = screenVerdicts(c.course, agents, answer, withLinked(c));
      for (const [agent, verdict] of Object.entries(verdicts))
        rows.push({ set: c.set, caseId: c.id, agent, repeat: i, verdict, ms, ...(answer.costUsd === undefined ? {} : { costUsd: answer.costUsd }) });
      console.log(`${c.id}#${i}: skips ${Object.entries(verdicts).filter(([, v]) => !v.run).map(([a]) => a).join(", ") || "none"}`);
    }
  }
  if (dryRun) return;
  const reviews = loadReviews();
  const meta: ScreenMeta = {
    date,
    label,
    jevModel: JEV_MODEL,
    reviewModel: reviews.model,
    repeat,
    ...(meanReviewCost(reviews) === undefined ? {} : { reviewCostUsd: meanReviewCost(reviews) }),
  };
  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(join(REPORTS_DIR, `${date}${label}-review-screen-raw.json`), `${JSON.stringify({ meta, rows, raw }, null, 1)}\n`);
  writeReport(meta, rows);
}

async function main() {
  if (arg("rescore")) {
    const { meta, rows } = JSON.parse(readFileSync(arg("rescore") as string, "utf8")) as { meta: ScreenMeta; rows: ScreenRow[] };
    writeReport(meta, rows);
    return;
  }
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  if (process.argv.includes("--reviewers")) {
    const model = arg("model");
    if (!model) throw new Error("--reviewers needs --model");
    await runReviewers(model, repeat, parallelism(arg("parallel")));
    return;
  }
  await runJev(repeat, arg("label") ?? "", process.argv.includes("--dry-run"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
