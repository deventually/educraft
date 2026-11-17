import { describe, expect, it } from "vitest";
import { getTopic } from "~/lib/help/registry";

/** Anonymiseerpoort PR 1: the help says what stays and how the student number is recognised. */
describe("help: anonymising before sending", () => {
  it.each([
    ["nl", /Bloom/, /los deel van een naam/i, /studentnummer dat je invult/i],
    ["en", /Bloom/, /single part of a name/i, /student number you fill in/i],
  ] as const)("in %s", (locale, ...patterns) => {
    const topic = getTopic("using-tools", locale);
    for (const p of patterns) expect(topic).toMatch(p);
  });
});
