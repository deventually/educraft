import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type FeedforwardCase,
  feedforwardReportMarkdown,
  judgementLines,
  scoreFeedforwardCase,
} from "../../scripts/eval-feedforward-helpers";
import { parseFeedforward } from "~/lib/tracks/feedforward";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "feedforward", "cases.json"), "utf8"),
).cases as FeedforwardCase[];

describe("feedforward eval cases (P38.3)", () => {
  it("has at least five cases with two versions, and the two known errors", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    expect(cases.filter((c) => (c.previous ?? []).length > 0).length).toBeGreaterThanOrEqual(5);
    const ids = cases.map((c) => c.id);
    for (const part of ["claimed", "grade"])
      expect(
        ids.some((id) => id.includes(part)),
        part,
      ).toBe(true);
    expect(cases.some((c) => c.locale === "en")).toBe(true);
  });

  it("only expects statuses for earlier points the case has", () => {
    for (const c of cases) {
      const known = new Set((c.previous ?? []).map((p) => p.id));
      for (const id of Object.keys(c.expect ?? {}))
        expect(known.has(id), `${c.id}: ${id}`).toBe(true);
    }
  });
});

const base: FeedforwardCase = {
  id: "x",
  locale: "nl",
  criteria: "C1 Vraag",
  version: "De vraag is: hoe verlagen we de wachttijd met 20%?",
  previous: [
    { id: "p1", criterion: "C1", text: "Maak de vraag meetbaar." },
    { id: "p2", criterion: "C1", text: "Noem bronnen." },
  ],
  expect: { p1: ["addressed", "partly"], p2: ["not", "unseen"] },
  forbid: ["Jan"],
};
const raw = (o: unknown) => JSON.stringify(o);

describe("scoreFeedforwardCase", () => {
  it("passes when the statuses match, no grade was written and nothing forbidden shows", () => {
    const text = raw({
      criteria: [{ criterion: "C1", strengths: ["Concreet."], improvements: ["Leg de 20% uit."] }],
      followUp: [
        { point: "p1", status: "addressed", quote: "met 20%" },
        { point: "p2", status: "not" },
      ],
    });
    const s = scoreFeedforwardCase(
      base,
      parseFeedforward(text, { version: base.version, previous: base.previous ?? [] }),
      text,
    );
    expect(s).toMatchObject({
      parse: true,
      statusesOk: true,
      judgements: 0,
      forbidden: 0,
      pass: true,
    });
  });

  it("fails on a claimed improvement, a grade in the raw answer, or a forbidden word", () => {
    const text = raw({
      criteria: [{ criterion: "C1", strengths: ["Voldoende voor Jan."], improvements: [] }],
      followUp: [
        { point: "p1", status: "addressed", quote: "met 20%" },
        { point: "p2", status: "addressed", quote: "De vraag is" },
      ],
    });
    const s = scoreFeedforwardCase(
      base,
      parseFeedforward(text, { version: base.version, previous: base.previous ?? [] }),
      text,
    );
    expect(s.statusesOk).toBe(false);
    expect(s.judgements).toBe(1);
    expect(s.pass).toBe(false);
    expect(scoreFeedforwardCase(base, { ok: false, error: "unparseable" }, "x").pass).toBe(false);
  });

  it("counts the judgement lines in a raw answer", () => {
    expect(judgementLines(raw({ criteria: [{ improvements: ["Een 7/10.", "Goed zo."] }] }))).toBe(
      1,
    );
    expect(judgementLines("geen json")).toBe(0);
  });

  it("writes a report table", () => {
    const md = feedforwardReportMarkdown({
      date: "2026-11-12",
      model: "m",
      repeat: 1,
      rows: [
        {
          caseId: "x",
          parse: true,
          criteria: 1,
          statusesOk: true,
          judgements: 0,
          forbidden: 0,
          dropped: 0,
          pass: true,
        },
      ],
      retries: 0,
    });
    expect(md).toContain("| x | ja | 1 | ja | 0 | 0 | 0 | ja |");
    expect(md).toContain("Geslaagd: 1 van 1");
  });
});
