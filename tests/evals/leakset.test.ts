import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type LeakCase, leaksetHtml, scoreLeakset } from "../../scripts/eval-leakset-helpers";

/**
 * The leak set (anonymiseerpoort, PR 1): fictitious texts with planted names and words that must
 * stay. Plain code, no model. Seam: `scoreLeakset` and `leaksetHtml`.
 */
const base: LeakCase = {
  id: "a",
  kind: "studentwerk",
  text: "",
  entries: [],
  mustGo: [],
  mustStay: [],
};

describe("scoring the leak set", () => {
  it("counts a planted name that slips through, and a word that was wrongly replaced", () => {
    const r = scoreLeakset([
      {
        ...base,
        text: "Volgens Bloom deed Lisa het goed; ook Kees deed mee.",
        entries: [{ kind: "student", value: "Lisa Bloom" }],
        mustGo: ["Lisa", "Kees"],
        mustStay: ["Bloom"],
      },
      {
        ...base,
        id: "b",
        text: "Lisa Bloom koos voor de taxonomie.",
        entries: [{ kind: "student", value: "Lisa Bloom" }],
        extra: ["taxonomie"],
        mustGo: ["Lisa Bloom"],
        mustStay: ["taxonomie"],
      },
    ]);
    expect(r.leaks).toEqual([{ caseId: "a", value: "Kees" }]);
    expect(r.wrong).toEqual([{ caseId: "b", value: "taxonomie", code: "ANDER-1" }]);
    expect(r.totals).toEqual({ mustGo: 3, mustStay: 2 });
    const lisa = r.rows.find((row) => row.word === "Lisa");
    expect(lisa).toMatchObject({ code: "STUDENT", count: 1, caseIds: ["a"], verdict: "intended" });
  });

  it("counts a name in a file name as gone only when every letter of it is covered", () => {
    const r = scoreLeakset([
      {
        ...base,
        kind: "bestanden",
        text: "Jan_de_Vries_reflectie.docx\nvries_feedback.pdf",
        entries: [{ kind: "student", value: "Jan de Vries" }],
        mustGo: ["Jan_de_Vries", "vries"],
      },
    ]);
    expect(r.leaks).toEqual([{ caseId: "a", value: "vries" }]);
  });
});

describe("the report", () => {
  const r = scoreLeakset([
    {
      ...base,
      text: "Volgens <Bloom> en Kees.",
      entries: [{ kind: "student", value: "Kees Bloom" }],
      extra: ["Bloom"],
      mustGo: ["Kees"],
      mustStay: ["Bloom"],
    },
  ]);
  const html = leaksetHtml([{ name: "Toetsset", result: r }], "2026-11-17");

  it("puts the wrongly replaced words at the top, marked, above the names that slipped through", () => {
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    const wrong = html.indexOf("Onterecht vervangen");
    const leaked = html.indexOf("Doorgeglipt");
    const all = html.indexOf("Alle vervangen woorden");
    expect(wrong).toBeGreaterThan(-1);
    expect(wrong).toBeLessThan(leaked);
    expect(leaked).toBeLessThan(all);
    expect(html).toMatch(/class="wrong"[^>]*>[\s\S]*Bloom/);
  });

  it("escapes the text of the cases", () => {
    expect(html).not.toContain("<Bloom>");
  });
});

describe("the committed leak sets", () => {
  const load = (name: string) =>
    (
      JSON.parse(
        readFileSync(resolve(__dirname, `../../evals/privacy-leakset/${name}.json`), "utf8"),
      ) as {
        cases: LeakCase[];
      }
    ).cases;
  const tuning = load("tuning");
  const holdout = load("holdout");

  it("hold about forty fictitious texts, with a separate holdout set", () => {
    expect(tuning.length + holdout.length).toBeGreaterThanOrEqual(40);
    expect(holdout.length).toBeGreaterThanOrEqual(tuning.length);
    const ids = [...tuning, ...holdout].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const kind of ["werkplaats", "studentwerk", "bestanden"]) {
      expect(holdout.some((c) => c.kind === kind)).toBe(true);
    }
  });

  it("every planted value and every word that must stay is really in its text", () => {
    for (const c of [...tuning, ...holdout]) {
      for (const v of [...c.mustGo, ...c.mustStay]) {
        const [value, context] = typeof v === "string" ? [v, v] : [v.value, v.in];
        expect(context, `${c.id}: ${value}`).toContain(value);
        expect(c.text, `${c.id}: ${context}`).toContain(context);
      }
    }
  });

  it("the tuning set meets the hard goal: no known name through, no term removed", () => {
    const r = scoreLeakset(tuning);
    expect(r.wrong).toEqual([]);
    expect(r.leaks).toEqual([]);
  });

  it("the holdout set removes no term", () => {
    expect(scoreLeakset(holdout).wrong).toEqual([]);
  });
});
