/**
 * What the anchor's course already says (step 4 of the guided route, used in step 6): the module's
 * details and schedule, and the lesson or test the outcome is about, as facts the teacher recorded
 * themselves. Pure and without AI. The Chapter tab shows them; guided writing sends them as
 * `<course>`, so the coach does not ask for them again and a drafted paragraph needs no open spot
 * for them. The server looks up the course (owner or member only) and passes it in.
 */
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { effectiveCoverage } from "~/lib/courses/alignment";
import type { CourseData } from "~/lib/courses/types";
import { anchorKind, type AnchorRef } from "./anchors";

export type FactKey = keyof ReturnType<typeof getMessages>["portfolioFacts"]["labels"];

export interface CourseFact {
  key: FactKey;
  value: string;
}

/** What the anchor's course already says, with the course it comes from (built on the server). */
export interface CourseFactsView {
  courseId: string;
  course: string;
  facts: CourseFact[];
}

/** One value per fact, on one line: a fact is never a place for structure. */
const MAX_VALUE = 600;
const line = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_VALUE);

/** The facts in a fixed order: the module, its schedule, then the lesson or the test. */
export function anchorFacts(
  course: { name: string; data: CourseData },
  ref: AnchorRef,
  locale: Locale,
): CourseFact[] {
  const { data } = course;
  const kind = anchorKind(data, ref.itemId);
  if (!kind) return [];
  const m = getMessages(locale);
  const facts: CourseFact[] = [];
  const add = (key: FactKey, value: string | number | undefined) => {
    const v = value === undefined ? "" : line(String(value));
    if (v) facts.push({ key, value: v });
  };
  const outcomesOf = (ids: string[]) =>
    data.outcomes
      .filter((o) => ids.includes(o.id))
      .map((o) => o.text)
      .join("; ");
  const s = data.schedule;

  add("course", course.name);
  add("code", data.code);
  add("studyYear", data.studyYear);
  add("phase", data.phase);
  add("ec", data.ec);
  add("weeks", s?.weeks);
  add("groupSize", s?.groupSize);
  add(
    "sessionMinutes",
    s?.sessionMinutes && fmt(m.portfolioFacts.minutes, { n: s.sessionMinutes }),
  );
  add("deliveryMode", s?.deliveryMode && m.courses.schedule.deliveryModes[s.deliveryMode]);

  if (kind === "module") {
    add("description", data.description);
    add("outcomes", outcomesOf(data.outcomes.map((o) => o.id)));
  }
  const lesson = data.activities.find((a) => a.id === ref.itemId);
  if (lesson) {
    add(lesson.kind, lesson.title);
    add("week", lesson.week);
    add("lessonGoal", lesson.goal);
    add("discipline", data.disciplines?.find((d) => d.id === lesson.disciplineId)?.name);
    add("outcomes", outcomesOf(lesson.outcomeIds));
  }
  const test = data.assessments.find((a) => a.id === ref.itemId);
  if (test) {
    add("test", test.title);
    add("testKind", m.courses.assessments.kinds[test.kind]);
    add("form", test.form);
    add("week", test.week);
    add("weight", test.weight !== undefined ? `${test.weight}%` : undefined);
    add("passMark", test.passMark !== undefined ? `${test.passMark}%` : undefined);
    add("resit", test.resit);
    add(
      "parts",
      test.parts
        ?.map((p) => (p.weight !== undefined ? `${p.title} (${p.weight}%)` : p.title))
        .join("; "),
    );
    add("questions", test.items?.length || undefined);
    add("outcomes", outcomesOf(effectiveCoverage(test).map((c) => c.outcomeId)));
  }
  return facts;
}

/** The facts as data for the coach's message; "" without any. */
export function factsBlock(facts: CourseFact[], locale: Locale): string {
  if (facts.length === 0) return "";
  const f = getMessages(locale).portfolioFacts;
  const lines = facts.map((x) => `${f.labels[x.key]}: ${x.value}`);
  return `<course>\n${f.promptIntro}\n${lines.join("\n")}\n</course>`;
}
