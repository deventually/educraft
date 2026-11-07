/**
 * Rehearsal-assessment eval (brief P29, 29.2). Plays the REAL rehearsal prompt
 * against a scripted teacher on synthetic dossiers, runs the REAL feedback
 * checks (`parseRehearsalFeedback`), and lets a judge model score the whole
 * conversation against `evals/portfolio-rehearsal/rubric.md`. Hard checks that
 * can be counted are counted in code (`REHEARSAL_COUNTED`).
 *
 *   ANTHROPIC_API_KEY=… npm run eval:rehearsal                   # 1 run per case
 *   ANTHROPIC_API_KEY=… npm run eval:rehearsal -- --runs 3       # final measurement
 *   ANTHROPIC_API_KEY=… npm run eval:rehearsal -- --batch        # judge at half price
 *   EVALS_PRIVATE_DIR=~/… npm run eval:rehearsal                 # + private cases
 *   npm run eval:rehearsal -- --dry-run                          # build prompts only, no API
 *
 * The conversation itself never goes through a batch: every turn waits on the
 * previous one (same as chat tools in `npm run eval`). Private cases never enter
 * the repo; the report names only their ids and scores. Never part of CI.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import type { LLMProvider } from "~/lib/ai/types";
import {
  REHEARSAL_PROMPT_ID,
  buildRehearsalContext,
  parseRehearsalFeedback,
} from "~/lib/portfolio/rehearsal";
import { buildSystemPrompt, reinforceLanguage } from "~/lib/template/buildSystemPrompt";
import { anthropicSubmit, createBatchingProvider } from "./eval-batch";
import {
  JUDGE_MAX_TOKENS,
  type ReportRow,
  applyHardChecks,
  buildReportMarkdown,
  countWords,
  hardChecksInstruction,
  meanScores,
  parseHardChecks,
  parseJudgeResult,
  rubricForJudge,
  runSpread,
  DEFAULT_JUDGE_MODEL,
} from "./eval-helpers";
import {
  type RehearsalCase,
  REHEARSAL_COUNTED,
  type Turn,
  formatTranscript,
} from "./eval-rehearsal-helpers";

const TOOL = "portfolio-rehearsal";
const EVALS_DIR = join(process.cwd(), "evals");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadCases(): RehearsalCase[] {
  const pub = JSON.parse(readFileSync(join(EVALS_DIR, TOOL, "cases.json"), "utf8"))
    .cases as RehearsalCase[];
  const dir = process.env.EVALS_PRIVATE_DIR;
  const priv: RehearsalCase[] =
    dir && existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.startsWith(TOOL) && f.endsWith(".json"))
          .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")).cases as RehearsalCase[])
      : [];
  return [...pub, ...priv];
}

function systemFor(c: RehearsalCase): { system: string; keys: Record<string, string> } {
  const { values, keys } = buildRehearsalContext(c.dossier, { length: c.length, locale: c.locale });
  return {
    keys,
    system: buildSystemPrompt({ promptId: REHEARSAL_PROMPT_ID, values, outputLanguage: c.locale }),
  };
}

/** Plays the scripted teacher; the committee's last turn is the feedback. */
async function play(c: RehearsalCase, system: string, model: string): Promise<Turn[]> {
  const provider = providerForModel(model);
  const turns: Turn[] = [];
  for (const content of c.teacherTurns) {
    turns.push({ role: "user", content });
    const { text } = await provider.generate({
      model,
      system,
      messages: reinforceLanguage(turns, c.locale),
      temperature: 0.7,
      maxTokens: 2_000,
    });
    turns.push({ role: "assistant", content: text });
  }
  return turns;
}

const JUDGE_SPINE = `You are a strict but fair evaluator of an AI that plays an assessment committee in a practice interview. Score the TRANSCRIPT against the RUBRIC. Reply with ONLY a JSON object, no prose, in this exact shape:
{"scores": {"taskFidelity": 1-5, "pedagogicalSoundness": 1-5, "formatAdherence": 1-5, "levelFit": 1-5, "languageQuality": 1-5}, "checks": {"<hard check id>": true|false}, "worst": "<the single weakest aspect, one phrase>", "verdict": "<one sentence>"}
Integer scores 1 (poor) to 5 (excellent). A 5 means you found nothing to improve after looking for problems. Be harsh on fabricated facts.`;

