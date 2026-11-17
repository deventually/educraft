import { describe, expect, it } from "vitest";
import { AGENTS } from "~/lib/agents/registry";
import {
  buildScreenRequest,
  parseScreenAnswer,
  SCREEN_THRESHOLDS,
  screenFacts,
  screenVerdicts,
} from "../../scripts/review-screen/screen";
import { SCREEN_RULES } from "../../scripts/review-screen/screenQuestions";
import type { CourseData } from "~/lib/courses/types";

// The quick check before the review team (TypeSafe's Jev): per reviewer a few yes/no questions,
// one judgment each, and code decides. A reviewer is skipped only when every question for it is
// a clear "no" and no fact in code calls for it; anything unclear runs the reviewer.

const course: CourseData = {
  ec: 5,
  outcomes: [
    { id: "o1", text: "Je begrijpt relationele databases.", bloom: "understand" },
    { id: "o2", text: "Je ontwerpt een genormaliseerd datamodel.", bloom: "create" },
  ],
  activities: [
    {
      id: "a1",
      title: "Les relationeel model",
      week: 1,
      kind: "lesson",
      outcomeIds: ["o1"],
      hours: 4,
    },
    {
      id: "a2",
      title: "Opdracht datamodel",
      week: 3,
      kind: "assignment",
      outcomeIds: ["o2"],
      hours: 30,
    },
  ],
  assessments: [
    {
      id: "t1",
      title: "Oefentoets databases",
      week: 2,
      kind: "formative",
      coverage: [{ outcomeId: "o1" }],
    },
    {
      id: "t2",
      title: "Ontwerpopdracht met mondelinge toelichting",
      week: 6,
      kind: "summative",
      weight: 100,
      supervised: false,
      coverage: [{ outcomeId: "o1" }, { outcomeId: "o2", bloom: "create" }],
    },
  ],
};

const noul = (p: number) => ({ type: "noul", noul: p });
/** Jev's answer with every question at `p`, except the ones in `over`. */
function answer(
  req: ReturnType<typeof buildScreenRequest>,
  p: number,
  over: Record<string, number> = {},
) {
  return {
    answers: Object.fromEntries(Object.keys(req.questions).map((id) => [id, noul(over[id] ?? p)])),
    usage: { cost: 3e-5 },
  };
}

describe("the quick check's questions (screenQuestions.ts)", () => {
  it("has rules for every reviewer, and every rule is bilingual", () => {
    for (const a of AGENTS) {
      const rules = SCREEN_RULES[a.id];
      expect(rules, a.id).toBeDefined();
      expect((rules?.questions.length ?? 0) + (rules?.facts.length ?? 0)).toBeGreaterThan(0);
      for (const q of rules?.questions ?? []) {
        for (const l of ["nl", "en"] as const) {
          expect(q.ask[l].trim(), `${a.id}.${q.id}`).not.toBe("");
          expect(q.yes[l].trim()).not.toBe("");
          expect(q.no[l].trim()).not.toBe("");
        }
      }
    }
  });
});

