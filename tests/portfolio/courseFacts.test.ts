import { describe, expect, it } from "vitest";
import { anchorFacts, factsBlock } from "~/lib/portfolio/courseFacts";
import type { CourseData } from "~/lib/courses/types";

const data: CourseData = {
  code: "INF-DB1",
  studyYear: "2026-2027",
  phase: "Propedeuse",
  ec: 5,
  description: "Studenten leren een relationele database ontwerpen.",
  schedule: { weeks: 8, sessionMinutes: 90, groupSize: 24, deliveryMode: "in-person" },
  disciplines: [{ id: "d1", name: "Databases" }],
  outcomes: [
    { id: "o1", text: "De student ontwerpt een genormaliseerd datamodel." },
    { id: "o2", text: "De student schrijft SQL-queries." },
  ],
  activities: [
    {
      id: "les-1",
      title: "Normaliseren",
      kind: "lesson",
      week: 3,
      goal: "De student brengt een tabel naar de derde normaalvorm.",
      outcomeIds: ["o1"],
      disciplineId: "d1",
    },
    { id: "opdr-1", title: "Opdracht ERD", kind: "assignment", outcomeIds: [] },
  ],
  assessments: [
    {
      id: "toets-1",
      title: "Eindtoets databases",
      kind: "summative",
      week: 8,
      weight: 60,
      form: "Schriftelijk",
      passMark: 55,
      resit: "In week 10, één keer.",
      coverage: [{ outcomeId: "o2" }],
      items: [
        { id: "i1", label: "1", outcomeId: "o2", points: 2 },
        { id: "i2", label: "2", outcomeId: "o2", points: 3 },
      ],
      parts: [{ id: "p1", title: "Theorie", outcomeIds: ["o2"], weight: 40 }],
    },
  ],
};
const course = { name: "Databases 1", data };
const value = (facts: { key: string; value: string }[], key: string) =>
  facts.find((f) => f.key === key)?.value;

describe("anchorFacts: what the anchor's course already says", () => {
  it("a lesson brings the module's facts, the schedule and the lesson itself", () => {
    const facts = anchorFacts(course, { courseId: "c1", itemId: "les-1" }, "nl");
    expect(facts.map((f) => f.key)).toEqual([
      "course",
      "code",
      "studyYear",
      "phase",
      "ec",
      "weeks",
      "groupSize",
      "sessionMinutes",
      "deliveryMode",
      "lesson",
      "week",
      "lessonGoal",
      "discipline",
      "outcomes",
    ]);
    expect(value(facts, "course")).toBe("Databases 1");
    expect(value(facts, "groupSize")).toBe("24");
    expect(value(facts, "sessionMinutes")).toBe("90 minuten");
    expect(value(facts, "deliveryMode")).toBe("Op locatie");
    expect(value(facts, "lessonGoal")).toBe(
      "De student brengt een tabel naar de derde normaalvorm.",
    );
    expect(value(facts, "discipline")).toBe("Databases");
    expect(value(facts, "outcomes")).toBe("De student ontwerpt een genormaliseerd datamodel.");
  });

  it("an assignment is named as one, and absent fields are left out", () => {
    const facts = anchorFacts(
      { name: "Leeg", data: { outcomes: [], activities: data.activities, assessments: [] } },
      { courseId: "c1", itemId: "opdr-1" },
      "en",
    );
    expect(facts).toEqual([
      { key: "course", value: "Leeg" },
      { key: "assignment", value: "Opdracht ERD" },
    ]);
  });

  it("a test brings its kind, form, weight, pass mark, resit, parts and questions", () => {
    const facts = anchorFacts(course, { courseId: "c1", itemId: "toets-1" }, "nl");
    expect(value(facts, "test")).toBe("Eindtoets databases");
    expect(value(facts, "testKind")).toBe("Summatief");
    expect(value(facts, "form")).toBe("Schriftelijk");
    expect(value(facts, "week")).toBe("8");
    expect(value(facts, "weight")).toBe("60%");
    expect(value(facts, "passMark")).toBe("55%");
    expect(value(facts, "resit")).toBe("In week 10, één keer.");
    expect(value(facts, "parts")).toBe("Theorie (40%)");
    expect(value(facts, "questions")).toBe("2");
    expect(value(facts, "outcomes")).toBe("De student schrijft SQL-queries.");
    // A test is not a lesson: no lesson goal or discipline.
    expect(value(facts, "lessonGoal")).toBeUndefined();
  });

  it("a module brings its description and every outcome", () => {
    const facts = anchorFacts(course, { courseId: "c1" }, "en");
    expect(value(facts, "description")).toBe("Studenten leren een relationele database ontwerpen.");
    expect(value(facts, "outcomes")).toBe(
      "De student ontwerpt een genormaliseerd datamodel.; De student schrijft SQL-queries.",
    );
    expect(value(facts, "sessionMinutes")).toBe("90 minutes");
    expect(value(facts, "deliveryMode")).toBe("In person");
  });

  it("an item that is gone gives no facts at all", () => {
    expect(anchorFacts(course, { courseId: "c1", itemId: "weg" }, "nl")).toEqual([]);
  });

  it("keeps every value on one clipped line", () => {
    const long = { ...data, description: `Regel een\n\nregel twee ${"x".repeat(2_000)}` };
    const facts = anchorFacts({ name: "D", data: long }, { courseId: "c1" }, "nl");
    const description = value(facts, "description") ?? "";
    expect(description).not.toContain("\n");
    expect(description.startsWith("Regel een regel twee")).toBe(true);
    expect(description.length).toBeLessThanOrEqual(600);
  });
});

describe("factsBlock: the facts as data for the coach", () => {
  it("is a tagged block with a label per line, and empty without facts", () => {
    const facts = anchorFacts(course, { courseId: "c1", itemId: "les-1" }, "nl");
    const block = factsBlock(facts, "nl");
    expect(block.startsWith("<course>\n")).toBe(true);
    expect(block.endsWith("\n</course>")).toBe(true);
    expect(block).toContain("Groepsgrootte: 24");
    expect(block).toContain("Lesdoel: De student brengt een tabel naar de derde normaalvorm.");
    expect(factsBlock(facts, "en")).toContain("Group size: 24");
    expect(factsBlock([], "nl")).toBe("");
  });
});
