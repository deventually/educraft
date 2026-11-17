/**
 * Jev counts the themes of a course evaluation (experiment): the REAL course evaluation
 * (`course-evaluation@v1`, the real message, the real checks, its one retry), then Jev on every
 * answer of the survey with one yes/no per theme (`app/lib/courses/themeCountJev.ts`), counted in
 * code. In the same request per answer, Jev also gets the true themes of the case, so its judgment
 * per answer is measured against the truth in `evals/evaluation-jev/cases.json`.
 *
 *   JEV_API_KEY=… npm run eval:evaluation-jev -- --llm-model claude-code::claude-sonnet-5-5 --repeat 3 --label a
 *   npm run eval:evaluation-jev -- --dry-run          # the Jev requests of the first answers, no API
 *
 * Writes `evals/reports/<date><label>-evaluation-jev.md` and `…-evaluation-jev-raw.json` (every
 * exact Jev request with its answer, and every LLM answer). Never part of CI.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import { buildEvaluationMessage, parseEvaluation } from "~/lib/courses/evaluation";
import {
  buildThemeCountRequest,
  type CountTheme,
  countThemes,
  mentionVerdict,
  parseThemeCountAnswer,
} from "~/lib/courses/themeCountJev";
import { getRuntimePrompt } from "~/lib/prompts";
import { caseCourse, caseTestAnalysis } from "./eval-evaluation-helpers";
import {
  type AnswerRow,
  goldCount,
  goldThemesFor,
  loadThemeCountCases,
  type ThemeRow,
  themeCountReport,
} from "./eval-evaluation-jev-helpers";
import { askJev, JEV_KEY_ENV, JEV_MODEL } from "./eval-evidence-jev-helpers";
import { REPORTS_DIR } from "./eval-files";
import { mapLimit, parallelism } from "./eval-helpers";

const PROMPT_ID = "course-evaluation@v1";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const jevModel = arg("model") ?? JEV_MODEL;
  const llmModel = arg("llm-model") ?? DEFAULT_MODEL;
  const apiKey = process.env[JEV_KEY_ENV] ?? "";
  if (!dryRun && !apiKey) throw new Error(`needs ${JEV_KEY_ENV}`);
  const only = arg("case");
  const cases = loadThemeCountCases().filter((c) => !only || c.case.id === only);
  const limit = parallelism(arg("parallel") ?? "6");

  const themeRows: ThemeRow[] = [];
  const answerRows: AnswerRow[] = [];
  const raw: unknown[] = [];
  const jevMs: number[] = [];
  let jevCostUsd = 0;

  for (const tc of cases) {
    const c = tc.case;
    // The true themes under their own keys, so they never collide with the LLM's.
    const gold: CountTheme[] = tc.themes.map((t, i) => ({ ...t, key: `g${i + 1}` }));
    if (dryRun) {
      for (const answer of tc.answers.slice(0, 2))
        console.log(`--- ${c.id}\n${JSON.stringify(buildThemeCountRequest(answer, gold, c.locale, jevModel), null, 2)}\n`);
      continue;
    }
    const data = caseCourse(c);
    const message = buildEvaluationMessage({
      name: c.name,
      data,
      evaluation: c.evaluation,
      respondents: c.respondents,
      testAnalysis: caseTestAnalysis(c),
      context: c.context ?? "",
    });
    for (let run = 1; run <= repeat; run++) {
      const id = `${c.id}#${run}`;
      // The LLM, as the app asks it (app/server/courseEvaluation.server.ts), with its one retry.
      const ask = async () =>
        (
          await providerForModel(llmModel).generate({
            model: llmModel,
            system: getRuntimePrompt(PROMPT_ID, c.locale),
            messages: [{ role: "user", content: message }],
            temperature: 0,
            maxTokens: 6_000,
          })
        ).text;
      const check = (text: string) =>
        parseEvaluation(text, { data, evaluation: c.evaluation, respondents: c.respondents });
      const texts = [await ask()];
      let parsed = check(texts[0] ?? "");
      if (!parsed.ok) {
        texts.push(await ask());
        parsed = check(texts[1] ?? "");
      }
      raw.push({ case: c.id, run, llm: texts });
      const llmThemes = parsed.ok ? parsed.evaluation.themes : [];
      if (!parsed.ok) console.log(`  × ${id}: the evaluation gave no usable answer`);
      const asked: CountTheme[] = llmThemes.map((t, i) => ({
        key: `l${i + 1}`,
        label: t.label,
        polarity: t.polarity,
      }));

      // Jev: one request per answer, the LLM's themes and the true ones together.
      const answers = await mapLimit(tc.answers, limit, async (answer) => {
        const request = buildThemeCountRequest(answer, [...asked, ...gold], c.locale, jevModel);
        try {
          const r = await askJev(request, { apiKey });
          jevMs.push(r.ms);
          raw.push({ case: c.id, run, request, body: r.body });
          return parseThemeCountAnswer(r.body);
        } catch (e) {
          // A failed call is an error, never an answer (TypeSafe's skill): unanswered.
          raw.push({ case: c.id, run, request, error: String(e) });
          return { usable: false, mentions: {} };
        }
      });
      for (const a of answers) if (a.costUsd !== undefined) jevCostUsd += a.costUsd;

      const counts = countThemes(answers, asked.map((t) => t.key));
      llmThemes.forEach((t, i) => {
        const g = goldThemesFor(t.quotes, tc.answers, tc.lines);
        themeRows.push({
          caseId: id,
          label: t.label,
          gold: g,
          goldCount: goldCount(g, tc.lines),
          llmCount: t.count,
          jev: counts[`l${i + 1}`] ?? { count: 0, unsettled: 0, unanswered: tc.answers.length },
        });
      });
      gold.forEach((g, gi) => {
        const theme = tc.themes[gi]!.key;
        answers.forEach((a, li) =>
          answerRows.push({
            caseId: id,
            theme,
            truth: (tc.lines[li] ?? []).includes(theme),
            verdict: mentionVerdict(a, g.key),
          }),
        );
      });
      console.log(`  ✓ ${id}: ${llmThemes.length} themes, ${tc.answers.length} answers`);
    }
  }
  if (dryRun) return;

  const date = new Date().toISOString().slice(0, 10);
  const meta = { date, llmModel, jevModel, repeat, jevMs, jevCostUsd };
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-evaluation-jev.md`);
  writeFileSync(file, themeCountReport({ ...meta, themes: themeRows, perAnswer: answerRows }));
  writeFileSync(
    join(REPORTS_DIR, `${date}${label}-evaluation-jev-raw.json`),
    `${JSON.stringify({ meta, themes: themeRows, perAnswer: answerRows, raw }, null, 2)}\n`,
  );
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
