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
 *   npm run eval:guided -- --show                                # print every paragraph too
 *   npm run eval:guided -- --draft-prompt portfolio-draft@v3 --no-style-retry  # a before-measurement
 *   npm run eval:guided -- --follow-up                           # also score following up
 *   npm run eval:guided -- --voice                               # a judge scores the voice too
 *   npm run eval:guided -- --calibrate                           # check the voice judge only
 *   npm run eval:guided -- --parallel 6                          # six cases at once
 *
 * The voice judge (`--voice`, `--judge-model`, the app default unless set) scores each
 * paragraph blind on three dimensions (rubric.md, "Voice judge"). `--calibrate` runs it only
 * on its own calibration set, never on the cases, and writes <date>-voice-calibration.md.
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
  buildFollowUpMessage,
  buildQuestionsMessage,
  buildSectionDraftMessage,
  DRAFT_PROMPT_ID,
  FOLLOW_UP_PROMPT_ID,
  parseFollowUps,
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
  scoreFollowUps,
  scoreQuestions,
} from "./eval-guided-helpers";
import {
  buildVoiceJudgePrompt,
  calibrationAgreement,
  calibrationReportMarkdown,
  parseVoiceVerdict,
  type VoiceCalibrationItem,
  type VoiceMaterial,
  type VoiceVerdict,
  voiceJudgeRubric,
  voiceMaterial,
  wordReuse,
} from "./eval-guided-voice";
import { DEFAULT_JUDGE_MODEL, JUDGE_MAX_TOKENS, mapLimit, parallelism } from "./eval-helpers";

const EVALS_DIR = join(process.cwd(), "evals");
const REPORTS_DIR = join(EVALS_DIR, "reports");
const CASES_DIR = join(EVALS_DIR, "portfolio-guided");

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

/** The voice judge's verdict on one paragraph; a second, longer try when the first is unusable. */
async function judgeVoice(
  judgeModel: string,
  rubric: string,
  m: VoiceMaterial,
  paragraph: string,
): Promise<VoiceVerdict | null> {
  const prompt = buildVoiceJudgePrompt(rubric, m, paragraph);
  for (const maxTokens of JUDGE_MAX_TOKENS) {
    const { text } = await providerForModel(judgeModel).generate({
      model: judgeModel,
      system: "You output only valid JSON.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      maxTokens,
    });
    const verdict = parseVoiceVerdict(text);
    if (verdict) return verdict;
  }
  return null;
}

async function calibrate(judgeModel: string, rubric: string, label: string, parallel: number) {
  const items = JSON.parse(readFileSync(join(CASES_DIR, "voice-calibration.json"), "utf8"))
    .items as VoiceCalibrationItem[];
  const rows = await mapLimit(items, parallel, async (item) => {
    const verdict = await judgeVoice(judgeModel, rubric, item.material, item.paragraph);
    const ok = calibrationAgreement(item, verdict?.scores ?? null);
    console.log(`${ok ? "✓" : "×"} ${item.id}: ${JSON.stringify(verdict?.scores ?? null)}`);
    return { item, verdict };
  });
  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-voice-calibration.md`);
  writeFileSync(file, calibrationReportMarkdown({ date, judgeModel, rows }));
  console.log(`Report: ${file}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const show = process.argv.includes("--show");
  // A before-measurement runs the old paragraph prompt the way the app ran it then.
  const draftPrompt = arg("draft-prompt") ?? DRAFT_PROMPT_ID;
  const styleRetry = !process.argv.includes("--no-style-retry");
  const withFollowUp = process.argv.includes("--follow-up");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const model = arg("model") ?? DEFAULT_MODEL;
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const withVoice = process.argv.includes("--voice");
  const judgeModel = arg("judge-model") ?? DEFAULT_JUDGE_MODEL;
  const parallel = parallelism(arg("parallel"));
  const rubric = voiceJudgeRubric(readFileSync(join(CASES_DIR, "rubric.md"), "utf8"));
  if (process.argv.includes("--calibrate")) {
    if (!dryRun) await calibrate(judgeModel, rubric, label, parallel);
    return;
  }
  const cases = JSON.parse(readFileSync(join(CASES_DIR, "cases.json"), "utf8"))
    .cases as GuidedCase[];
  const jobs: (() => Promise<GuidedRow>)[] = [];

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
    for (let i = 0; i < repeat; i++) jobs.push(async () => {
      const questions = parseQuestions(
        await ask(model, QUESTIONS_PROMPT_ID, c.locale, questionsMessage),
        references,
      );
      // As the app does: one more try, told which sources to leave out or phrases to rewrite.
      let message = draftMessage;
      let paragraph: string | null = null;
      let refused = "";
      for (let attempt = 0; attempt < 2 && paragraph === null; attempt++) {
        refused = await ask(model, draftPrompt, c.locale, message);
        const checked = checkSectionDraft(refused, references, {
          style: styleRetry && attempt === 0,
        });
        if (checked.ok) paragraph = checked.text;
        else message = retryDraftMessage(message, checked.unknown, c.locale, checked.generic);
      }
      const followUps = withFollowUp
        ? parseFollowUps(
            await ask(
              model,
              FOLLOW_UP_PROMPT_ID,
              c.locale,
              buildFollowUpMessage(data, outcomeId, sectionId, c.locale, course),
            ),
            references,
            c.answers.map((a) => a.question),
          )
        : undefined;
      const material = voiceMaterial(c);
      const voice = withVoice
        ? {
            verdict: paragraph ? await judgeVoice(judgeModel, rubric, material, paragraph) : null,
            reuse: paragraph ? wordReuse(material, paragraph) : null,
          }
        : undefined;
      const row: GuidedRow = {
        caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id,
        questions: scoreQuestions(c, questions),
        draft: scoreDraft(c, paragraph),
        ...(followUps === undefined ? {} : { followUps: scoreFollowUps(c, followUps) }),
        ...(voice ? { voice } : {}),
      };
      const mark = (b: boolean) => (b ? "✓" : "×");
      console.log(`${mark(row.questions.pass)}${mark(row.draft.pass)} ${row.caseId}`);
      if (!row.questions.pass) console.log(`   vragen: ${JSON.stringify(questions)}`);
      if (followUps !== undefined && (show || !row.followUps?.pass))
        console.log(`   doorvragen: ${JSON.stringify(followUps)}`);
      if (show || !row.draft.pass)
        console.log(`   alinea: ${paragraph ?? `(geweigerd) ${refused}`}`);
      if (voice) console.log(`   stem: ${JSON.stringify(voice.verdict?.scores ?? null)}`);
      return row;
    });
  }
  if (dryRun) return;
  // The rows keep the cases' order, however many run at once.
  const rows = await mapLimit(jobs, parallel, (job) => job());

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-portfolio-guided.md`);
  writeFileSync(file, guidedReportMarkdown({
      date,
      model,
      repeat,
      rows,
      draftPrompt,
      styleRetry,
      ...(withVoice ? { judgeModel } : {}),
    }),);
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
