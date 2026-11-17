/**
 * The voice judge of the guided-writing eval (`npm run eval:guided -- --voice`): does a
 * paragraph sound like the teacher? A judge model scores it blind on three dimensions
 * (`evals/portfolio-guided/rubric.md`, "Voice judge"); `wordReuse` counts how much of it is
 * literally the teacher's. Calibrated on its own set (`voice-calibration.json`), never on the
 * cases it measures. Pure: no provider, no network.
 */
import { splitOnMarkers } from "../app/lib/portfolio/openSpots";
import { parseJudgeResult } from "./eval-helpers";
import { caseCourse, type GuidedCase } from "./eval-guided-helpers";

export const VOICE_DIMENSIONS = ["ownWords", "onlyAnswers", "plainFirstPerson"] as const;
type VoiceDimension = (typeof VOICE_DIMENSIONS)[number];

export interface VoiceVerdict {
  scores: Record<VoiceDimension, number>;
  /** The sentence the judge found weakest. */
  worst: string;
}

/** What the teacher gave: the only ground the paragraph may stand on. */
export interface VoiceMaterial {
  locale: "nl" | "en";
  criteria: string[];
  answers: { question: string; answer: string }[];
  evidence: { title: string; text: string }[];
  /** The `<course>` block of the anchor, as the app sends it; "" without one. */
  course?: string;
}

export interface VoiceCalibrationItem {
  id: string;
  note: string;
  material: VoiceMaterial;
  paragraph: string;
  /** The range a sound judge gives, per dimension it says something about. */
  expect: Partial<Record<VoiceDimension, [number, number]>>;
}

export function voiceMaterial(c: GuidedCase): VoiceMaterial {
  return {
    locale: c.locale,
    criteria: c.criteria.map((x) => x.text),
    answers: c.answers,
    evidence: c.evidence.map((e) => ({ title: e.title, text: e.text })),
    course: caseCourse(c),
  };
}

