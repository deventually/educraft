/**
 * The overview of a learning line (leerlijn): its courses in order, and the outcomes that come
 * back from course to course with their Bloom level. Pure and advisory, like the coverage
 * matrix: it reports, never changes a course, and uses no AI.
 *
 * An outcome "comes back" when a later course has the same text (ignoring case, spacing and a
 * closing full stop) or the same pack tag (e.g. one hbo-i beroepstaak). A number tag is a level,
 * not a theme, so it never forms a thread.
 */
import { bloomRank } from "~/lib/courses/bloom";
import type { BloomLevel, LearningOutcome } from "~/lib/courses/types";

export interface LineCourse {
  id: string;
  name: string;
  outcomes: LearningOutcome[];
}

type ThreadLabel = { kind: "text"; text: string } | { kind: "tag"; field: string; value: string };

export interface ThreadCell {
  outcomeIds: string[];
  /** The highest Bloom level of those outcomes, if any has one. */
  bloom?: BloomLevel;
}

export interface LineThread {
  key: string;
  label: ThreadLabel;
  /** One cell per course, in line order; null where the thread is absent. */
  cells: (ThreadCell | null)[];
  /** True when a later course asks a lower Bloom level than an earlier one. */
  drops: boolean;
}

export interface LineOverview {
  columns: {
    courseId: string;
    name: string;
    outcomes: { id: string; text: string; bloom?: BloomLevel }[];
  }[];
  threads: LineThread[];
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!]+$/, "");

/** The thread keys (and labels) one outcome belongs to. */
function keysOf(o: LearningOutcome): { key: string; label: ThreadLabel }[] {
  const keys: { key: string; label: ThreadLabel }[] = [
    { key: `text:${normalize(o.text)}`, label: { kind: "text", text: o.text } },
  ];
  for (const [field, raw] of Object.entries(o.packTags ?? {})) {
    if (typeof raw === "number") continue;
    for (const value of Array.isArray(raw) ? raw : [raw])
      keys.push({ key: `tag:${field}=${value}`, label: { kind: "tag", field, value } });
  }
  return keys;
}

const higher = (a: BloomLevel | undefined, b: BloomLevel | undefined) =>
  !a ? b : !b ? a : bloomRank(b) > bloomRank(a) ? b : a;

function drops(cells: (ThreadCell | null)[]): boolean {
  let max = -1;
  for (const c of cells) {
    if (!c?.bloom) continue;
    const r = bloomRank(c.bloom);
    if (r < max) return true;
    max = Math.max(max, r);
  }
  return false;
}

export function learningLineOverview(courses: LineCourse[]): LineOverview {
  const threads = new Map<string, { label: ThreadLabel; cells: (ThreadCell | null)[] }>();
  courses.forEach((course, i) => {
    for (const o of course.outcomes) {
      for (const { key, label } of keysOf(o)) {
        let t = threads.get(key);
        if (!t) {
          t = { label, cells: courses.map(() => null) };
          threads.set(key, t);
        }
        const cell = t.cells[i] ?? { outcomeIds: [] };
        if (!cell.outcomeIds.includes(o.id)) cell.outcomeIds.push(o.id);
        const bloom = higher(cell.bloom, o.bloom);
        t.cells[i] = bloom ? { ...cell, bloom } : cell;
      }
    }
  });
  return {
    columns: courses.map((c) => ({
      courseId: c.id,
      name: c.name,
      outcomes: c.outcomes.map((o) => ({
        id: o.id,
        text: o.text,
        ...(o.bloom && { bloom: o.bloom }),
      })),
    })),
    threads: [...threads]
      .filter(([, t]) => t.cells.filter(Boolean).length >= 2)
      .map(([key, t]) => ({ key, label: t.label, cells: t.cells, drops: drops(t.cells) })),
  };
}