async function judge(
  provider: LLMProvider,
  judgeModel: string,
  rubric: string,
  c: RehearsalCase,
  transcript: string,
) {
  const checks = parseHardChecks(rubric).filter((x) => !x.counted);
  const prompt = [
    JUDGE_SPINE,
    `\n# RUBRIC\n${rubricForJudge(rubric)}`,
    `\n# HARD CHECKS\n${hardChecksInstruction(checks)}`,
    `\n# CASE\nid: ${c.id}\nlanguage: ${c.locale}\nthinnest: ${c.thinnest ?? "n/a"}\ndescription: ${c.description}`,
    `\n# DOSSIER\n${JSON.stringify(c.dossier, null, 2)}`,
    `\n# TRANSCRIPT\n${transcript}`,
  ].join("\n");
  const ask = async (maxTokens: number) =>
    parseJudgeResult(
      (
        await provider.generate({
          model: judgeModel,
          system: "You output only valid JSON.",
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          maxTokens,
        })
      ).text,
    );
  return (await ask(JUDGE_MAX_TOKENS[0])) ?? (await ask(JUDGE_MAX_TOKENS[1]));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const runs = Math.max(1, Number(arg("runs") ?? 1));
  const model = arg("model") ?? DEFAULT_MODEL;
  const judgeModel = arg("judge-model") ?? DEFAULT_JUDGE_MODEL;
  const rubric = readFileSync(join(EVALS_DIR, TOOL, "rubric.md"), "utf8");
  const checks = parseHardChecks(rubric);
  const cases = loadCases();

  if (dryRun) {
    for (const c of cases) console.log(`${c.id}: ${countWords(systemFor(c).system)} words`);
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  const judgeProvider =
    process.argv.includes("--batch") && key
      ? createBatchingProvider(anthropicSubmit(key))
      : providerForModel(judgeModel);

  const date = new Date().toISOString().slice(0, 10);
  const outDir = join(EVALS_DIR, "output", date, TOOL);
  mkdirSync(outDir, { recursive: true });

  const rows: ReportRow[] = await Promise.all(
    cases.map(async (c) => {
      const { system, keys } = systemFor(c);
      const perRun = await Promise.all(
        Array.from({ length: runs }, async (_, i) => {
          const turns = await play(c, system, model);
          const transcript = formatTranscript(turns);
          const teacher = turns.filter((t) => t.role === "user").map((t) => t.content);
          const last = turns.at(-1)?.content ?? "";
          const parsed = parseRehearsalFeedback(last, keys, c.dossier, teacher);
          const feedback = parsed.ok ? parsed.feedback : null;
          writeFileSync(join(outDir, `${c.id}.run${i + 1}.md`), transcript, "utf8");
          const counted = checks
            .filter((x) => x.counted && REHEARSAL_COUNTED[x.id]?.({ transcript, feedback }))
            .map((x) => x.id);
          const verdict = await judge(judgeProvider, judgeModel, rubric, c, transcript);
          const failed = [...(verdict?.failedChecks ?? []), ...counted];
          console.log(`${c.id}#${i + 1}: ${failed.length ? failed.join(", ") : "no failed checks"}`);
          return {
            scores: verdict ? applyHardChecks(verdict.scores, failed, checks) : {},
            failed,
          };
        }),
      );
      const judged = perRun.filter((r) => Object.keys(r.scores).length > 0);
      return {
        tool: TOOL,
        caseId: c.id,
        scores: meanScores(judged.map((r) => r.scores)),
        model,
        promptWords: countWords(system),
        runs,
        notJudgedRuns: runs - judged.length || undefined,
        spread: runSpread(judged.map((r) => r.scores)),
        failedChecks: [...new Set(perRun.flatMap((r) => r.failed))],
      };
    }),
  );

  const reports = join(EVALS_DIR, "reports");
  mkdirSync(reports, { recursive: true });
  const file = join(reports, `${date}-${TOOL}.md`);
  writeFileSync(file, buildReportMarkdown({ date, rows }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
