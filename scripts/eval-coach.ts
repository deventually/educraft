/**
 * Portfolio-coach eval (brief P25, 25.5). Runs the REAL coach prompt and the
 * REAL code checks on synthetic cases with a known flaw, and scores the result
 * deterministically (no judge model).
 *
 *   ANTHROPIC_API_KEY=… npm run eval:coach                 # public cases
 *   EVALS_PRIVATE_DIR=~/… npm run eval:coach -- --repeat 3 # + private cases, 3 runs each
 *   npm run eval:coach -- --dry-run                        # build messages only, no API
 *
 * Private cases (`<EVALS_PRIVATE_DIR>/*.json`, same shape as cases.json) never
 * enter the repo: the report names only their case ids and scores. Costs roughly
 * €1–3 per run (BESLUIT-2026-11-04-18). Never part of CI.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { getRuntimePrompt } from "~/lib/prompts";
import { buildCoachMessage, parseCoachReview } from "~/lib/portfolio/coach";
import {
  type CoachCase,
  type CoachScore,
  OUTCOME_ID,
  caseToDossier,
  coachReportMarkdown,
  scoreCoachCase,
} from "./eval-coach-helpers";

const EVALS_DIR = join(process.cwd(), "evals");
const REPORTS_DIR = join(EVALS_DIR, "reports");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadCases(): { c: CoachCase; private: boolean }[] {
  const pub = JSON.parse(readFileSync(join(EVALS_DIR, "portfolio-coach", "cases.json"), "utf8"))
    .cases as CoachCase[];
  const dir = process.env.EVALS_PRIVATE_DIR;
  const priv: CoachCase[] =
    dir && existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".json"))
          .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")).cases as CoachCase[])
      : [];
  return [
    ...pub.map((c) => ({ c, private: false })),
    ...priv.map((c) => ({ c, private: true })),
  ];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const model = arg("model") ?? DEFAULT_MODEL;
  const cases = loadCases();
  const rows: (CoachScore & { private: boolean })[] = [];

  for (const { c, private: isPrivate } of cases) {
    const d = caseToDossier(c);
    const message = buildCoachMessage(d, OUTCOME_ID, c.locale);
    if (dryRun) {
      console.log(`${c.id}: ${message.length} chars`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      const { text } = await providerForModel(model).generate({
        model,
        system: getRuntimePrompt("portfolio-coach@v1", c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 4_000,
      });
      const score = scoreCoachCase(c, parseCoachReview(text, d, OUTCOME_ID));
      rows.push({ ...score, caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id, private: isPrivate });
      console.log(`${score.pass ? "✓" : "×"} ${c.id}${repeat > 1 ? `#${i + 1}` : ""}`);
    }
  }
  if (dryRun) return;

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}-portfolio-coach.md`);
  writeFileSync(file, coachReportMarkdown({ date, model, repeat, rows }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
