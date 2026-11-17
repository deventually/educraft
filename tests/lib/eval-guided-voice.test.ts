import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildVoiceJudgePrompt,
  calibrationAgreement,
  calibrationReportMarkdown,
  parseVoiceVerdict,
  VOICE_DIMENSIONS,
  type VoiceCalibrationItem,
  voiceJudgeRubric,
  voiceMaterial,
  wordReuse,
} from "../../scripts/eval-guided-voice";
import {
  type GuidedCase,
  guidedReportMarkdown,
  scoreDraft,
  scoreQuestions,
} from "../../scripts/eval-guided-helpers";

const dir = join(process.cwd(), "evals", "portfolio-guided");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as GuidedCase[];
const calibration = JSON.parse(readFileSync(join(dir, "voice-calibration.json"), "utf8"))
  .items as VoiceCalibrationItem[];
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const [first] = cases;

/** Every run of five words, lowercased: enough to tell shared text from shared topic. */
function fiveGrams(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(words.slice(4).map((_, i) => words.slice(i, i + 5).join(" ")));
}

describe("voice judge rubric", () => {
  it("describes the three dimensions, each with its 1, 3 and 5 anchor", () => {
    const section = voiceJudgeRubric(rubric);
    for (const id of VOICE_DIMENSIONS) expect(section, id).toContain(`**${id}**`);
    expect(section.match(/^\s+- 1 /gm)?.length).toBe(3);
    expect(section.match(/^\s+- 5 /gm)?.length).toBe(3);
  });

  it("shares no text with the cases it measures: the judge is not tuned on them", () => {
    const measured = new Set(
      cases.flatMap((c) => [
        ...fiveGrams(c.answers.map((a) => a.answer).join(" ")),
        ...fiveGrams(c.evidence.map((e) => e.text).join(" ")),
        ...fiveGrams(c.expect.goodParagraph),
      ]),
    );
    const own = [
      voiceJudgeRubric(rubric),
      ...calibration.flatMap((i) => [i.paragraph, ...i.material.answers.map((a) => a.answer)]),
    ].join(" ");
    expect([...fiveGrams(own)].filter((g) => measured.has(g))).toEqual([]);
  });
});

describe("voice calibration set", () => {
  it("has its own ids, both languages, and a high and a low anchor for every dimension", () => {
    const ids = new Set(cases.map((c) => c.id));
    expect(calibration.filter((i) => ids.has(i.id))).toEqual([]);
    expect(new Set(calibration.map((i) => i.material.locale))).toEqual(new Set(["nl", "en"]));
    for (const d of VOICE_DIMENSIONS) {
      const ranges = calibration.flatMap((i) => (i.expect[d] ? [i.expect[d]] : []));
      expect(
        ranges.some(([, max]) => max <= 2),
        d,
      ).toBe(true);
      expect(
        ranges.some(([min]) => min >= 4),
        d,
      ).toBe(true);
    }
  });

  it("counts a verdict inside every expected range as agreement", () => {
    const item = calibration[0]!;
    expect(calibrationAgreement(item, { ownWords: 5, onlyAnswers: 4, plainFirstPerson: 5 })).toBe(
      true,
    );
    expect(calibrationAgreement(item, { ownWords: 3, onlyAnswers: 4, plainFirstPerson: 5 })).toBe(
      false,
    );
    expect(calibrationAgreement(item, null)).toBe(false);
  });

  it("reports per item what the judge gave and whether it agreed", () => {
    const [good, bad] = calibration;
    const md = calibrationReportMarkdown({
      date: "2026-11-17",
      judgeModel: "j",
      rows: [
        {
          item: good!,
          verdict: { scores: { ownWords: 5, onlyAnswers: 5, plainFirstPerson: 5 }, worst: "" },
        },
        { item: bad!, verdict: null },
      ],
    });
    expect(md).toContain("# Ijking stembeoordelaar — 2026-11-17");
    expect(md).toContain(`| ${good!.id} | 5 | 5 | 5 | ja |`);
    expect(md).toContain(`| ${bad!.id} | – | – | – | nee |`);
    expect(md).toContain("Eens: 1 van 2.");
  });
});

