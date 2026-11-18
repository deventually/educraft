import { describe, expect, it } from "vitest";
import { gateTexts } from "~/lib/privacy/gate";
import { emptyNamed, type LiveChoices } from "~/lib/privacy/live";
import { overviewWords, prepareOverview, textOf } from "~/lib/privacy/overview";

/**
 * The overview before sending (anonymiseerpoort step 4): screens without a typing moment (Bewijs
 * in één keer, the review team, the course import and the course evaluation) show every
 * replacement grouped per word before anything leaves. Seams: `overviewWords` and
 * `prepareOverview`; the gate is the real one, so what the teacher saw is what goes.
 */
const known = { teacher: "Mark de Groot", colleagues: ["Jan de Vries", "Anna Visser"] };
const choices = (over: Partial<LiveChoices> = {}): LiveChoices => ({
  named: emptyNamed,
  keep: [],
  ...over,
});

describe("overviewWords: one row per word, however often it occurs", () => {
  it("groups every occurrence across the parts, most frequent first, with where it was found", () => {
    const words = overviewWords(
      [
        { name: "a", label: "LU1/Jan de Vries feedback.docx", text: "Jan de Vries" },
        {
          name: "b",
          label: "lesplan.docx",
          text: "Jan de Vries zag het. Jan de Vries ook. Mail a@b.nl",
        },
      ],
      known,
      choices(),
    );
    expect(words.map((w) => [w.value, w.count, w.code, w.kind, w.kept])).toEqual([
      ["Jan de Vries", 3, "COLLEGA-1", "known", false],
      ["a@b.nl", 1, "E-MAIL-1", "pattern", false],
    ]);
    expect(words[0]?.labels).toEqual(["LU1/Jan de Vries feedback.docx", "lesplan.docx"]);
  });

  it("shows a word on the keep list as kept, so the teacher can still replace it", () => {
    const [word] = overviewWords(
      [{ name: "a", label: "x", text: "Anna Visser en Anna Visser." }],
      known,
      choices({ keep: ["anna visser"] }),
    );
    expect(word).toMatchObject({ value: "Anna Visser", count: 2, kept: true });
  });

  it("lists several students named one per line, each with its own code", () => {
    const words = overviewWords(
      [{ name: "a", label: "x", text: "Noor Jansen en Sam Bakker." }],
      known,
      choices({ named: { ...emptyNamed, student: "Noor Jansen\nSam Bakker" } }),
    );
    expect(words.map((w) => [w.value, w.code, w.kind])).toEqual([
      ["Noor Jansen", "STUDENT-1", "named"],
      ["Sam Bakker", "STUDENT-2", "named"],
    ]);
  });

  it("keeps a researcher and an ordinary word that a student's name shares (the pack)", () => {
    const words = overviewWords(
      [{ name: "a", label: "x", text: "Lisa werkte met de taxonomie van Bloom; een roos." }],
      known,
      choices({ named: { ...emptyNamed, student: "Lisa Bloom\nRoos Kok" } }),
    );
    expect(words.map((w) => [w.value, w.code])).toEqual([["Lisa Bloom", "STUDENT-1"]]);
  });

  it("is empty when nothing is replaced", () => {
    expect(overviewWords([{ name: "a", label: "x", text: "Een les." }], known, choices())).toEqual(
      [],
    );
  });
});

describe("prepareOverview: what leaves once the teacher presses Versturen", () => {
  it("replaces the teacher's own names in the browser and approves the rest for the gate", () => {
    const parts = [{ name: "doc", label: "Document", text: "Noor Jansen en Jan de Vries." }];
    const c = choices({ named: { ...emptyNamed, student: "Noor Jansen" } });
    const r = prepareOverview(parts, known, c);
    expect(r.values.doc).toBe("[STUDENT] en Jan de Vries.");
    expect(r.approval.approved).toEqual(["Jan de Vries"]);
    // The gate then replaces exactly what the overview showed, without asking again.
    const g = gateTexts([r.values.doc ?? ""], { known, mode: "review", ...r.approval });
    expect(g.send && g.texts).toEqual(["[STUDENT] en [COLLEGA-1]."]);
  });

  it("student work: replaces everything in the browser, so the original never leaves", () => {
    const parts = [
      { name: "f1:name", label: "Jan de Vries.docx", text: "Jan de Vries.docx", redact: true },
    ];
    const r = prepareOverview(parts, known, choices());
    expect(r.values["f1:name"]).toBe("[COLLEGA-1].docx");
    expect(r.approval.approved).toEqual([]);
  });

  it("text the server holds is not sent: the gate replaces in it, an extra word by name", () => {
    const parts = [
      { name: "evaluation", label: "Enquête", text: "Goede les." },
      {
        name: "course",
        label: "Je cursus",
        text: "Docent Jan de Vries, groep Zonnebloem.",
        held: true,
      },
    ];
    const c = choices({ named: { ...emptyNamed, extra: "Zonnebloem" } });
    const r = prepareOverview(parts, known, c);
    expect(Object.keys(r.values)).toEqual(["evaluation"]);
    expect(r.approval).toMatchObject({ approved: ["Jan de Vries"], replace: ["Zonnebloem"] });
    const g = gateTexts([parts[1]?.text ?? ""], { known, mode: "review", ...r.approval });
    expect(g.send && g.texts).toEqual(["Docent [COLLEGA-1], groep [ANDER-1]."]);
  });

  it("sends no extra words when the server holds none of them", () => {
    const parts = [{ name: "doc", label: "Document", text: "Zonnebloem." }];
    const c = choices({ named: { ...emptyNamed, extra: "Zonnebloem" } });
    const r = prepareOverview(parts, known, c);
    expect(r.values.doc).toBe("[ANDER-1].");
    expect(r.approval.replace).toBeUndefined();
  });
});

describe("textOf: the text of a course the server holds", () => {
  it("gives every string, one per line, and leaves ids out", () => {
    expect(
      textOf({
        id: "c-1234567",
        outcomes: [{ id: "o-7654321", text: "Je schrijft SQL.", criteriaIds: ["x-1234567"] }],
        assessments: [{ title: "Tentamen", outcomeId: "o-7654321", weight: 60 }],
      }),
    ).toBe("Je schrijft SQL.\nTentamen");
  });
});
