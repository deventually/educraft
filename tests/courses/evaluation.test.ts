import { describe, expect, it } from "vitest";
import { ACT1, alignedCourse, LO1, TEST1 } from "./fixtures";
import {
  buildEvaluationMessage,
  courseOutline,
  EVALUATION_LIMITS,
  parseEvaluation,
} from "~/lib/courses/evaluation";

const EVALUATION = [
  "De lessen over normaliseren waren te snel.",
  "Normaliseren ging veel te snel, ik kon het niet bijhouden.",
  "De eindopdracht was duidelijk en leuk om te maken.",
  "Fijne opdracht, ik heb veel geleerd van het datamodel.",
  "De les over normaliseren mocht wel een week langer.",
].join("\n");

const ctx = { data: alignedCourse(), evaluation: EVALUATION, respondents: 24 };
const answer = (o: object) => `Hier is het:\n\`\`\`json\n${JSON.stringify(o)}\n\`\`\``;

const good = {
  themes: [
    {
      label: "Tempo bij normaliseren",
      polarity: "negative",
      count: 3,
      quotes: ["Normaliseren ging veel te snel", "De lessen over normaliseren waren te snel."],
    },
    {
      label: "Eindopdracht",
      polarity: "positive",
      count: 2,
      quotes: ["De eindopdracht was duidelijk en leuk om te maken."],
    },
  ],
  problems: [{ place: ACT1, text: "Het tempo van deze les lag te hoog.", basis: "students" }],
  improvements: [{ place: ACT1, text: "Spreid normaliseren over twee lessen." }],
};

describe("courseOutline", () => {
  it("lists every outcome, lesson and test with its id, for the model to place things", () => {
    const outline = courseOutline(alignedCourse());
    expect(outline).toContain(`[${LO1}] Je ontwerpt een datamodel.`);
    expect(outline).toContain(`[${ACT1}] Les normaliseren (week 1)`);
    expect(outline).toContain(`[${TEST1}] Eindopdracht (week 4, summative)`);
  });
});

