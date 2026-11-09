import { RUBRIC_LIMITS, type RubricCriterion, type RubricData, type RubricLevel } from "./schema";

/**
 * Pure, immutable rubric edits (P23.2). Each returns a new object and leaves its input alone;
 * an edit that would break a limit (a 31st criterion, a 7th level, removing the last criterion or
 * the second-to-last level) returns the input unchanged.
 */

const uuid = () => globalThis.crypto.randomUUID();

export function newCriterion(
  title: string,
  levels: readonly { label: string; points: number }[],
): RubricCriterion {
  return {
    id: uuid(),
    title,
    levels: levels.map((l) => ({ id: uuid(), label: l.label, points: l.points, description: "" })),
  };
}

export function newRubricData(
  title: string,
  levels: readonly { label: string; points: number }[],
): RubricData {
  return { criteria: [newCriterion(title, levels)] };
}

function move<T>(list: readonly T[], index: number, delta: -1 | 1): T[] | null {
  const to = index + delta;
  if (index < 0 || to < 0 || to >= list.length) return null;
  const next = [...list];
  const a = next[index];
  const b = next[to];
  if (a === undefined || b === undefined) return null;
  next[index] = b;
  next[to] = a;
  return next;
}

function mapCriterion(
  data: RubricData,
  id: string,
  fn: (c: RubricCriterion) => RubricCriterion,
): RubricData {
  return { ...data, criteria: data.criteria.map((c) => (c.id === id ? fn(c) : c)) };
}

export function addCriterion(data: RubricData, criterion: RubricCriterion): RubricData {
  if (data.criteria.length >= RUBRIC_LIMITS.criteria) return data;
  return { ...data, criteria: [...data.criteria, criterion] };
}

export function updateCriterion(
  data: RubricData,
  id: string,
  patch: Partial<Pick<RubricCriterion, "title" | "weight" | "knockout">>,
): RubricData {
  return mapCriterion(data, id, (c) => ({ ...c, ...patch }));
}

export function removeCriterion(data: RubricData, id: string): RubricData {
  if (data.criteria.length <= 1) return data;
  return { ...data, criteria: data.criteria.filter((c) => c.id !== id) };
}

export function moveCriterion(data: RubricData, id: string, delta: -1 | 1): RubricData {
  const next = move(
    data.criteria,
    data.criteria.findIndex((c) => c.id === id),
    delta,
  );
  return next ? { ...data, criteria: next } : data;
}

/** Adds a level worth one point more than the highest so far (capped at the points limit). */
export function addLevel(data: RubricData, criterionId: string, label: string): RubricData {
  return mapCriterion(data, criterionId, (c) => {
    if (c.levels.length >= RUBRIC_LIMITS.maxLevels) return c;
    const top = Math.max(...c.levels.map((l) => l.points));
    const level: RubricLevel = {
      id: uuid(),
      label,
      points: Math.min(RUBRIC_LIMITS.points, top + 1),
      description: "",
    };
    return { ...c, levels: [...c.levels, level] };
  });
}

export function updateLevel(
  data: RubricData,
  criterionId: string,
  levelId: string,
  patch: Partial<Omit<RubricLevel, "id">>,
): RubricData {
  return mapCriterion(data, criterionId, (c) => ({
    ...c,
    levels: c.levels.map((l) => (l.id === levelId ? { ...l, ...patch } : l)),
  }));
}

export function removeLevel(data: RubricData, criterionId: string, levelId: string): RubricData {
  return mapCriterion(data, criterionId, (c) =>
    c.levels.length <= RUBRIC_LIMITS.minLevels
      ? c
      : { ...c, levels: c.levels.filter((l) => l.id !== levelId) },
  );
}

export function moveLevel(
  data: RubricData,
  criterionId: string,
  levelId: string,
  delta: -1 | 1,
): RubricData {
  return mapCriterion(data, criterionId, (c) => {
    const next = move(
      c.levels,
      c.levels.findIndex((l) => l.id === levelId),
      delta,
    );
    return next ? { ...c, levels: next } : c;
  });
}
