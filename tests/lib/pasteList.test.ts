import { describe, expect, it } from "vitest";
import { MAX_PASTED_LINES, parsePastedPeople } from "~/lib/people/pasteList";

describe("parsePastedPeople (P28.5)", () => {
  it("reads a name and an e-mail per line, in the usual shapes", () => {
    const rows = parsePastedPeople(
      [
        "Jan de Vries, jan@school.nl",
        "Fatima El Amrani; fatima@school.nl",
        "Piet Jansen\tpiet@school.nl", // pasted from a spreadsheet
        "Zoë Bakker <zoe@school.nl>",
        "kees@school.nl, Kees Smit", // e-mail first
      ].join("\n"),
    );
    expect(rows.map(({ text: _text, ...r }) => r)).toEqual([
      { line: 1, ok: true, name: "Jan de Vries", email: "jan@school.nl" },
      { line: 2, ok: true, name: "Fatima El Amrani", email: "fatima@school.nl" },
      { line: 3, ok: true, name: "Piet Jansen", email: "piet@school.nl" },
      { line: 4, ok: true, name: "Zoë Bakker", email: "zoe@school.nl" },
      { line: 5, ok: true, name: "Kees Smit", email: "kees@school.nl" },
    ]);
  });

  it("skips empty and blank lines but keeps the real line numbers", () => {
    const rows = parsePastedPeople("\n  \nJan, jan@school.nl\r\n\r\nAnna, anna@school.nl\n");
    expect(rows.map((r) => r.line)).toEqual([3, 5]);
  });

  it("refuses a line without a valid e-mail address", () => {
    const rows = parsePastedPeople("Jan de Vries\nAnna, anna@@school\nBert, bert@school");
    expect(rows).toEqual([
      { line: 1, ok: false, text: "Jan de Vries", reason: "invalidEmail" },
      { line: 2, ok: false, text: "Anna, anna@@school", reason: "invalidEmail" },
      { line: 3, ok: false, text: "Bert, bert@school", reason: "invalidEmail" },
    ]);
  });

  it("refuses a line without a name", () => {
    expect(parsePastedPeople("jan@school.nl")).toEqual([
      { line: 1, ok: false, text: "jan@school.nl", reason: "nameRequired" },
    ]);
  });

  it("refuses a line with two e-mail addresses", () => {
    expect(parsePastedPeople("Jan, jan@school.nl, piet@school.nl")[0]).toMatchObject({
      ok: false,
      reason: "invalidEmail",
    });
  });

  it("refuses a second line with the same e-mail, whatever its case", () => {
    const rows = parsePastedPeople("Jan, jan@school.nl\nJan V., JAN@School.nl");
    expect(rows[0]).toMatchObject({ ok: true, email: "jan@school.nl" });
    expect(rows[1]).toEqual({
      line: 2,
      ok: false,
      text: "Jan V., JAN@School.nl",
      reason: "duplicate",
    });
  });

  it("keeps each accepted line's own text, for the result table", () => {
    expect(parsePastedPeople("  Jan, jan@school.nl ")[0]).toMatchObject({
      text: "Jan, jan@school.nl",
    });
  });

  it("stores e-mail in lower case", () => {
    expect(parsePastedPeople("Jan, Jan@School.NL")[0]).toMatchObject({ email: "jan@school.nl" });
  });

  it("refuses an over-long name", () => {
    expect(parsePastedPeople(`${"a".repeat(201)}, a@b.nl`)[0]).toMatchObject({
      ok: false,
      reason: "nameTooLong",
    });
  });

  it("takes at most MAX_PASTED_LINES people and marks the rest as too many", () => {
    const text = Array.from(
      { length: MAX_PASTED_LINES + 2 },
      (_, i) => `P${i}, p${i}@school.nl`,
    ).join("\n");
    const rows = parsePastedPeople(text);
    expect(rows.filter((r) => r.ok)).toHaveLength(MAX_PASTED_LINES);
    expect(rows.filter((r) => !r.ok).map((r) => !r.ok && r.reason)).toEqual(["tooMany", "tooMany"]);
  });
});
