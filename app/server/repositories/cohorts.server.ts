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
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import {
  cohortMemberships,
  cohorts,
  type CohortMembershipRow,
  type CohortRow,
} from "../schema.server";

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
