/**
 * Cohort repository (Phase 6). A cohort is the shared configuration a teacher
 * provisions once — allowed tutors, per-tutor sandbox config, the context profile
 * whose level is injected for members, and an access window. Per-student invites
 * are minted against it (see `users.server`); redeeming one joins the cohort.
 *
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported *DB* function is async; no better-sqlite3 API outside `db.server.ts`.
 * `isCohortActive` / `allowedSlugsOf` are pure predicates over an already-loaded
 * row, so they stay synchronous.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import {
  cohortMemberships,
  cohortTeachers,
  cohorts,
  type CohortMembershipRow,
  type CohortRow,
} from "../schema.server";
import type { Role } from "~/lib/registry/access";

/** Per-tutor sandbox config: `{ [slug]: { values: { field: value } } }`. */
export type CohortConfig = Record<string, { values: Record<string, string> }>;

export interface CreateCohortInput {
  createdByUserId: string;
  name: string;
  allowedToolSlugs: string[];
  config?: CohortConfig;
  contextProfileId?: string | null;
  activeUntil?: Date | null;
}

export async function createCohort(input: CreateCohortInput): Promise<CohortRow> {
  const row: CohortRow = {
    id: randomUUID(),
    createdByUserId: input.createdByUserId,
    name: input.name,
    allowedToolSlugs: JSON.stringify(input.allowedToolSlugs),
    configJson: JSON.stringify(input.config ?? {}),
    contextProfileId: input.contextProfileId ?? null,
    activeUntil: input.activeUntil ?? null,
    createdAt: new Date(),
  };
  getDb().insert(cohorts).values(row).run();
  return row;
}

export interface UpdateCohortPatch {
  name?: string;
  allowedToolSlugs?: string[];
  config?: CohortConfig;
  contextProfileId?: string | null;
  activeUntil?: Date | null;
}

/** Edit a cohort's config/allow-list/window in place. Only provided keys change. */
export async function updateCohort(id: string, patch: UpdateCohortPatch): Promise<void> {
  const set: Partial<CohortRow> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.allowedToolSlugs !== undefined)
    set.allowedToolSlugs = JSON.stringify(patch.allowedToolSlugs);
  if (patch.config !== undefined) set.configJson = JSON.stringify(patch.config);
  if (patch.contextProfileId !== undefined) set.contextProfileId = patch.contextProfileId;
  if (patch.activeUntil !== undefined) set.activeUntil = patch.activeUntil;
  if (Object.keys(set).length === 0) return;
  getDb().update(cohorts).set(set).where(eq(cohorts.id, id)).run();
}

export async function getCohort(id: string): Promise<CohortRow | null> {
  return getDb().select().from(cohorts).where(eq(cohorts.id, id)).get() ?? null;
}

export async function listCohortsByOwner(userId: string): Promise<CohortRow[]> {
  return getDb()
    .select()
    .from(cohorts)
    .where(eq(cohorts.createdByUserId, userId))
    .orderBy(desc(cohorts.createdAt))
    .all();
}

/**
 * Join a student to a cohort. Idempotent: the unique (cohort,user) index means a
 * replayed redemption is a no-op rather than a crash.
 */
export async function addMembership(
  cohortId: string,
  userId: string,
): Promise<CohortMembershipRow> {
  const db = getDb();
  const existing = db
    .select()
    .from(cohortMemberships)
    .where(eq(cohortMemberships.userId, userId))
    .all()
    .find((m) => m.cohortId === cohortId);
  if (existing) return existing;
  const row: CohortMembershipRow = {
    id: randomUUID(),
    cohortId,
    userId,
    createdAt: new Date(),
  };
  db.insert(cohortMemberships).values(row).onConflictDoNothing().run();
  return row;
}

/**
 * The student's active cohort (MVP: at most one). Resolves the most recent
 * membership → its cohort. `null` when the user has no membership.
 */
export async function getCohortForUser(userId: string): Promise<CohortRow | null> {
  const db = getDb();
  const membership = db
    .select()
    .from(cohortMemberships)
    .where(eq(cohortMemberships.userId, userId))
    .orderBy(desc(cohortMemberships.createdAt))
    .get();
  if (!membership) return null;
  return db.select().from(cohorts).where(eq(cohorts.id, membership.cohortId)).get() ?? null;
}

/** How many students have joined a cohort (for the owner's list view). */
export async function countCohortMembers(cohortId: string): Promise<number> {
  return getDb()
    .select()
    .from(cohortMemberships)
    .where(eq(cohortMemberships.cohortId, cohortId))
    .all().length;
}

