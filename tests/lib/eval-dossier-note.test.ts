import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type DossierNoteCase,
  dossierNoteReportMarkdown,
  scoreDossierNoteCase,
} from "../../scripts/eval-dossier-note-helpers";
import { parseDossierNote } from "~/lib/courses/dossierNote";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "assessment-dossier-notes", "cases.json"), "utf8"),
).cases as DossierNoteCase[];

describe("assessment-dossier-notes eval cases (P35.2)", () => {
  it("has five cases, two of them with a known fault that must not reach the teacher", () => {
    expect(cases).toHaveLength(5);
    const faults = cases.filter((c) => c.id.startsWith("fault-"));
    expect(faults).toHaveLength(2);
    expect(faults.some((c) => c.forbid?.length)).toBe(true);
    expect(faults.some((c) => c.forbidQuestions?.length)).toBe(true);
    expect(cases.some((c) => c.locale === "en")).toBe(true);
  });

  it("builds the faults into the earlier explanation, never into the numbers", () => {
    for (const c of cases) {
      if (c.forbid?.length)
        expect(c.forbid.some((w) => c.input.explanation?.includes(w))).toBe(true);
      for (const w of c.forbid ?? []) expect(c.input.numbers, c.id).not.toContain(w);
      for (const q of c.forbidQuestions ?? [])
        expect(c.input.numbers, c.id).not.toMatch(new RegExp(`\\| [VQ]${q} \\|`));
    }
  });
});

const base = cases.find((c) => c.id === "fault-made-up-p-nl")!;
const words = (n: number) => Array.from({ length: n }, () => "woord").join(" ");
const answer = (draft: string, questions = ["Wat ga jij aan vraag 4 veranderen?"]) =>
  JSON.stringify({ draft, questions });

describe("scoreDossierNoteCase", () => {
  it("passes a concept of the right length that names the question that stands out", () => {
    const raw = answer(`Vraag 4 onderscheidt weinig. ${words(100)}.`);
    const s = scoreDossierNoteCase(base, raw, parseDossierNote(raw, base.input));
    expect(s).toMatchObject({
      parse: true,
      shapeOk: true,
      expectOk: true,
      forbidden: 0,
      pass: true,
    });
  });

  it("counts the made-up number in the raw answer, while the code keeps it from the teacher", () => {
    const raw = answer(
      `Vraag 3 had een p-waarde van 0,18. Vraag 4 onderscheidt weinig. ${words(100)}.`,
    );
    const s = scoreDossierNoteCase(base, raw, parseDossierNote(raw, base.input));
    expect(s).toMatchObject({ forbidden: 0, forbiddenRaw: 1, dropped: 1, pass: true });
  });

  it("fails a short concept, one without reflection questions, and an unreadable answer", () => {
    const short = answer("Vraag 4 onderscheidt weinig.");
    expect(scoreDossierNoteCase(base, short, parseDossierNote(short, base.input)).pass).toBe(false);
    const none = answer(`Vraag 4 onderscheidt weinig. ${words(100)}.`, []);
    expect(scoreDossierNoteCase(base, none, parseDossierNote(none, base.input)).shapeOk).toBe(
      false,
    );
    expect(scoreDossierNoteCase(base, "nope", { ok: false })).toMatchObject({
      parse: false,
      pass: false,
    });
  });

  it("writes a report with one row per run", () => {
    const raw = answer(`Vraag 4 onderscheidt weinig. ${words(100)}.`);
    const row = scoreDossierNoteCase(base, raw, parseDossierNote(raw, base.input));
    const md = dossierNoteReportMarkdown({
      date: "2026-11-19",
      model: "m",
      repeat: 1,
      rows: [row],
    });
    expect(md).toContain("assessment-dossier-notes@v1");
    expect(md).toContain("| fault-made-up-p-nl | ja |");
    expect(md).toContain("Geslaagd: 1 van 1.");
  });
});
