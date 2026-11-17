import { describe, expect, it } from "vitest";
import { applyRedactions, findRedactions } from "~/lib/privacy/redact";
import { redactOptions } from "~/lib/privacy/pack";

/** The privacy pack: the data that keeps the engine from removing too much. Seam: `redactOptions`. */
describe("the privacy pack", () => {
  const redact = (text: string, value: string, studentNumberExample?: string) =>
    applyRedactions(
      text,
      findRedactions(
        text,
        [{ kind: "supervisor", value }],
        [],
        redactOptions({ studentNumberExample }),
      ),
    ).text;

  it.each([
    "Bloom",
    "Vygotsky",
    "Piaget",
    "Hattie",
    "Marzano",
    "Kolb",
    "Biggs",
    "Dweck",
    "Kirschner",
    "Wiley",
  ])("keeps the researcher %s, even when a colleague shares the surname", (name) => {
    expect(redact(`Volgens ${name} werkt dit.`, `Kim ${name}`)).toBe(`Volgens ${name} werkt dit.`);
    expect(redact(`Kim ${name} werkt hier.`, `Kim ${name}`)).toBe("[BEGELEIDER] werkt hier.");
  });

  it.each([
    ["Bas Smit", "Bas zei dat bas een vis is."],
    ["Roos Visser", "Roos bloeit; de visser en een roos."],
    ["Mark Groen", "Mark the answer, groen is een kleur."],
    ["Rob Wolf", "Rob opent; een wolf in het bos."],
  ])(
    "leaves the ordinary words of %s alone at the start of a sentence and in lower case",
    (value, text) => {
      expect(redact(text, value)).toBe(text);
    },
  );

  it("still replaces such a name in the middle of a sentence", () => {
    expect(redact("Ik vroeg Bas en daarna Roos.", "Bas Smit")).toBe(
      "Ik vroeg [BEGELEIDER] en daarna Roos.",
    );
  });

  it.each([
    [
      "s1234567",
      "Student s7654321, 7654321 en 123456; S7654321.",
      "Student [NUMMER-1], [NUMMER-2] en 123456; [NUMMER-1].",
    ],
    ["12345678", "Nummer 87654321 en 1234567.", "Nummer [NUMMER-1] en 1234567."],
  ])("learns the format from one example the teacher gives (%s)", (example, text, expected) => {
    expect(redact(text, "Kim Lee", example)).toBe(expected);
  });

  it("ignores an example that is not a student number, and has no format without one", () => {
    for (const example of ["", "  ", "abc", "12", "jan@school.nl", "s12 34"]) {
      expect(redactOptions({ studentNumberExample: example }).studentNumber).toBeUndefined();
    }
    expect(redactOptions().studentNumber).toBeUndefined();
  });

  it("holds every list in lower case, without doubles", () => {
    const { keep = [], commonWords = [] } = redactOptions();
    for (const list of [keep, commonWords]) {
      expect(list.every((w) => w === w.toLowerCase() && w.trim() === w)).toBe(true);
      expect(new Set(list).size).toBe(list.length);
    }
    expect(commonWords.length).toBeGreaterThan(100);
  });
});
