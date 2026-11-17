import { describe, expect, it } from "vitest";
import { applyRedactions, findRedactions, type RedactEntry } from "~/lib/privacy/redact";

/**
 * Not removing too much (anonymiseerpoort, PR 1): a lone part of a name goes only when it really
 * is a name. Seam: `findRedactions` + `applyRedactions`, the engine every caller uses.
 */
const redact = (
  text: string,
  entries: RedactEntry[],
  options?: Parameters<typeof findRedactions>[3],
) => applyRedactions(text, findRedactions(text, entries, [], options)).text;

describe("a lone part of a name", () => {
  const roos: RedactEntry = { kind: "supervisor", value: "Roos Bakker" };

  it("always goes as the full name, in any case", () => {
    expect(redact("Vandaag sprak ik roos bakker over de stage.", [roos])).toBe(
      "Vandaag sprak ik [BEGELEIDER] over de stage.",
    );
  });

  it("goes only with a capital", () => {
    const petra: RedactEntry = { kind: "supervisor", value: "Petra Smeets" };
    expect(redact("Petra keek mee; daarna mailde petra en smeets terug.", [petra])).toBe(
      "[BEGELEIDER] keek mee; daarna mailde petra en smeets terug.",
    );
  });

  it("that is a common word goes only with a capital in the middle of a sentence", () => {
    const options = { commonWords: ["roos", "bakker", "bas"] };
    expect(
      redact(
        "Ik vroeg Roos om feedback. Roos rood is mooi. De bakker en een roos. Met Bakker ging het goed.",
        [roos],
        options,
      ),
    ).toBe(
      "Ik vroeg [BEGELEIDER] om feedback. Roos rood is mooi. De bakker en een roos. Met [BEGELEIDER] ging het goed.",
    );
  });

  it("at the start of a line or after a bullet counts as the start of a sentence", () => {
    const options = { commonWords: ["roos"] };
    expect(redact("Feedback:\n- Roos is een bloem\nRoos ook", [roos], options)).toBe(
      "Feedback:\n- Roos is een bloem\nRoos ook",
    );
  });

  it("on the keep list is never replaced alone, but the full name still goes", () => {
    const anna: RedactEntry = { kind: "student", value: "Anna Bloom" };
    expect(
      redact("Volgens Bloom en volgens Anna Bloom; Anna schreef het.", [anna], { keep: ["bloom"] }),
    ).toBe("Volgens Bloom en volgens [STUDENT]; [STUDENT] schreef het.");
  });
});

describe("a surname with its particle", () => {
  it("goes only with a capital surname, so an ordinary phrase stays", () => {
    const iris: RedactEntry = { kind: "student", value: "Iris de Wit" };
    expect(redact("De wit-gele kaarten. Volgens De Wit en de Wit, niet de wit.", [iris])).toBe(
      "De wit-gele kaarten. Volgens [STUDENT] en [STUDENT], niet de wit.",
    );
  });
});

describe("names in file names", () => {
  it("are found with underscores between the parts", () => {
    const jan: RedactEntry = { kind: "student", value: "Jan de Vries" };
    expect(redact("jan_de_vries_reflectie.docx en Jan_de_Vries-logboek.pdf", [jan])).toBe(
      "[STUDENT]_reflectie.docx en [STUDENT]-logboek.pdf",
    );
  });

  it("are found written together with capitals, but not as an ordinary word", () => {
    const mark: RedactEntry = { kind: "supervisor", value: "Mark Groen" };
    expect(redact("Lesplan_MarkGroen.docx, MARKGROEN.pdf en markgroen.txt", [mark])).toBe(
      "Lesplan_[BEGELEIDER].docx, MARKGROEN.pdf en markgroen.txt",
    );
  });
});

describe("the student number of the institution", () => {
  const options = { studentNumber: "s?\\d{7}" };

  it("replaces only that format, also inside a file name", () => {
    expect(redact("Student s1234567 en 7654321, bestand s1234567_stage.pdf.", [], options)).toBe(
      "Student [NUMMER-1] en [NUMMER-2], bestand [NUMMER-1]_stage.pdf.",
    );
  });

  it("leaves other number runs alone", () => {
    const input = "Order 123456 en referentie 12345678 op 20261117.";
    expect(redact(input, [], options)).toBe(input);
  });

  it("without a format falls back to any run of 6 to 8 digits", () => {
    expect(redact("Nummer 123456.", [])).toBe("Nummer [NUMMER-1].");
  });
});

describe("patterns that look like a postcode or a phone number", () => {
  it.each([
    "De minor is 30 EC; het hele programma 1200 EC.",
    "Studiejaar 2023-2024 en 2024-2025, cohort 2025.",
    "Op 17-11-2026 om 10.30 uur, lokaal 0.12.",
    "Een stage van 840 uur (2024 SA).",
  ])("leaves %s alone", (input) => {
    expect(redact(input, [])).toBe(input);
  });

  it("still replaces a real postcode", () => {
    expect(redact("Zernikedreef 11, 2333 CK Leiden", [])).toBe(
      "Zernikedreef 11, [POSTCODE-1] Leiden",
    );
  });
});