/** The parsed allow-list of a cohort. */
export function allowedSlugsOf(cohort: CohortRow): Set<string> {
  const parsed = JSON.parse(cohort.allowedToolSlugs) as string[];
  return new Set(parsed);
}

/**
 * The set of tool slugs a user's cohort allows, or `null` when the user has no
 * cohort (the call site then falls back to "all student tools").
 */
export async function getAllowedToolSlugs(userId: string): Promise<Set<string> | null> {
  const cohort = await getCohortForUser(userId);
  return cohort ? allowedSlugsOf(cohort) : null;
}

/** The cohort's per-tutor sandbox config, parsed. */
export function cohortConfig(cohort: CohortRow): CohortConfig {
  return JSON.parse(cohort.configJson) as CohortConfig;
}

/** Whether the cohort's access window is still open. */
export function isCohortActive(cohort: CohortRow): boolean {
  return !cohort.activeUntil || cohort.activeUntil.getTime() > Date.now();
}

// ── Multi-teacher assignment & admin oversight (Phase 4) ────────────────────

/**
 * Whether `user` may manage `cohort`: admins always; the creator; and any
 * assigned co-teacher (pass their ids via `getCohortTeacherIds`). Pure predicate
 * over already-loaded rows, mirroring `isCohortActive`.
 */
export function canManageCohort(
  user: { id: string; role: Role },
  cohort: Pick<CohortRow, "createdByUserId">,
  teacherIds: Set<string>,
): boolean {
  if (user.role === "admin") return true;
  if (cohort.createdByUserId === user.id) return true;
  return teacherIds.has(user.id);
}

/** Assign a co-teacher to a cohort. Idempotent (unique (cohort,user) index). */
export async function addCohortTeacher(cohortId: string, userId: string): Promise<void> {
  getDb()
    .insert(cohortTeachers)
    .values({ id: randomUUID(), cohortId, userId, createdAt: new Date() })
    .onConflictDoNothing()
    .run();
}

/** Remove a co-teacher assignment. */
export async function removeCohortTeacher(cohortId: string, userId: string): Promise<void> {
  getDb()
    .delete(cohortTeachers)
    .where(and(eq(cohortTeachers.cohortId, cohortId), eq(cohortTeachers.userId, userId)))
    .run();
}

/** The set of teachers explicitly assigned to a cohort (excludes the creator). */
export async function getCohortTeacherIds(cohortId: string): Promise<Set<string>> {
  const rows = getDb()
    .select({ userId: cohortTeachers.userId })
    .from(cohortTeachers)
    .where(eq(cohortTeachers.cohortId, cohortId))
    .all();
  return new Set(rows.map((r) => r.userId));
}

/** Cohorts a teacher manages: ones they created plus ones they're assigned to. */
export async function listCohortsForManager(userId: string): Promise<CohortRow[]> {
  const db = getDb();
  const owned = db
    .select()
    .from(cohorts)
    .where(eq(cohorts.createdByUserId, userId))
    .orderBy(desc(cohorts.createdAt))
    .all();
  const assignedIds = db
    .select({ cohortId: cohortTeachers.cohortId })
    .from(cohortTeachers)
    .where(eq(cohortTeachers.userId, userId))
    .all()
    .map((r) => r.cohortId);
  const seen = new Set(owned.map((c) => c.id));
  const assigned = assignedIds
    .filter((id) => !seen.has(id))
    .map((id) => db.select().from(cohorts).where(eq(cohorts.id, id)).get())
    .filter((c): c is CohortRow => Boolean(c));
  return [...owned, ...assigned].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Every cohort on the instance, newest first — the admin oversight list. */
export async function listAllCohorts(): Promise<CohortRow[]> {
  return getDb().select().from(cohorts).orderBy(desc(cohorts.createdAt)).all();
}

/**
 * Delete a cohort and its edges (memberships + teacher assignments) in one
 * transaction. Admin-only in the route; unscoped here so an admin can remove a
 * cohort they did not create. Existing member *accounts* are left intact — only
 * their membership link is dropped (they simply lose the cohort's tools/window).
 */
export async function deleteCohort(id: string): Promise<void> {
  getDb().transaction((tx) => {
    tx.delete(cohortMemberships).where(eq(cohortMemberships.cohortId, id)).run();
    tx.delete(cohortTeachers).where(eq(cohortTeachers.cohortId, id)).run();
    tx.delete(cohorts).where(eq(cohorts.id, id)).run();
  });
}