describe("buildEvaluationMessage", () => {
  it("wraps the evaluation as data, with the respondents counted in code and the outline", () => {
    const message = buildEvaluationMessage({
      name: "Databases",
      data: alignedCourse(),
      evaluation: EVALUATION,
      respondents: 24,
      testAnalysis: [{ title: "Eindopdracht", analysis: "Vraag 3: p = 0,21; Rir = -0,05" }],
      context: "Context: hbo",
    });
    expect(message).toContain("<course>Databases</course>");
    expect(message).toContain("<respondents>24</respondents>");
    expect(message).toMatch(/<evaluation>\n[\s\S]*te snel[\s\S]*\n<\/evaluation>/);
    expect(message).toMatch(/<outline>\n[\s\S]*\[lo-1\][\s\S]*<\/outline>/);
    expect(message).toMatch(/<testAnalysis>\n## Eindopdracht\nVraag 3: p = 0,21; Rir = -0,05/);
    expect(message).toContain("<context>\nContext: hbo\n</context>");
    expect(message).not.toContain("{{");
  });

  it("leaves out the test analysis and context when there are none, and cuts a long evaluation", () => {
    const message = buildEvaluationMessage({
      name: "Databases",
      data: alignedCourse(),
      evaluation: "x".repeat(EVALUATION_LIMITS.evaluation + 50),
      respondents: 3,
      context: "",
    });
    expect(message).not.toContain("<testAnalysis>");
    expect(message).not.toContain("<context>");
    expect(message).toContain("[…]");
  });
});

describe("parseEvaluation", () => {
  it("keeps the themes, problems and improvements on their places", () => {
    const r = parseEvaluation(answer(good), ctx);
    expect(r).toEqual({
      ok: true,
      dropped: 0,
      evaluation: {
        respondents: 24,
        small: false,
        themes: [
          {
            label: "Tempo bij normaliseren",
            polarity: "negative",
            count: 3,
            quotes: [
              "Normaliseren ging veel te snel",
              "De lessen over normaliseren waren te snel.",
            ],
          },
          {
            label: "Eindopdracht",
            polarity: "positive",
            count: 2,
            quotes: ["De eindopdracht was duidelijk en leuk om te maken."],
          },
        ],
        problems: [
          {
            place: { kind: "activity", id: ACT1 },
            text: "Het tempo van deze les lag te hoog.",
            basis: "students",
          },
        ],
        improvements: [
          { place: { kind: "activity", id: ACT1 }, text: "Spreid normaliseren over twee lessen." },
        ],
      },
    });
  });

  it("drops a quote that is not literally in the evaluation, and takes the evaluation's own text", () => {
    const r = parseEvaluation(
      answer({
        ...good,
        themes: [
          {
            label: "Tempo",
            polarity: "negative",
            count: 3,
            quotes: ["normaliseren  ging VEEL te snel", "Het was allemaal te snel."],
          },
        ],
      }),
      ctx,
    );
    expect(r.ok && r.evaluation.themes[0]?.quotes).toEqual(["Normaliseren ging veel te snel"]);
    expect(r.ok && r.dropped).toBe(1);
  });

  it("drops a theme that came up only once, and caps a count at the respondents", () => {
    const r = parseEvaluation(
      answer({
        ...good,
        themes: [
          { label: "Eén student", polarity: "negative", count: 1, quotes: [] },
          { label: "Tempo", polarity: "negative", count: 99, quotes: [] },
        ],
      }),
      ctx,
    );
    expect(r.ok && r.evaluation.themes).toEqual([
      { label: "Tempo", polarity: "negative", count: 24, quotes: [] },
    ]);
  });

  it("puts an unknown place on the whole course", () => {
    const r = parseEvaluation(
      answer({
        ...good,
        problems: [{ place: "week-9-les", text: "Onduidelijk rooster.", basis: "question" }],
        improvements: [{ place: "course", text: "Deel het rooster eerder." }],
      }),
      ctx,
    );
    expect(r.ok && r.evaluation.problems[0]?.place).toEqual({ kind: "course" });
    expect(r.ok && r.evaluation.improvements[0]?.place).toEqual({ kind: "course" });
  });

  it("keeps at most five improvements and drops unknown keys and bad items", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ place: "course", text: `Punt ${i + 1}` }));
    const r = parseEvaluation(
      answer({
        ...good,
        secret: "x",
        problems: [...good.problems, { place: ACT1, text: "", basis: "students" }],
        improvements: [{ place: ACT1, text: 42 }, ...many],
      }),
      ctx,
    );
    expect(r.ok && r.evaluation.improvements).toHaveLength(EVALUATION_LIMITS.improvements);
    expect(r.ok && r.evaluation.improvements[0]?.text).toBe("Punt 1");
    expect(r.ok && r.evaluation.problems).toHaveLength(1);
    expect(r.ok && Object.keys(r.evaluation)).not.toContain("secret");
  });

  it("marks a small group (fewer than 10 respondents)", () => {
    const r = parseEvaluation(answer(good), { ...ctx, respondents: 6 });
    expect(r.ok && r.evaluation.small).toBe(true);
    expect(r.ok && r.evaluation.themes[0]?.count).toBe(3);
  });

  it("is unparseable without a JSON object of the right shape", () => {
    expect(parseEvaluation("Geen idee.", ctx)).toEqual({ ok: false, error: "unparseable" });
    expect(parseEvaluation(answer({ themes: "x" }), ctx)).toEqual({
      ok: false,
      error: "unparseable",
    });
  });
});

describe("the course-evaluation@v1 prompt", () => {
  it("has no open placeholders and names the same tags and keys in NL and EN", async () => {
    const { getRuntimePrompt } = await import("~/lib/prompts");
    const tags = (s: string) => [...new Set(s.match(/<\/?[a-zA-Z]+>/g))].sort();
    const keys = (s: string) => [...new Set(s.match(/"[a-z]+":/g))].sort();
    const nl = getRuntimePrompt("course-evaluation@v1", "nl");
    const en = getRuntimePrompt("course-evaluation@v1", "en");
    for (const p of [nl, en]) {
      expect(p).not.toMatch(/\{\{/);
      expect(p).toContain("Voice & Bounds");
    }
    expect(tags(nl)).toEqual(tags(en));
    expect(keys(nl)).toEqual(keys(en));
    expect(tags(nl)).toEqual(
      expect.arrayContaining(["<evaluation>", "<outline>", "<respondents>", "<testAnalysis>"]),
    );
  });
});
