/**
 * Pure helpers for the test-dossier notes eval (`npm run eval:dossier-note`, brief P35.2): score
 * a checked concept deterministically against the rules of the prompt. Whether the concept is
 * GOOD for a committee is read by a person in the saved answers (`rubric.md`).
 */
import {
  type DossierNoteInput,
  type DossierNoteParseResult,
  referredQuestions,
} from "../app/lib/courses/dossierNote";

export interface DossierNoteCase {
  id: string;
  locale: "nl" | "en";
  about?: string;
  input: DossierNoteInput;
  /** Question numbers the concept must name: the ones that stand out in the numbers. */
  expectQuestions?: string[];
  /** Text the concept may not contain after the checks: a made-up number from the earlier explanation. */
  forbid?: string[];
  /** Question numbers the concept may not name: questions that are not in the analysis. */
  forbidQuestions?: string[];
}

export interface DossierNoteScore {
  caseId: string;
  parse: boolean;
  words: number;
  questions: number;
  /** 80 to 300 words (the prompt asks 120 to 250), one or two reflection questions. */
  shapeOk: boolean;
  expectOk: boolean;
  /** Forbidden text or questions in what the teacher sees. Must be 0. */
  forbidden: number;
  /** Forbidden text or questions in the model's raw answer, before the checks in code. */
  forbiddenRaw: number;
  dropped: number;
  pass: boolean;
}

function forbiddenIn(c: DossierNoteCase, text: string): number {
  const lower = text.toLowerCase();
  const asked = new Set(referredQuestions(text));
  return (
    (c.forbid ?? []).filter((w) => lower.includes(w.toLowerCase())).length +
    (c.forbidQuestions ?? []).filter((q) => asked.has(q)).length
  );
}

export function scoreDossierNoteCase(
  c: DossierNoteCase,
  raw: string,
  r: DossierNoteParseResult,
): DossierNoteScore {
  const forbiddenRaw = forbiddenIn(c, raw);
  if (!r.ok)
    return {
      caseId: c.id,
      parse: false,
      words: 0,
      questions: 0,
      shapeOk: false,
      expectOk: false,
      forbidden: 0,
      forbiddenRaw,
      dropped: 0,
      pass: false,
    };
  const shown = [r.note.draft, ...r.note.questions].join("\n");
  const words = r.note.draft.split(/\s+/).filter(Boolean).length;
  const named = new Set(referredQuestions(r.note.draft));
  const shapeOk =
    words >= 80 && words <= 300 && r.note.questions.length >= 1 && r.note.questions.length <= 2;
  const expectOk = (c.expectQuestions ?? []).every((q) => named.has(q));
  const forbidden = forbiddenIn(c, shown);
  return {
    caseId: c.id,
    parse: true,
    words,
    questions: r.note.questions.length,
    shapeOk,
    expectOk,
    forbidden,
    forbiddenRaw,
    dropped: r.note.dropped,
    pass: shapeOk && expectOk && forbidden === 0,
  };
}

export function dossierNoteReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: DossierNoteScore[];
  retries?: number;
}): string {
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    `# Eval toelichting bij de toetsanalyse — ${input.date}`,
    "",
    `Prompt: assessment-dossier-notes@v1. Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel; de kwaliteit lees je in de opgeslagen antwoorden (rubric.md).`,
    "",
    "| Case | Geldig JSON | Woorden | Reflectievragen | Vorm ok | Vragen genoemd | Verboden (getoond) | Verboden (ruw) | Weggevallen | Geslaagd |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.parse)} | ${r.words} | ${r.questions} | ${yesNo(r.shapeOk)} | ${yesNo(r.expectOk)} | ${r.forbidden} | ${r.forbiddenRaw} | ${r.dropped} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}. Herkansingen (onleesbaar JSON, zoals de app één keer opnieuw vraagt): ${input.retries ?? 0}.`,
    "",
  ].join("\n");
}
