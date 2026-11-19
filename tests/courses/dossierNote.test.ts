import { describe, expect, it } from "vitest";
import {
  buildDossierNoteMessage,
  DOSSIER_NOTE_LIMITS,
  type DossierNoteInput,
  parseDossierNote,
} from "~/lib/courses/dossierNote";

const NUMBERS = [
  "**Toetsanalyse**",
  "",
  "- Kandidaten: 64",
  "- Vragen: 4",
  "- Alfa: 0,71",
  "",
  "| Vraag | Max | p | Rit | Rir | Alfa zonder deze vraag |",
  "| --- | --- | --- | --- | --- | --- |",
  "| V1 | 1 | 0,82 | 0,41 | 0,33 | 0,69 |",
  "| V2 | 1 | 0,25 | 0,10 | -0,08 | 0,76 |",
  "| V3 | 2 | 0,58 | 0,52 | 0,40 | 0,64 |",
  "| V4 | 1 | 0,95 | 0,12 | 0,05 | 0,72 |",
].join("\n");

const input: DossierNoteInput = {
  test: "Tentamen SQL",
  passMark: 55,
  numbers: NUMBERS,
  testInfo: "30 meerkeuzevragen met 4 opties.",
  // An earlier AI explanation: context, never a source of numbers.
  explanation: "Vraag 2 had een p-waarde van 0,15.",
};

const answer = (o: object) => `Hier is het concept:\n\`\`\`json\n${JSON.stringify(o)}\n\`\`\``;

describe("buildDossierNoteMessage", () => {
  it("wraps the test, the pass mark, the numbers, the test info and the earlier explanation as data", () => {
    const m = buildDossierNoteMessage(input);
    expect(m).toContain("<test>Tentamen SQL</test>");
    expect(m).toContain("<passMark>55</passMark>");
    expect(m).toMatch(/<analysis>\n[\s\S]*\| V2 \| 1 \| 0,25 [\s\S]*\n<\/analysis>/);
    expect(m).toContain("<testInfo>\n30 meerkeuzevragen met 4 opties.\n</testInfo>");
    expect(m).toContain(
      "<earlierExplanation>\nVraag 2 had een p-waarde van 0,15.\n</earlierExplanation>",
    );
  });

  it("leaves out what is not there and cuts long numbers", () => {
    const m = buildDossierNoteMessage({
      test: "Toets",
      numbers: "x".repeat(DOSSIER_NOTE_LIMITS.numbers + 10),
    });
    expect(m).not.toContain("<passMark>");
    expect(m).not.toContain("<testInfo>");
    expect(m).not.toContain("<earlierExplanation>");
    expect(m).toContain("[…]");
  });
});

describe("parseDossierNote: only numbers and questions from the input", () => {
  it("keeps a draft whose numbers are all in the analysis, in either decimal notation", () => {
    const r = parseDossierNote(
      answer({
        draft:
          "Vraag 2 valt op: de p-waarde is 0,25 en de Rir -0,08. De alfa van 0.71 is redelijk voor 4 vragen.\n\nVraag 4 was met 0,95 erg makkelijk.",
        questions: ["Wat ga jij aan vraag 2 veranderen?", "Houd je vraag 4 in de toets?"],
      }),
      input,
    );
    expect(r).toEqual({
      ok: true,
      note: {
        draft:
          "Vraag 2 valt op: de p-waarde is 0,25 en de Rir -0,08. De alfa van 0.71 is redelijk voor 4 vragen.\n\nVraag 4 was met 0,95 erg makkelijk.",
        questions: ["Wat ga jij aan vraag 2 veranderen?", "Houd je vraag 4 in de toets?"],
        dropped: 0,
      },
    });
  });

  it("drops a sentence with a number that is not in the input, also one from the earlier explanation", () => {
    const r = parseDossierNote(
      answer({
        draft:
          "Vraag 2 had een p-waarde van 0,15. De Rir van vraag 2 is negatief. Vraag 3 scoort een Rit van 0,67.",
        questions: ["Wat ga jij aan vraag 2 veranderen?"],
      }),
      input,
    );
    expect(r.ok && r.note.draft).toBe("De Rir van vraag 2 is negatief.");
    expect(r.ok && r.note.dropped).toBe(2);
  });

  it("drops a sentence and a question about a question that is not in the analysis", () => {
    const r = parseDossierNote(
      answer({
        draft: "Vraag 7 werkte niet: die moet eruit. V2 onderscheidt slecht. Ook Q9 is zwak.",
        questions: ["Wat ga jij aan vraag 7 veranderen?", "Wat doe je met V2?"],
      }),
      input,
    );
    expect(r.ok && r.note.draft).toBe("V2 onderscheidt slecht.");
    expect(r.ok && r.note.questions).toEqual(["Wat doe je met V2?"]);
    expect(r.ok && r.note.dropped).toBe(3);
  });

  it("allows numbers from the pass mark and the test info", () => {
    const r = parseDossierNote(
      answer({ draft: "Met 30 vragen en een cesuur van 55% is de toets kort.", questions: [] }),
      input,
    );
    expect(r.ok && r.note.draft).toBe("Met 30 vragen en een cesuur van 55% is de toets kort.");
  });

  it("keeps at most two reflection questions, and only real questions", () => {
    const r = parseDossierNote(
      answer({
        draft: "Vraag 2 valt op.",
        questions: ["Een stelling.", "Wat verander je aan vraag 2?", "Waarom?", "Nog een?"],
      }),
      input,
    );
    expect(r.ok && r.note.questions).toEqual(["Wat verander je aan vraag 2?", "Waarom?"]);
  });

  it("fails on an unreadable answer, a missing draft or a draft that is all made up", () => {
    expect(parseDossierNote("nope", input)).toEqual({ ok: false });
    expect(parseDossierNote(answer({ questions: [] }), input)).toEqual({ ok: false });
    expect(
      parseDossierNote(answer({ draft: "Vraag 12 had een p van 0,03.", questions: [] }), input),
    ).toEqual({ ok: false });
  });

  it("cuts a draft that is too long at a sentence", () => {
    const sentence = "Vraag 2 valt op. ";
    const r = parseDossierNote(
      answer({ draft: sentence.repeat(DOSSIER_NOTE_LIMITS.note / 10), questions: [] }),
      input,
    );
    expect(r.ok && r.note.draft.length).toBeLessThanOrEqual(DOSSIER_NOTE_LIMITS.note);
    expect(r.ok && r.note.draft.endsWith("Vraag 2 valt op.")).toBe(true);
  });
});
