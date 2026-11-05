/**
 * Pure, immutable course edits (brief P20, 20.1). Every function returns a new
 * CourseData and leaves its input untouched. Unknown ids throw; a patch value of
 * `undefined` clears that optional field.
 */
import type {
  Activity,
  Assessment,
  AssessmentCoverage,
  AssessmentItem,
  CourseData,
  LearningOutcome,
} from "./types";

type Patch<T> = Partial<Omit<T, "id">>;

const newId = (): string => crypto.randomUUID();

/** A deep copy of an object without the keys whose value is undefined. */
function compact<T extends object>(value: T): T {
  const next = { ...value } as Record<string, unknown>;
  for (const [k, v] of Object.entries(next)) if (v === undefined) delete next[k];
  return structuredClone(next) as T;
}

const apply = <T extends { id: string }>(item: T, patch: Patch<T>): T =>
  compact({ ...item, ...patch });

const create = <T extends { id: string }>(fields: Omit<T, "id">): T =>
  compact({ id: newId(), ...fields } as T);

function assertOutcomes(d: CourseData, ids: string[]): void {
  const known = new Set(d.outcomes.map((o) => o.id));
  for (const id of ids) if (!known.has(id)) throw new Error(`Unknown learning outcome: ${id}`);
}

function assertCoverage(d: CourseData, coverage: AssessmentCoverage[] | undefined): void {
  if (coverage)
    assertOutcomes(
      d,
      coverage.map((c) => c.outcomeId),
    );
}

function replace<T extends { id: string }>(items: T[], id: string, patch: Patch<T>): T[] {
  if (!items.some((i) => i.id === id)) throw new Error(`Unknown item: ${id}`);
  return items.map((i) => (i.id === id ? apply(i, patch) : i));
}

function without<T extends { id: string }>(items: T[], id: string): T[] {
  if (!items.some((i) => i.id === id)) throw new Error(`Unknown item: ${id}`);
  return items.filter((i) => i.id !== id);
}

// Learning outcomes

export function addOutcome(d: CourseData, outcome: Omit<LearningOutcome, "id">): CourseData {
  return { ...structuredClone(d), outcomes: [...d.outcomes, create<LearningOutcome>(outcome)] };
}

export function updateOutcome(
  d: CourseData,
  id: string,
  patch: Patch<LearningOutcome>,
): CourseData {
  return { ...structuredClone(d), outcomes: replace(d.outcomes, id, patch) };
}

/** Also drops every reference to the outcome, so the graph stays consistent. */
export function removeOutcome(d: CourseData, id: string): CourseData {
  const next = structuredClone(d);
  return {
    ...next,
    outcomes: without(next.outcomes, id),
    activities: next.activities.map((a) => ({
      ...a,
      outcomeIds: a.outcomeIds.filter((o) => o !== id),
    })),
    assessments: next.assessments.map((a) => ({
      ...a,
      coverage: a.coverage.filter((c) => c.outcomeId !== id),
      ...(a.items && { items: a.items.filter((i) => i.outcomeId !== id) }),
    })),
  };
}

// Activities

export function addActivity(d: CourseData, activity: Omit<Activity, "id">): CourseData {
  assertOutcomes(d, activity.outcomeIds);
  return { ...structuredClone(d), activities: [...d.activities, create<Activity>(activity)] };
}

export function updateActivity(d: CourseData, id: string, patch: Patch<Activity>): CourseData {
  if (patch.outcomeIds) assertOutcomes(d, patch.outcomeIds);
  return { ...structuredClone(d), activities: replace(d.activities, id, patch) };
}

export function removeActivity(d: CourseData, id: string): CourseData {
  return { ...structuredClone(d), activities: without(d.activities, id) };
}

// Assessments

export function addAssessment(d: CourseData, assessment: Omit<Assessment, "id">): CourseData {
  assertCoverage(d, assessment.coverage);
  return {
    ...structuredClone(d),
    assessments: [...d.assessments, create<Assessment>(assessment)],
  };
}

export function updateAssessment(d: CourseData, id: string, patch: Patch<Assessment>): CourseData {
  assertCoverage(d, patch.coverage);
  return { ...structuredClone(d), assessments: replace(d.assessments, id, patch) };
}

export function removeAssessment(d: CourseData, id: string): CourseData {
  return { ...structuredClone(d), assessments: without(d.assessments, id) };
}

// Questions of an assessment (P26.1)

function withItems(
  d: CourseData,
  assessmentId: string,
  change: (items: AssessmentItem[]) => AssessmentItem[],
): CourseData {
  const next = structuredClone(d);
  if (!next.assessments.some((a) => a.id === assessmentId))
    throw new Error(`Unknown item: ${assessmentId}`);
  return {
    ...next,
    assessments: next.assessments.map((a) =>
      a.id === assessmentId ? { ...a, items: change(a.items ?? []) } : a,
    ),
  };
}

/** Replaces the whole question-level matrix; every question gets a fresh id. */
export function setAssessmentItems(
  d: CourseData,
  assessmentId: string,
  items: Omit<AssessmentItem, "id">[],
): CourseData {
  assertOutcomes(
    d,
    items.map((i) => i.outcomeId),
  );
  return withItems(d, assessmentId, () => items.map((i) => create<AssessmentItem>(i)));
}

export function addItem(
  d: CourseData,
  assessmentId: string,
  item: Omit<AssessmentItem, "id">,
): CourseData {
  assertOutcomes(d, [item.outcomeId]);
  return withItems(d, assessmentId, (items) => [...items, create<AssessmentItem>(item)]);
}

export function updateItem(
  d: CourseData,
  assessmentId: string,
  itemId: string,
  patch: Patch<AssessmentItem>,
): CourseData {
  if (patch.outcomeId) assertOutcomes(d, [patch.outcomeId]);
  return withItems(d, assessmentId, (items) => replace(items, itemId, patch));
}

export function removeItem(d: CourseData, assessmentId: string, itemId: string): CourseData {
  return withItems(d, assessmentId, (items) => without(items, itemId));
}

// Study load

/** Sets the course's EC; `undefined` clears it. */
export function setStudyLoad(d: CourseData, ec: number | undefined): CourseData {
  return compact({ ...d, ec });
}
