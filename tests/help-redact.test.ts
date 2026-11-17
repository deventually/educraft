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

/** Anonymiseerpoort PR 2 and 3: the server checks too, and asks before sending what you did not see. */
describe("help: the gate on the server", () => {
  it.each([
    ["nl", /op de server/i, /collega/i, /Eerst even kijken/, /stuurt ze niets/i],
    ["en", /on the server/i, /colleague/i, /Look first/, /sends nothing/i],
  ] as const)("in %s", (locale, ...patterns) => {
    const topic = getTopic("using-tools", locale);
    for (const p of patterns) expect(topic).toMatch(p);
  });
});

/** Anonymiseerpoort PR 3: the live preview in every tool, and the never-list. */
describe("help: what goes to the AI", () => {
  it.each([
    ["nl", /Dit gaat naar de AI/, /Namen die eruit moeten/, /Nooit vervangen/, /Ook vervangen/],
    ["en", /What goes to the AI/, /Names that must go/, /Never replace/, /Also replace/],
  ] as const)("in %s", (locale, ...patterns) => {
    const topic = getTopic("using-tools", locale);
    for (const p of patterns) expect(topic).toMatch(p);
  });
});
