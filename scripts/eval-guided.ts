/**
 * Guided-writing eval (BDB/BKE plan, step 6). Runs the REAL questions prompt and the REAL
 * section-paragraph prompt with the app's own messages and code checks on synthetic cases, and
 * scores both deterministically (no judge model): two to four open questions on the right
 * topics, and a paragraph that keeps the teacher's facts, invents no numbers, leaves an open
 * spot where the material has a gap and follows no instruction hidden in the evidence.
 *
 *   ANTHROPIC_API_KEY=… npm run eval:guided                      # every case once
 *   ANTHROPIC_API_KEY=… npm run eval:guided -- --repeat 3        # consistency
 *   ANTHROPIC_API_KEY=… npm run eval:guided -- --label b         # <date>b-portfolio-guided.md
 *   npm run eval:guided -- --dry-run                             # build messages only, no API
 *
 * The paragraph is written from the case's own fixed answers, so the two steps are scored
 * apart. The model is the app default (config/models.json) unless `--model` says otherwise.
 * Costs well under €1 per run. Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { getRuntimePrompt } from "~/lib/prompts";
import {
  buildQuestionsMessage,
  buildSectionDraftMessage,
  DRAFT_PROMPT_ID,
  parseQuestions,
  checkSectionDraft,
  retryDraftMessage,
  QUESTIONS_PROMPT_ID,
} from "~/lib/portfolio/guided";
import {
  caseDossier,
  type GuidedCase,
  type GuidedRow,
  guidedReportMarkdown,
  scoreDraft,
  scoreQuestions,
} from "./eval-guided-helpers";

const EVALS_DIR = join(process.cwd(), "evals");
const REPORTS_DIR = join(EVALS_DIR, "reports");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function ask(model: string, promptId: string, locale: "nl" | "en", message: string) {
  const { text } = await providerForModel(model).generate({
    model,
    system: getRuntimePrompt(promptId, locale),
    messages: [{ role: "user", content: message }],
    temperature: 0,
    maxTokens: 1_500,
  });
  return text;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const model = arg("model") ?? DEFAULT_MODEL;
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const cases = JSON.parse(readFileSync(join(EVALS_DIR, "portfolio-guided", "cases.json"), "utf8"))
    .cases as GuidedCase[];
  const rows: GuidedRow[] = [];

  for (const c of cases) {
    const { data, outcomeId, sectionId, course } = caseDossier(c);
    const references = data.references.map((r) => r.apa);
    const questionsMessage = buildQuestionsMessage(data, outcomeId, sectionId, c.locale, course);
    const chapter = c.chapter ?? "";
    const draftMessage = buildSectionDraftMessage(
      data,
      outcomeId,
      sectionId,
      chapter,
      c.locale,
      course,
    );
    if (!draftMessage) throw new Error(`${c.id}: no material for a paragraph`);
    if (dryRun) {
      console.log(`${c.id}: ${questionsMessage.length} + ${draftMessage.length} chars`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      const questions = parseQuestions(
        await ask(model, QUESTIONS_PROMPT_ID, c.locale, questionsMessage),
        references,
      );
      // As the app does: one more try, told which sources to leave out.
      let message = draftMessage;
      let paragraph: string | null = null;
      let refused = "";
      for (let attempt = 0; attempt < 2 && paragraph === null; attempt++) {
        refused = await ask(model, DRAFT_PROMPT_ID, c.locale, message);
        const checked = checkSectionDraft(refused, references);
        if (checked.ok) paragraph = checked.text;
        else message = retryDraftMessage(message, checked.unknown, c.locale);
      }
      const row = {
        caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id,
        questions: scoreQuestions(c, questions),
        draft: scoreDraft(c, paragraph),
      };
      rows.push(row);
      const mark = (b: boolean) => (b ? "✓" : "×");
      console.log(`${mark(row.questions.pass)}${mark(row.draft.pass)} ${row.caseId}`);
      if (!row.questions.pass) console.log(`   vragen: ${JSON.stringify(questions)}`);
      if (!row.draft.pass) console.log(`   alinea: ${paragraph ?? `(geweigerd) ${refused}`}`);
    }
  }
  if (dryRun) return;

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-portfolio-guided.md`);
  writeFileSync(file, guidedReportMarkdown({ date, model, repeat, rows }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