describe("the request: the course as named fields, one judgment per question", () => {
  const req = buildScreenRequest(course, ["assessment-expert", "student"], "nl", "jev-x");

  it("puts the course under short keys, with a week agenda that code built", () => {
    expect(req.model).toBe("jev-x");
    expect(Object.keys(req.state.course.outcomes)).toEqual(["L1", "L2"]);
    expect(req.state.course.outcomes.L1?.text).toBe("Je begrijpt relationele databases.");
    expect(Object.keys(req.state.course.assessments)).toEqual(["T1", "T2"]);
    expect(req.state.course.weeks["week 1"]).toEqual([expect.stringContaining("A1")]);
    expect(req.state.course.outcomes.L2?.assessed_by).toEqual([expect.stringContaining("T2")]);
  });

  it("asks Noul questions that name their part of the state by its path", () => {
    const qs = Object.entries(req.questions);
    expect(qs.length).toBeGreaterThan(0);
    for (const [id, q] of qs) {
      expect(q.type).toBe("noul");
      expect(id).toMatch(/^(assessment-expert|student)\./);
      expect(q.instructions, id).toMatch(/`course\.[^`]+`/);
      expect(q.criteria.true.trim()).not.toBe("");
      expect(q.criteria.false.trim()).not.toBe("");
    }
  });

  it("asks an item question per item it applies to, and only for the reviewers asked", () => {
    const ids = Object.keys(req.questions);
    // Every outcome's wording is asked on its own.
    expect(ids).toContain("assessment-expert.vague.L1");
    expect(ids).toContain("assessment-expert.vague.L2");
    // Only a summative test that covers a create/evaluate outcome gets the knowledge-test question.
    expect(ids).toContain("assessment-expert.knowledge-test.T2");
    expect(ids).not.toContain("assessment-expert.knowledge-test.T1");
    expect(ids.some((id) => id.startsWith("designer."))).toBe(false);
  });

  it("speaks English for an English course", () => {
    const en = buildScreenRequest(course, ["inclusion"], "en", "jev-x");
    expect(en.state.language).toBe("en");
    expect(Object.values(en.questions)[0]?.instructions).toMatch(/[A-Za-z]/);
    expect(JSON.stringify(en.questions)).not.toMatch(/ leeruitkomst/);
  });
});

describe("facts code knows (TypeSafe: counting and weeks belong in code)", () => {
  it("sees two summative tests in one week, and a summative test without a week", () => {
    const f = screenFacts({
      ...course,
      assessments: [
        { id: "x", title: "Tentamen", week: 5, kind: "summative", coverage: [] },
        { id: "y", title: "Verslag", week: 5, kind: "summative", coverage: [] },
        { id: "z", title: "Pitch", kind: "summative", coverage: [] },
      ],
    });
    expect(f.summativeSameWeek).toBe(true);
    expect(f.summativeWithoutWeek).toBe(true);
    expect(screenFacts(course).summativeSameWeek).toBe(false);
    expect(screenFacts(course).summativeWithoutWeek).toBe(false);
  });

  it("sees feedback that does not come at least a week before the summative test", () => {
    expect(screenFacts(course).feedbackNotBefore).toBe(true); // o2 has no formative moment
    const covered: CourseData = {
      ...course,
      assessments: [
        { ...course.assessments[0]!, coverage: [{ outcomeId: "o1" }, { outcomeId: "o2" }] },
        course.assessments[1]!,
      ],
    };
    expect(screenFacts(covered).feedbackNotBefore).toBe(false);
  });

  it("sees the whole grade on one test, and a peak in the study load", () => {
    expect(screenFacts(course).gradeOnOneTest).toBe(true);
    expect(screenFacts(course).loadPeak).toBe(true); // 30 of 34 hours in week 3
    const spread: CourseData = {
      ...course,
      activities: [
        { id: "b1", title: "Les", week: 1, kind: "lesson", outcomeIds: ["o1"], hours: 10 },
        { id: "b2", title: "Les", week: 2, kind: "lesson", outcomeIds: ["o1"], hours: 12 },
      ],
    };
    expect(screenFacts(spread).loadPeak).toBe(false);
  });
});

describe("the verdict: code decides, unclear runs the reviewer", () => {
  const agents = ["inclusion", "designer"];
  const spread: CourseData = {
    ...course,
    activities: [
      { id: "b1", title: "Werkcollege", week: 1, kind: "lesson", outcomeIds: ["o1"], hours: 10 },
      { id: "b2", title: "Project", week: 2, kind: "assignment", outcomeIds: ["o2"], hours: 12 },
    ],
    assessments: [
      {
        id: "s1",
        title: "Tentamen",
        week: 4,
        kind: "summative",
        weight: 50,
        coverage: [{ outcomeId: "o1" }],
      },
      {
        id: "s2",
        title: "Pitch",
        week: 5,
        kind: "summative",
        weight: 50,
        coverage: [{ outcomeId: "o2" }],
      },
    ],
  };
  const req = buildScreenRequest(spread, agents, "nl", "jev-x");

  it("skips a reviewer only when every question is a clear no and no fact calls for it", () => {
    const v = screenVerdicts(spread, agents, parseScreenAnswer(answer(req, 0.1)));
    expect(v.inclusion).toEqual({ run: false, reasons: [] });
    expect(v.designer?.run).toBe(false);
  });

  it("runs a reviewer when one question lands in the band or above", () => {
    const q = Object.keys(req.questions).find((id) => id.startsWith("inclusion."))!;
    const band = SCREEN_THRESHOLDS.no + 0.05;
    const v = screenVerdicts(spread, agents, parseScreenAnswer(answer(req, 0.1, { [q]: band })));
    expect(v.inclusion).toEqual({ run: true, reasons: [q] });
    expect(v.designer?.run).toBe(false);
  });

  it("runs every reviewer when Jev gave no usable answer, or a question is missing", () => {
    const none = screenVerdicts(spread, agents, parseScreenAnswer("nonsense"));
    expect(none.inclusion?.run).toBe(true);
    expect(none.designer?.run).toBe(true);
    const partial = answer(req, 0.1);
    const first = Object.keys(partial.answers).find((id) => id.startsWith("designer."))!;
    delete (partial.answers as Record<string, unknown>)[first];
    expect(screenVerdicts(spread, agents, parseScreenAnswer(partial)).designer).toEqual({
      run: true,
      reasons: [first],
    });
  });

  it("runs a reviewer when a fact in code calls for it, without asking Jev about that", () => {
    const v = screenVerdicts(course, ["inclusion"], parseScreenAnswer(answer(req, 0.1)));
    expect(v.inclusion).toEqual({ run: true, reasons: expect.arrayContaining(["gradeOnOneTest"]) });
  });

  it("reads a question phrased the good way round as a problem unless it is a clear yes", () => {
    const pp = buildScreenRequest(spread, ["student"], "nl", "jev-x");
    const clear = Object.keys(pp.questions).find((id) => id.startsWith("student.clear-title."))!;
    expect(clear).toBeDefined();
    const yes = screenVerdicts(
      spread,
      ["student"],
      parseScreenAnswer(answer(pp, 0.1, { [clear]: 0.9 })),
    );
    expect(yes.student?.reasons).not.toContain(clear);
    const unsure = screenVerdicts(
      spread,
      ["student"],
      parseScreenAnswer(answer(pp, 0.1, { [clear]: 0.5 })),
    );
    expect(unsure.student?.reasons).toContain(clear);
  });

  it("runs a reviewer that also reads linked work: Jev does not see that work", () => {
    const v = screenVerdicts(spread, agents, parseScreenAnswer(answer(req, 0.1)), ["designer"]);
    expect(v.designer).toEqual({ run: true, reasons: ["linked-work"] });
    expect(v.inclusion?.run).toBe(false);
  });

  it("keeps the measured cost", () => {
    expect(parseScreenAnswer(answer(req, 0.1)).costUsd).toBeCloseTo(3e-5);
  });
});
