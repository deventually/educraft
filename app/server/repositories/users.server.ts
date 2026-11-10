/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "../db.server";
import { handOverToCoOwners } from "./courseTransfer.server";
import {
  agentChoices,
  agentReviews,
  contextProfiles,
  courseLinks,
  courseMembers,
  programmeCourses,
  courses,
  portfolioDossiers,
  reviewDecisions,
  rubricScores,
  rubrics,
  assessmentModels,
  shares,
  teamMembers,
  featureExceptions,
  feedback,
  pilotCheckins,
  generations,
  instanceSettings,
  passwordResets,
  recoveryCodes,
  twoFactor,
  usage,
  users,
  type UserRow,
} from "../schema.server";
import type { Role } from "~/lib/registry/access";

// Accounts live here; the admin list, invites, reset links and own model sets each have
// their own module. Re-exported so callers keep one import path.
export * from "./assignedModels.server";
export * from "./invites.server";
export * from "./passwordResets.server";
export * from "./people.server";

export interface CreateUserInput {
  /** Optional explicit id so an invite can claim it atomically before creation. */
  id?: string;
  name: string;
  email?: string | null;
  passwordHash: string;
  role: Role;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const row: UserRow = {
    id: input.id ?? randomUUID(),
    name: input.name,
    email: input.email ?? null,
    passwordHash: input.passwordHash,
    role: input.role,
    sessionVersion: 0,
    disabledAt: null,
    createdAt: new Date(),
  };
  getDb().insert(users).values(row).run();
  return row;
}

/** Every account, newest first — the admin user list. Not user-scoped by design. */
export async function listUsers(): Promise<UserRow[]> {
  return getDb().select().from(users).orderBy(desc(users.createdAt)).all();
}

/**
 * Change a user's role (admin console). The self-demotion guard lives in the route.
 * A role change also voids the user's open reset links (P18.6): a link a regular
 * admin minted while the user was a teacher must not open the account once it is
 * an admin. A real role change also bumps `sessionVersion` (P18.9): the user is logged
 * out on every device, so a teacher session never silently becomes an admin one. The
 * caller never changes their own role (route guard), so no cookie reissue is needed.
 */
export async function setUserRole(id: string, role: Role): Promise<void> {
  getDb().transaction((tx) => {
    const changed = tx
      .update(users)
      .set({ role, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(and(eq(users.id, id), ne(users.role, role)))
      .run();
    if (changed.changes > 0) {
      tx.delete(passwordResets).where(eq(passwordResets.userId, id)).run();
    }
  });
}

/**
 * Overwrite a user's email — self-service change (`/account`) or admin recovery
 * of an email-less account. Pass null to clear. Uniqueness is enforced by the
 * schema's unique index; callers check for a collision first for a clean error.
 */
export async function updateUserEmail(id: string, email: string | null): Promise<void> {
  getDb().update(users).set({ email }).where(eq(users.id, id)).run();
}

/**
 * Overwrite a user's password hash (self-service change, reset-link redemption or the
 * owner setting one) and bump `sessionVersion` in the same statement, so every session
 * minted before the change is logged out. Callers re-issue the acting device's cookie
 * afterwards. Every open reset / set-password link of the user is voided in the same
 * transaction: an older link must not overwrite the new password.
 * Together with `setUserDisabled` (deactivation), a real role change in `setUserRole` and
 * `logOutEverywhere` this is one of the FOUR places `sessionVersion` changes — a plain
 * login never does.
 */
export async function updateUserPassword(id: string, passwordHash: string): Promise<void> {
  getDb().transaction((tx) => {
    tx.update(users)
      .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, id))
      .run();
    tx.delete(passwordResets).where(eq(passwordResets.userId, id)).run();
  });
}

/**
 * "Log out everywhere" (P1-4, `/account`): bump `sessionVersion` and nothing else, so
 * every cookie of the account — this device's included — is dead. The fourth and last
 * place the counter changes (see `updateUserPassword`). The caller destroys the acting
 * device's session; logging in again mints a cookie with the new version.
 */
export async function logOutEverywhere(id: string): Promise<void> {
  getDb()
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, id))
    .run();
}

/**
 * Deactivate or reactivate an account (P18.7, super admin only; the guard lives in the
 * route). Deactivating stamps `disabledAt` and bumps `sessionVersion` in the same
 * statement, so every cookie minted before is dead for good — reactivating later does
 * not bring them back. It is the second place the counter changes (see
 * `updateUserPassword`). It also voids the account's open reset links. Deactivating an
 * already deactivated account keeps the original timestamp and the counter; reactivating
 * only clears `disabledAt`.
 */
