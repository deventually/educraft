/**
 * Feedforward eval (brief P38.3). Runs the REAL prompt, the REAL message builder and the REAL code
 * checks on fictional, already anonymised drafts with a previous round, and scores
 * deterministically (no judge model). Whether the feedforward is good, a person reads in the saved
 * answers (`rubric.md`).
 *
 *   npm run eval:feedforward -- --model claude-code::claude-sonnet-5-5 --parallel 6
 *   ANTHROPIC_API_KEY=… npm run eval:feedforward -- --repeat 3   # final measurement
 *   npm run eval:feedforward -- --dry-run                        # build messages only
 *
 * Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import { getRuntimePrompt } from "~/lib/prompts";
import { buildFeedforwardMessage, parseFeedforward } from "~/lib/tracks/feedforward";
import {
  type FeedforwardCase,
  type FeedforwardScore,
  feedforwardReportMarkdown,
  scoreFeedforwardCase,
} from "./eval-feedforward-helpers";

const EVALS_DIR = join(process.cwd(), "evals");
const STEP = "feedforward";
const PROMPT_ID = `${STEP}@v1`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const parallel = Math.max(1, Number(arg("parallel") ?? 1));
  const model = arg("model") ?? DEFAULT_MODEL;
  const label = arg("label") ?? "";
  const only = arg("case");
  const cases = (
    JSON.parse(readFileSync(join(EVALS_DIR, STEP, "cases.json"), "utf8")).cases as FeedforwardCase[]
  ).filter((c) => !only || c.id === only);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = join(EVALS_DIR, "output", date, STEP);
  mkdirSync(outDir, { recursive: true });
  let retries = 0;

  const jobs = cases.flatMap((c) => Array.from({ length: repeat }, (_, i) => ({ c, i })));
  if (dryRun) {
    for (const c of cases)
      console.log(`--- ${c.id}\n${buildFeedforwardMessage({ criteria: c.criteria, version: c.version, previous: c.previous ?? [], context: c.context ?? "" })}\n`);
    return;
  }

  async function run({ c, i }: { c: FeedforwardCase; i: number }): Promise<FeedforwardScore> {
    const previous = c.previous ?? [];
    const message = buildFeedforwardMessage({
      criteria: c.criteria,
      version: c.version,
      previous,
      context: c.context ?? "",
    });
    // The app's own budget, temperature and single retry (app/server/trackFeedforward.server.ts).
    const ask = async () =>
      (
        await providerForModel(model).generate({
          model,
          system: getRuntimePrompt(PROMPT_ID, c.locale),
          messages: [{ role: "user", content: message }],
          temperature: 0,
          maxTokens: 4_000,
        })
      ).text;
    const check = (text: string) => parseFeedforward(text, { version: c.version, previous });
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
    const score = scoreFeedforwardCase(c, parsed, texts.at(-1) ?? "");
    const caseId = repeat > 1 ? `${c.id}#${i + 1}` : c.id;
    console.log(`${score.pass ? "✓" : "×"} ${caseId}`);
    return { ...score, caseId };
  }

  // Up to `parallel` runs at once, results in case order.
  const rows: FeedforwardScore[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(parallel, jobs.length) }, async () => {
      while (next < jobs.length) {
        const k = next++;
        const job = jobs[k];
        if (job) rows[k] = await run(job);
      }
    }),
  );

  const reports = join(EVALS_DIR, "reports");
  mkdirSync(reports, { recursive: true });
  const file = join(reports, `${date}${label}-${STEP}.md`);
  writeFileSync(file, feedforwardReportMarkdown({ date, model, repeat, rows, retries }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
