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

/** Anonymiseerpoort PR 2: the help says the server counts, and does not replace yet. */
describe("help: the gate on the server", () => {
  it.each([
    ["nl", /op de server/i, /telt/i, /collega/i, /nog niets vervangen/i],
    ["en", /on the server/i, /counts/i, /colleague/i, /nothing is replaced yet/i],
  ] as const)("in %s", (locale, ...patterns) => {
    const topic = getTopic("using-tools", locale);
    for (const p of patterns) expect(topic).toMatch(p);
  });
});
