/**
 * Filling in a rubric in a batch (P23.3): the student's name, the comment and the chosen levels
 * live only in this browser (`localStorage`, one entry per rubric). They never go to the server
 * or to an AI; the server sees only anonymous criterion → level pairs when the batch is closed,
 * and then this entry is wiped. Every storage call is wrapped: a private window or blocked
 * storage means the batch lives only as long as the page.
 *
 * Pure helpers (immutable) plus three storage calls that take the Storage as a parameter, so
 * tests need no browser.
 */

export interface LocalStudent {
  /** The app's code: "Student 7". Never reused within a batch. */
  code: number;
  /** Optional; the teacher's own label. Stays in the browser. */
  name: string;
  /** Optional; stays in the browser and disappears with the batch. */
  comment: string;
  /** criterion id → level id */
  levels: Record<string, string>;
}

export interface LocalBatch {
  rubricId: string;
  nextCode: number;
  students: LocalStudent[];
}

const KEY_PREFIX = "limeonit:rubric-batch:";
const keyFor = (rubricId: string) => `${KEY_PREFIX}${rubricId}`;

export const newBatch = (rubricId: string): LocalBatch => ({ rubricId, nextCode: 1, students: [] });

export function addStudent(batch: LocalBatch, name: string): LocalBatch {
  const student: LocalStudent = {
    code: batch.nextCode,
    name: name.trim().slice(0, 200),
    comment: "",
    levels: {},
  };
  return { ...batch, nextCode: batch.nextCode + 1, students: [...batch.students, student] };
}

export function removeStudent(batch: LocalBatch, code: number): LocalBatch {
  return { ...batch, students: batch.students.filter((s) => s.code !== code) };
}

export function updateStudent(
  batch: LocalBatch,
  code: number,
  patch: Partial<Pick<LocalStudent, "name" | "comment">>,
): LocalBatch {
  return {
    ...batch,
    students: batch.students.map((s) => (s.code === code ? { ...s, ...patch } : s)),
  };
}

export function setLevel(
  batch: LocalBatch,
  code: number,
  criterionId: string,
  levelId: string,
): LocalBatch {
  return {
    ...batch,
    students: batch.students.map((s) =>
      s.code === code ? { ...s, levels: { ...s.levels, [criterionId]: levelId } } : s,
    ),
  };
}

/** "Student 3 — Noor", or only "Student 3" without a name: the teacher's view of each student. */
export function studentLabel(student: LocalStudent, codeLabel: (n: number) => string): string {
  const code = codeLabel(student.code);
  return student.name ? `${code} — ${student.name}` : code;
}

export function restoreNames(batch: LocalBatch, codeLabel: (n: number) => string): string[] {
  return batch.students.map((s) => studentLabel(s, codeLabel));
}

function isBatch(value: unknown, rubricId: string): value is LocalBatch {
  if (!value || typeof value !== "object") return false;
  const b = value as LocalBatch;
  return (
    b.rubricId === rubricId &&
    Number.isInteger(b.nextCode) &&
    Array.isArray(b.students) &&
    b.students.every(
      (s) =>
        s &&
        Number.isInteger(s.code) &&
        typeof s.name === "string" &&
        typeof s.comment === "string" &&
        s.levels !== null &&
        typeof s.levels === "object",
    )
  );
}

const browserStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export function loadBatch(
  rubricId: string,
  storage: Storage | undefined = browserStorage(),
): LocalBatch | null {
  try {
    const raw = storage?.getItem(keyFor(rubricId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBatch(parsed, rubricId) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBatch(
  batch: LocalBatch,
  storage: Storage | undefined = browserStorage(),
): void {
  try {
    storage?.setItem(keyFor(batch.rubricId), JSON.stringify(batch));
  } catch {
    // Storage full or blocked: the batch lives on in the page only.
  }
}

export function clearBatch(
  rubricId: string,
  storage: Storage | undefined = browserStorage(),
): void {
  try {
    storage?.removeItem(keyFor(rubricId));
  } catch {
    // Nothing stored, nothing to wipe.
  }
}