/** The rubric's "## Voice judge" section: what the judge reads. */
export function voiceJudgeRubric(rubric: string): string {
  const start = rubric.search(/^## Voice judge\s*$/m);
  if (start < 0) throw new Error("rubric.md has no '## Voice judge' section");
  const rest = rubric.slice(start);
  const end = rest.slice(1).search(/^## /m);
  return (end < 0 ? rest : rest.slice(0, end + 1)).trim();
}

const SPINE = `You judge whether a paragraph for a teacher's portfolio sounds like that teacher. You see the teacher's own material (the criteria, the teacher's answers to questions, linked evidence) and a paragraph a writing assistant made from it. You do not know which assistant wrote it. Score the three dimensions of the RUBRIC, each an integer from 1 to 5; look for problems before you give a 5. Reply with ONLY a JSON object, no prose:
{"scores": {"ownWords": 1-5, "onlyAnswers": 1-5, "plainFirstPerson": 1-5}, "worst": "<the weakest sentence of the paragraph, quoted>"}`;

export function buildVoiceJudgePrompt(rubric: string, m: VoiceMaterial, paragraph: string): string {
  const answers = m.answers
    .map((a) => `Q: ${a.question}\nA: ${a.answer.trim() || "(no answer)"}`)
    .join("\n\n");
  const evidence = m.evidence.map((e) => `## ${e.title}\n${e.text}`).join("\n\n");
  return [
    SPINE,
    `\n# RUBRIC\n${rubric}`,
    `\n# MATERIAL\nlanguage: ${m.locale}\n\n## Criteria\n${m.criteria.map((x) => `- ${x}`).join("\n")}`,
    `\n## The teacher's answers\n${answers || "(none)"}`,
    `\n## Evidence\n${evidence || "(none)"}`,
    `\n## Course\n${m.course || "(none)"}`,
    `\n# PARAGRAPH\n${paragraph}`,
  ].join("\n");
}

export function parseVoiceVerdict(raw: string): VoiceVerdict | null {
  const result = parseJudgeResult(raw);
  if (!result) return null;
  const scores = {} as Record<VoiceDimension, number>;
  for (const d of VOICE_DIMENSIONS) {
    const v = result.scores[d];
    if (v === undefined) return null;
    scores[d] = v;
  }
  return { scores, worst: result.worst };
}

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const triples = (ws: string[]) => ws.slice(2).map((_, i) => ws.slice(i, i + 3).join(" "));

/**
 * Share of the paragraph's three-word runs, outside open spots, that are literally in the
 * teacher's answers. Null without answers or without three words to count.
 */
export function wordReuse(m: VoiceMaterial, paragraph: string): number | null {
  const own = new Set(m.answers.flatMap((a) => triples(words(a.answer))));
  if (own.size === 0) return null;
  const text = splitOnMarkers(paragraph)
    .filter((p) => !p.marker)
    .map((p) => p.text)
    .join(" ");
  const runs = triples(words(text));
  if (runs.length === 0) return null;
  return runs.filter((r) => own.has(r)).length / runs.length;
}

export function calibrationAgreement(
  item: VoiceCalibrationItem,
  scores: Record<VoiceDimension, number> | null,
): boolean {
  if (!scores) return false;
  return Object.entries(item.expect).every(([d, range]) => {
    const v = scores[d as VoiceDimension];
    return range !== undefined && v >= range[0] && v <= range[1];
  });
}

const cell = (v: number | undefined) => (v === undefined ? "–" : String(v));
const yesNo = (b: boolean) => (b ? "ja" : "nee");

export function calibrationReportMarkdown(input: {
  date: string;
  judgeModel: string;
  rows: { item: VoiceCalibrationItem; verdict: VoiceVerdict | null }[];
}): string {
  const agreed = input.rows.filter((r) => calibrationAgreement(r.item, r.verdict?.scores ?? null));
  const range = (r: [number, number] | undefined) => (r ? `${r[0]}–${r[1]}` : "–");
  return [
    `# Ijking stembeoordelaar — ${input.date}`,
    "",
    `Beoordelaar: ${input.judgeModel}. Eigen materiaal (\`evals/portfolio-guided/voice-calibration.json\`), los van de cases die de eval meet. Per alinea de scores van de beoordelaar en of ze binnen het verwachte bereik vallen.`,
    "",
    "| Item | Eigen woorden | Alleen uit het materiaal | Ik-vorm zonder opvulling | Eens | Verwacht | Wat de alinea is |",
    "|---|---|---|---|---|---|---|",
    ...input.rows.map((r) => {
      const s = r.verdict?.scores;
      const expected = VOICE_DIMENSIONS.map((d) => range(r.item.expect[d])).join(" / ");
      return `| ${r.item.id} | ${cell(s?.ownWords)} | ${cell(s?.onlyAnswers)} | ${cell(s?.plainFirstPerson)} | ${yesNo(calibrationAgreement(r.item, s ?? null))} | ${expected} | ${r.item.note} |`;
    }),
    "",
    `Eens: ${agreed.length} van ${input.rows.length}.`,
    "",
  ].join("\n");
}

/** One paragraph's voice: the judge's verdict (null: not judged) and the counted reuse. */
export interface VoiceRow {
  caseId: string;
  voice?: { verdict: VoiceVerdict | null; reuse: number | null };
}

const decimal = (n: number) => n.toFixed(1).replace(".", ",");
const pct = (n: number) => `${Math.round(n * 100)}%`;
const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;

export function voiceSection(rows: VoiceRow[], judgeModel: string): string[] {
  const measured = rows.filter((r) => r.voice);
  if (measured.length === 0) return [];
  const judged = measured.flatMap((r) => (r.voice?.verdict ? [r.voice.verdict] : []));
  const reuses = measured.flatMap((r) => (r.voice?.reuse == null ? [] : [r.voice.reuse]));
  const avg = (d: VoiceDimension) => decimal(mean(judged.map((v) => v.scores[d])));
  return [
    "",
    "## Stem (beoordelaar)",
    "",
    `Beoordelaar: ${judgeModel}, blind voor de promptversie. Drie scores van 1 tot 5 per alinea (rubric.md, "Voice judge"). Overname: het deel van de woordreeksen van drie in de alinea dat letterlijk in de antwoorden van de docent staat (geteld, niet beoordeeld).`,
    "",
    "| Case | Eigen woorden | Alleen uit het materiaal | Ik-vorm zonder opvulling | Overname | Zwakste zin |",
    "|---|---|---|---|---|---|",
    ...measured.map((r) => {
      const v = r.voice?.verdict;
      const reuse = r.voice?.reuse;
      const worst = v ? v.worst.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim() : "niet beoordeeld";
      return `| ${r.caseId} | ${cell(v?.scores.ownWords)} | ${cell(v?.scores.onlyAnswers)} | ${cell(v?.scores.plainFirstPerson)} | ${reuse == null ? "–" : pct(reuse)} | ${worst} |`;
    }),
    "",
    judged.length
      ? `Gemiddeld over ${judged.length} beoordeelde alinea's: eigen woorden ${avg("ownWords")}, alleen uit het materiaal ${avg("onlyAnswers")}, ik-vorm zonder opvulling ${avg("plainFirstPerson")}, overname ${reuses.length ? pct(mean(reuses)) : "–"}.`
      : "Geen alinea beoordeeld.",
  ];
}
