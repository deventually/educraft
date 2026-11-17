import { describe, expect, it } from "vitest";
import {
  buildThemeCountRequest,
  countThemes,
  evaluationAnswers,
  parseThemeCountAnswer,
  THEME_COUNT_JEV_THRESHOLDS,
  themeCountRequests,
} from "~/lib/courses/themeCountJev";

const THEMES = [
  { key: "t1", label: "Feedback kwam te laat", polarity: "negative" as const },
  { key: "t2", label: "De gastcolleges waren nuttig", polarity: "positive" as const },
];

describe("the answers Jev reads: one per student, as the survey holds them", () => {
  it("takes each non-empty line as one answer, trimmed", () => {
    expect(evaluationAnswers("Eén.\n\n  Twee | met kolom  \n\t\nDrie.")).toEqual([
      "Eén.",
      "Twee | met kolom",
      "Drie.",
    ]);
  });
});

describe("the request: one per answer, one yes/no per theme (TypeSafe: count in code)", () => {
  const req = buildThemeCountRequest("De feedback kwam pas na vier weken.", THEMES, "nl", "m");

  it("puts only the answer in the state, as a named field, with what it is", () => {
    expect(req.model).toBe("m");
    expect(req.state.answer).toBe("De feedback kwam pas na vier weken.");
    expect(req.state.about_answer).toMatch(/één student/);
    expect(Object.keys(req.state)).toEqual(["answer", "about_answer"]);
  });

  it("asks one noul per theme, named in the question itself, with concrete criteria", () => {
    expect(Object.keys(req.questions)).toEqual(["mentions_t1", "mentions_t2"]);
    const q = req.questions.mentions_t1!;
    expect(q.type).toBe("noul");
    expect(q.instructions).toContain('"Feedback kwam te laat"');
    expect(q.instructions).toContain("`answer`");
    // The theme's direction is in the yes criterion; the opposite view is named as a no.
    expect(q.criteria.true).toMatch(/klacht of verbeterpunt/);
    expect(req.questions.mentions_t2!.criteria.true).toMatch(/goed ging/);
    expect(q.criteria.false).toMatch(/tegenovergestelde/);
  });

  it("is bilingual with the same shape", () => {
    const en = buildThemeCountRequest("Too late.", THEMES, "en", "m");
    expect(en.state.about_answer).toMatch(/one student/);
    expect(en.questions.mentions_t1!.criteria.true).toMatch(/complaint/);
    expect(Object.keys(en.questions)).toEqual(Object.keys(req.questions));
  });

  it("builds one request per answer of the survey", () => {
    const all = themeCountRequests("A.\nB.\n\nC.", THEMES, "en", "m");
    expect(all.map((r) => r.answer)).toEqual(["A.", "B.", "C."]);
    expect(themeCountRequests("A.", [], "en", "m")).toEqual([]);
  });
});

describe("reading the answer", () => {
  it("takes the probability per theme and the cost Jev reports", () => {
    const a = parseThemeCountAnswer({
      answers: {
        mentions_t1: { type: "noul", noul: 0.93 },
        mentions_t2: { type: "noul", noul: 0.04 },
      },
      usage: { cost: 0.00002 },
    });
    expect(a).toEqual({ usable: true, mentions: { t1: 0.93, t2: 0.04 }, costUsd: 0.00002 });
  });

  it("is unusable on anything else, never a silent no", () => {
    expect(parseThemeCountAnswer({ error: "x" }).usable).toBe(false);
    expect(parseThemeCountAnswer(null).usable).toBe(false);
  });
});

describe("the count: Jev judges each answer, code counts", () => {
  const yes = (p: Record<string, number>) => ({ usable: true, mentions: p });

  it("counts a theme from 0.7, keeps the band between apart, and leaves no answer out silently", () => {
    expect(THEME_COUNT_JEV_THRESHOLDS).toEqual({ yes: 0.7, no: 0.3 });
    const counts = countThemes(
      [
        yes({ t1: 0.95, t2: 0.1 }),
        yes({ t1: 0.7, t2: 0.5 }),
        yes({ t1: 0.69, t2: 0.3 }),
        yes({ t1: 0.2 }),
        { usable: false, mentions: {} },
      ],
      ["t1", "t2"],
    );
    expect(counts.t1).toEqual({ count: 2, unsettled: 1, unanswered: 1 });
    // A question Jev left out of a usable answer is unanswered too.
    expect(counts.t2).toEqual({ count: 0, unsettled: 1, unanswered: 2 });
  });
});
