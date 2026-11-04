import { describe, expect, it } from "vitest";
import {
  applyRedactions,
  findRedactions,
  restoreNames,
  type RedactEntry,
} from "~/lib/privacy/redact";

/** 24.0b: names and other details are replaced by codes in the browser, before anything is sent. */
const redact = (text: string, entries: RedactEntry[], extra: string[] = []) => {
  const spans = findRedactions(text, entries, extra);
  return applyRedactions(text, spans);
};

describe("entries the teacher names", () => {
  const student: RedactEntry = { kind: "student", value: "Jan de Vries" };

  it("replaces the full name and its parts, in any case", () => {
    const { text } = redact(
      "Jan de Vries schreef dit. JAN vond het lastig. Volgens De Vries klopt het.",
      [student],
    );
    expect(text).toBe(
      "[STUDENT] schreef dit. [STUDENT] vond het lastig. Volgens [STUDENT] klopt het.",
    );
  });

  it("keeps the possessive ending outside the code", () => {
    const { text } = redact("Jans verslag en Jan's bijlage en Jan’s planning.", [student]);
    expect(text).toBe("[STUDENT]s verslag en [STUDENT]'s bijlage en [STUDENT]’s planning.");
  });

  it("never replaces inside another word, or a lone tussenvoegsel", () => {
    const { text } = redact("Januari, Jansen en de stage van de student.", [student]);
    expect(text).toBe("Januari, Jansen en de stage van de student.");
  });

  it("numbers codes when a category has more than one entry, and keeps a description after a company", () => {
    const entries: RedactEntry[] = [
      { kind: "supervisor", value: "Petra Jansen" },
      { kind: "supervisor", value: "Ahmed Bakker" },
      { kind: "company", value: "SportShop BV", description: "een webshop in sportartikelen" },
    ];
    const { text } = redact(
      "Petra Jansen en Ahmed Bakker begeleidden mij bij SportShop BV. Bij SportShop BV leerde ik veel.",
      entries,
    );
    expect(text).toBe(
      "[BEGELEIDER-1] en [BEGELEIDER-2] begeleidden mij bij [BEDRIJF] (een webshop in sportartikelen). Bij [BEDRIJF] leerde ik veel.",
    );
  });

  it("removes extra words the teacher selects", () => {
    const { text } = redact("Het project Zonnepark Noord liep goed.", [], ["Zonnepark Noord"]);
    expect(text).toBe("Het project [ANDER-1] liep goed.");
  });
});

describe("patterns, without AI", () => {
  it.each([
    ["mail me op jan.devries@student.hsleiden.nl vandaag", "mail me op [E-MAIL-1] vandaag"],
    ["bel 06-12345678 of +31 6 1234 5678", "bel [TELEFOON-1] of [TELEFOON-2]"],
    ["bel 071 518 8800", "bel [TELEFOON-1]"],
    ["Postcode 2333 CK Leiden", "Postcode [POSTCODE-1] Leiden"],
    ["IBAN NL91 ABNA 0417 1643 00", "IBAN [IBAN-1]"],
    ["studentnummer 1234567.", "studentnummer [NUMMER-1]."],
  ])("%s", (input, expected) => {
    expect(redact(input, []).text).toBe(expected);
  });

  it("leaves years, page numbers and percentages alone", () => {
    const input = "In 2024 steeg het met 15% (p. 12, tabel 3).";
    expect(redact(input, []).text).toBe(input);
  });

  it("gives the same value the same code", () => {
    expect(redact("a@b.nl en a@b.nl en c@d.nl", []).text).toBe(
      "[E-MAIL-1] en [E-MAIL-1] en [E-MAIL-2]",
    );
  });
});

describe("reviewing and restoring", () => {
  it("lets the teacher undo one replacement", () => {
    const text = "Jan de Vries en zijn begeleider.";
    const spans = findRedactions(text, [{ kind: "student", value: "Jan de Vries" }]);
    expect(spans).toHaveLength(1);
    expect(applyRedactions(text, spans, new Set([0])).text).toBe(text);
  });

  it("puts the names back in the result, and a round trip gives the original text", () => {
    const original = "Jan de Vries werkte bij SportShop BV met Petra Jansen (petra@sportshop.nl).";
    const entries: RedactEntry[] = [
      { kind: "student", value: "Jan de Vries" },
      { kind: "company", value: "SportShop BV" },
      { kind: "supervisor", value: "Petra Jansen" },
    ];
    const { text, codes } = redact(original, entries);
    expect(text).not.toMatch(/Jan|SportShop|Petra|petra@/);
    expect(restoreNames(text, codes)).toBe(original);
    expect(restoreNames("Feedback voor [STUDENT]: vraag [BEGELEIDER] om hulp.", codes)).toBe(
      "Feedback voor Jan de Vries: vraag Petra Jansen om hulp.",
    );
  });

  it("leaves an unknown code as it is", () => {
    expect(restoreNames("[ONBEKEND] blijft", {})).toBe("[ONBEKEND] blijft");
  });
});