export async function setUserDisabled(id: string, disabled: boolean): Promise<void> {
  const db = getDb();
  if (disabled) {
    db.transaction((tx) => {
      tx.update(users)
        .set({ disabledAt: new Date(), sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(and(eq(users.id, id), isNull(users.disabledAt)))
        .run();
      // Like a role change: open reset / set-password links die with the deactivation,
      // so reactivating later does not revive a link that may have leaked meanwhile.
      tx.delete(passwordResets).where(eq(passwordResets.userId, id)).run();
    });
  } else {
    db.update(users).set({ disabledAt: null }).where(eq(users.id, id)).run();
  }
}

export async function getUserById(id: string): Promise<UserRow | null> {
  return getDb().select().from(users).where(eq(users.id, id)).get() ?? null;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  return getDb().select().from(users).where(eq(users.email, email)).get() ?? null;
}

export async function deleteUser(id: string): Promise<void> {
  getDb().delete(users).where(eq(users.id, id)).run();
}

/**
 * Delete-my-data cascade (AVG / AI Act, audit finding). Removes everything the
 * user owns — feedback, pilot check-ins, usage counters, generations and context profiles,
 * then the user row, in a single transaction so a partial
 * failure leaves nothing orphaned. Scoped by `userId`/`id`, so another user's
 * rows are never touched.
 */
export async function deleteUserCascade(id: string): Promise<void> {
  // A course with a co-owner stays: it goes to the earliest co-owner first.
  await handOverToCoOwners(id);
  getDb().transaction((tx) => {
    tx.delete(feedback).where(eq(feedback.userId, id)).run();
    tx.delete(pilotCheckins).where(eq(pilotCheckins.userId, id)).run();
    tx.delete(usage).where(eq(usage.userId, id)).run();
    tx.delete(generations).where(eq(generations.userId, id)).run();
    tx.delete(contextProfiles).where(eq(contextProfiles.userId, id)).run();
    tx.delete(portfolioDossiers).where(eq(portfolioDossiers.userId, id)).run();
    tx.delete(rubricScores).where(eq(rubricScores.userId, id)).run();
    tx.delete(rubrics).where(eq(rubrics.userId, id)).run();
    tx.delete(assessmentModels).where(eq(assessmentModels.userId, id)).run();
    // Reviews by the account, and colleagues' reviews of the account's courses.
    const ownCourses = tx.select({ id: courses.id }).from(courses).where(eq(courses.userId, id));
    const gone = tx
      .select({ id: agentReviews.id })
      .from(agentReviews)
      .where(or(eq(agentReviews.userId, id), inArray(agentReviews.courseId, ownCourses)));
    tx.delete(reviewDecisions)
      .where(or(eq(reviewDecisions.userId, id), inArray(reviewDecisions.reviewId, gone)))
      .run();
    tx.delete(agentReviews)
      .where(or(eq(agentReviews.userId, id), inArray(agentReviews.courseId, ownCourses)))
      .run();
    tx.delete(agentChoices).where(eq(agentChoices.userId, id)).run();
    // The account's courses go with everyone's links to them and their editors; the
    // account's own editorships and links on colleagues' courses go too.
    tx.delete(courseLinks)
      .where(or(eq(courseLinks.userId, id), inArray(courseLinks.courseId, ownCourses)))
      .run();
    tx.delete(courseMembers)
      .where(or(eq(courseMembers.userId, id), inArray(courseMembers.courseId, ownCourses)))
      .run();
    tx.delete(courses).where(eq(courses.userId, id)).run();
    tx.delete(programmeCourses).where(eq(programmeCourses.userId, id)).run();
    tx.delete(teamMembers).where(eq(teamMembers.userId, id)).run();
    tx.delete(shares).where(eq(shares.ownerUserId, id)).run();
    tx.delete(featureExceptions).where(eq(featureExceptions.userId, id)).run();
    tx.delete(twoFactor).where(eq(twoFactor.userId, id)).run();
    tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, id)).run();
    // The teacher's own model set lives in instance_settings.
    tx.delete(instanceSettings)
      .where(eq(instanceSettings.key, `assignedModels:${id}`))
      .run();
    tx.delete(users).where(eq(users.id, id)).run();
  });
}