describe("voiceMaterial", () => {
  it("gives the judge the teacher's answers, evidence and criteria, never the expected answer", () => {
    const c = first!;
    const m = voiceMaterial(c);
    expect(m.locale).toBe(c.locale);
    expect(m.answers).toEqual(c.answers);
    expect(m.criteria).toEqual(c.criteria.map((x) => x.text));
    const prompt = buildVoiceJudgePrompt(voiceJudgeRubric(rubric), m, "Ik gaf les.");
    expect(prompt).not.toContain(c.expect.goodParagraph);
    expect(prompt).toContain(c.answers[0]!.answer);
    expect(prompt).toContain("Ik gaf les.");
  });

  it("gives the judge the course's facts for an anchored case: they are material too", () => {
    const c = cases.find((x) => x.course)!;
    const m = voiceMaterial(c);
    expect(m.course).toContain("<course>");
    expect(buildVoiceJudgePrompt(voiceJudgeRubric(rubric), m, "x")).toContain(m.course);
    expect(voiceMaterial(first!).course).toBe("");
  });

  it("does not tell the judge which prompt wrote the paragraph", () => {
    const prompt = buildVoiceJudgePrompt(voiceJudgeRubric(rubric), voiceMaterial(first!), "x");
    expect(prompt).not.toMatch(/portfolio-draft|@v\d/);
  });
});

describe("parseVoiceVerdict", () => {
  it("reads the three scores and the weakest sentence, also inside a code fence", () => {
    const raw =
      '```json\n{"scores": {"ownWords": 4, "onlyAnswers": 5, "plainFirstPerson": 3}, "worst": "Dit was cruciaal."}\n```';
    expect(parseVoiceVerdict(raw)).toEqual({
      scores: { ownWords: 4, onlyAnswers: 5, plainFirstPerson: 3 },
      worst: "Dit was cruciaal.",
    });
  });

  it("refuses a verdict that misses a dimension or is not JSON", () => {
    expect(parseVoiceVerdict('{"scores": {"ownWords": 4, "onlyAnswers": 5}}')).toBeNull();
    expect(parseVoiceVerdict("Ik vind het een goede alinea.")).toBeNull();
  });
});

describe("wordReuse", () => {
  const c = first!;
  const m = voiceMaterial(c);

  it("is the share of the paragraph's three-word runs that are the teacher's own", () => {
    const answer = c.answers[0]!.answer;
    expect(wordReuse(m, answer)).toBe(1);
    expect(wordReuse(m, "Volgens de literatuur is differentiatie altijd belangrijk geweest.")).toBe(
      0,
    );
  });

  it("leaves out what is inside an open spot", () => {
    const answer = c.answers[0]!.answer;
    expect(wordReuse(m, `${answer} [aanvullen: wat de studenten daarna zeiden over de les]`)).toBe(
      1,
    );
  });

  it("has no score without answers to reuse", () => {
    const silent = cases.find((x) => x.answers.length === 0)!;
    expect(wordReuse(voiceMaterial(silent), silent.expect.goodParagraph)).toBeNull();
  });
});

describe("guidedReportMarkdown — voice", () => {
  const row = (
    voice?: NonNullable<Parameters<typeof guidedReportMarkdown>[0]["rows"][number]["voice"]>,
  ) => ({
    caseId: first!.id,
    questions: scoreQuestions(first!, first!.expect.goodQuestions),
    draft: scoreDraft(first!, first!.expect.goodParagraph),
    ...(voice ? { voice } : {}),
  });

  it("adds a voice section with the judge, per-case scores and the means", () => {
    const md = guidedReportMarkdown({
      date: "2026-11-17",
      model: "m",
      judgeModel: "j",
      repeat: 1,
      rows: [
        row({
          verdict: {
            scores: { ownWords: 4, onlyAnswers: 5, plainFirstPerson: 3 },
            worst: "Een | zin.",
          },
          reuse: 0.42,
        }),
        row({ verdict: null, reuse: null }),
      ],
    });
    expect(md).toContain("## Stem (beoordelaar)");
    expect(md).toContain("Beoordelaar: j");
    expect(md).toContain(`| ${first!.id} | 4 | 5 | 3 | 42% | Een \\| zin. |`);
    expect(md).toContain(`| ${first!.id} | – | – | – | – | niet beoordeeld |`);
    expect(md).toContain(
      "Gemiddeld over 1 beoordeelde alinea's: eigen woorden 4,0, alleen uit het materiaal 5,0, ik-vorm zonder opvulling 3,0, overname 42%.",
    );
    expect(md).not.toContain("geen beoordelaarsmodel");
  });

  it("escapes a backslash before the pipe, so a cell cannot break out of the table", () => {
    const md = guidedReportMarkdown({
      date: "2026-11-17",
      model: "m",
      judgeModel: "j",
      repeat: 1,
      rows: [
        row({
          verdict: {
            scores: { ownWords: 4, onlyAnswers: 5, plainFirstPerson: 3 },
            worst: "a\\| b",
          },
          reuse: null,
        }),
      ],
    });
    expect(md).toContain("| a\\\\\\| b |");
  });

  it("leaves the voice section out when it was not measured", () => {
    const md = guidedReportMarkdown({ date: "2026-11-17", model: "m", repeat: 1, rows: [row()] });
    expect(md).not.toContain("## Stem");
    expect(md).toContain("geen beoordelaarsmodel");
  });
});
