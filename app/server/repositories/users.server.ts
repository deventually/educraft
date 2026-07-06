/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db.server";
import {
  chatSessions,
  cohortMemberships,
  cohortTeachers,
  cohorts,
  contextProfiles,
  feedback,
  generations,
  instanceSettings,
  invites,
  messages,
  passwordResets,
  sessionSummaries,
  usage,
  users,
  type InviteRow,
  type PasswordResetRow,
  type UserRow,
} from "../schema.server";
import type { Role } from "~/lib/registry/access";

export interface CreateUserInput {
  /** Optional explicit id so an invite can claim it atomically before creation. */
  id?: string;
  name: string;
  email?: string | null;
  passwordHash: string;
  role: Role;
  /** Per-teacher tool allow-list (Phase 4); null = unrestricted. */
  allowedToolSlugs?: string[] | null;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const row: UserRow = {
    id: input.id ?? randomUUID(),
    name: input.name,
    email: input.email ?? null,
    passwordHash: input.passwordHash,
    role: input.role,
    sessionVersion: 0,
    allowedToolSlugs:
      input.allowedToolSlugs && input.allowedToolSlugs.length > 0
        ? JSON.stringify(input.allowedToolSlugs)
        : null,
    createdAt: new Date(),
  };
  getDb().insert(users).values(row).run();
  return row;
}

/** Every account, newest first — the admin user list. Not user-scoped by design. */
export async function listUsers(): Promise<UserRow[]> {
  return getDb().select().from(users).orderBy(desc(users.createdAt)).all();
}

/** Change a user's role (admin console). The self-demotion guard lives in the route. */
export async function setUserRole(id: string, role: Role): Promise<void> {
  getDb().update(users).set({ role }).where(eq(users.id, id)).run();
}

/**
 * Overwrite a user's email — self-service change (`/account`) or admin recovery
 * of an email-less account. Pass null to clear. Uniqueness is enforced by the
 * schema's unique index; callers check for a collision first for a clean error.
 */
export async function updateUserEmail(id: string, email: string | null): Promise<void> {
  getDb().update(users).set({ email }).where(eq(users.id, id)).run();
}

/** Overwrite a user's password hash (self-service change or reset-link redemption). */
export async function updateUserPassword(id: string, passwordHash: string): Promise<void> {
  getDb().update(users).set({ passwordHash }).where(eq(users.id, id)).run();
}

/**
 * A teacher's per-tool allow-list, or null when unrestricted (no list / empty).
 * Composed on top of instance availability in `availability.server`.
 */
export async function getUserToolAllowlist(userId: string): Promise<Set<string> | null> {
  const row = getDb().select().from(users).where(eq(users.id, userId)).get();
  if (!row?.allowedToolSlugs) return null;
  try {
    const parsed = JSON.parse(row.allowedToolSlugs) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? new Set(parsed) : null;
  } catch {
    return null;
  }
}

/** Set (or clear, with null/[]) a teacher's per-tool allow-list. */
export async function setUserToolAllowlist(userId: string, slugs: string[] | null): Promise<void> {
  const value = slugs && slugs.length > 0 ? JSON.stringify(slugs) : null;
  getDb().update(users).set({ allowedToolSlugs: value }).where(eq(users.id, userId)).run();
}

/**
 * Per-teacher country/sector assignment (Phase 8) — the read side of the P8
 * availability seam. It mirrors `getUserToolAllowlist`'s contract exactly
 * (returns a `Set<string>` or null; null/empty = unrestricted), but is stored as
 * a per-user `instance_settings` key rather than a `users` column: P8 forbids a
 * DB migration, and the `instance_settings` key/value table is the sanctioned
 * migration-free store. The matching setters + write UI are P9.
 */
async function getAssignedList(prefix: string, userId: string): Promise<Set<string> | null> {
  const row = getDb()
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, `${prefix}:${userId}`))
    .get();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.valueJson) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? new Set(parsed) : null;
  } catch {
    return null;
  }
}

export async function getUserAssignedCountries(userId: string): Promise<Set<string> | null> {
  return getAssignedList("assignedCountries", userId);
}

export async function getUserAssignedSectors(userId: string): Promise<Set<string> | null> {
  return getAssignedList("assignedSectors", userId);
}

/**
 * Per-teacher domain assignment (Phase 10.3) — a full P9-style axis, stored the
 * same migration-free way as country/sector. Flat slug set (not per-track); the
 * editor filters the track catalogue by it. null/empty = unrestricted.
 */
export async function getUserAssignedDomains(userId: string): Promise<Set<string> | null> {
  return getAssignedList("assignedDomains", userId);
}

/**
 * Set (or clear) a per-teacher country/sector assignment (Phase 9 write side) —
 * the setter half of `getAssignedList`. Writes the `${prefix}:${userId}`
 * instance_settings key with a JSON `string[]`; a null/empty list deletes the key
 * (unrestricted). No `users` column, no migration — mirrors the P8 read storage.
 */
async function setAssignedList(
  prefix: string,
  userId: string,
  ids: string[] | null,
): Promise<void> {
  const db = getDb();
  const key = `${prefix}:${userId}`;
  if (!ids || ids.length === 0) {
    db.delete(instanceSettings).where(eq(instanceSettings.key, key)).run();
    return;
  }
  const valueJson = JSON.stringify(ids);
  const existing = db.select().from(instanceSettings).where(eq(instanceSettings.key, key)).get();
  if (existing) {
    db.update(instanceSettings)
      .set({ valueJson, updatedAt: new Date() })
      .where(eq(instanceSettings.key, key))
      .run();
  } else {
    db.insert(instanceSettings).values({ key, valueJson, updatedAt: new Date() }).run();
  }
}

export async function setUserAssignedCountries(
  userId: string,
  ids: string[] | null,
): Promise<void> {
  return setAssignedList("assignedCountries", userId, ids);
}

export async function setUserAssignedSectors(userId: string, ids: string[] | null): Promise<void> {
  return setAssignedList("assignedSectors", userId, ids);
}

export async function setUserAssignedDomains(userId: string, ids: string[] | null): Promise<void> {
  return setAssignedList("assignedDomains", userId, ids);
}

/**
 * Per-teacher "custom access" activation flag (Phase 12). A pure gate: when off
 * (default) a teacher inherits the instance country/sector/domain sets; when on,
 * their own assignment (above) is authoritative and the instance is ignored.
 * Stored the same migration-free way as the assignments — a present
 * `contextCustomAccess:<userId>` key means activated. Deactivating only deletes
 * this key; the caller must NOT clear the assignments, so re-activating restores
 * exactly what the teacher had.
 */
export async function getUserContextCustomAccess(userId: string): Promise<boolean> {
  return (await getAssignedList("contextCustomAccess", userId)) !== null;
}

export async function setUserContextCustomAccess(userId: string, on: boolean): Promise<void> {
  return setAssignedList("contextCustomAccess", userId, on ? ["1"] : null);
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
 * user owns — feedback, usage counters, generations, context profiles, cohort
 * memberships + co-teach assignments, and their chat history + de-personalised
 * summaries (Phase 7) — then the user row, in a single transaction so a partial
 * failure leaves nothing orphaned. Scoped by `userId`/`id`, so another user's
 * rows are never touched.
 *
 * Cohorts the user *created* are deliberately KEPT: a cohort is shared teaching
 * config (its students' access), not personal data, so it survives as a
 * reassignable orphan an admin can re-home (see `setCohortOwner`). We only clear
 * the dangling reference to any of this user's now-deleted context profiles.
 */
export async function deleteUserCascade(id: string): Promise<void> {
  getDb().transaction((tx) => {
    tx.delete(feedback).where(eq(feedback.userId, id)).run();
    tx.delete(usage).where(eq(usage.userId, id)).run();
    tx.delete(generations).where(eq(generations.userId, id)).run();
    // Null any surviving cohort's reference to a profile we're about to delete,
    // so no orphaned cohort points at a vanished profile.
    const profileIds = tx
      .select({ id: contextProfiles.id })
      .from(contextProfiles)
      .where(eq(contextProfiles.userId, id))
      .all()
      .map((p) => p.id);
    if (profileIds.length > 0) {
      tx.update(cohorts)
        .set({ contextProfileId: null })
        .where(inArray(cohorts.contextProfileId, profileIds))
        .run();
    }
    tx.delete(contextProfiles).where(eq(contextProfiles.userId, id)).run();
    // Drop this user's co-teacher assignments (a colleague's cohort just loses a
    // co-manager); their own cohorts stay, orphaned for reassignment.
    tx.delete(cohortTeachers).where(eq(cohortTeachers.userId, id)).run();
    tx.delete(cohortMemberships).where(eq(cohortMemberships.userId, id)).run();
    // Chat history: drop the user's messages (via their sessions), the sessions,
    // and the derived summaries. The student's raw transcript leaves with them.
    const sessionIds = tx
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(eq(chatSessions.userId, id))
      .all()
      .map((s) => s.id);
    if (sessionIds.length > 0) {
      tx.delete(messages).where(inArray(messages.sessionId, sessionIds)).run();
    }
    tx.delete(chatSessions).where(eq(chatSessions.userId, id)).run();
    tx.delete(sessionSummaries).where(eq(sessionSummaries.userId, id)).run();
    tx.delete(users).where(eq(users.id, id)).run();
  });
}

export interface CreateInviteInput {
  role: Role;
  note?: string | null;
  expiresAt?: Date | null;
  /** Who issued the invite (teacher/admin). Null for legacy ops invites. */
  createdByUserId?: string | null;
  /** The cohort the redeemer joins. Null → a role-only teacher/admin invite. */
  cohortId?: string | null;
  /** Bind the invite to an intended student; redemption must match (see consumeInvite). */
  email?: string | null;
  /**
   * Per-teacher tool allow-list (Phase 4). Set on an admin-minted teacher invite;
   * copied onto the account at redeem. Null/empty = unrestricted.
   */
  allowedToolSlugs?: string[] | null;
}

export async function createInvite(input: CreateInviteInput): Promise<InviteRow> {
  const row: InviteRow = {
    token: randomBytes(32).toString("base64url"),
    role: input.role,
    note: input.note ?? null,
    expiresAt: input.expiresAt ?? null,
    usedByUserId: null,
    createdByUserId: input.createdByUserId ?? null,
    cohortId: input.cohortId ?? null,
    email: input.email ?? null,
    allowedToolSlugs:
      input.allowedToolSlugs && input.allowedToolSlugs.length > 0
        ? JSON.stringify(input.allowedToolSlugs)
        : null,
    createdAt: new Date(),
  };
  getDb().insert(invites).values(row).run();
  return row;
}

/**
 * Mint one single-use `student` token per recipient against a cohort — the batch
 * primitive behind the provisioning UI (a single invite is `recipients.length === 1`).
 * A recipient with an `email` is identity-bound; without, it's a link-only bearer
 * invite. Same cohort ⇒ same tools/config for every token minted here.
 */
export async function createInvitesForCohort(
  cohortId: string,
  createdByUserId: string,
  recipients: { email?: string | null }[],
  expiresAt: Date | null,
): Promise<InviteRow[]> {
  const rows: InviteRow[] = [];
  for (const recipient of recipients) {
    rows.push(
      await createInvite({
        role: "student",
        cohortId,
        createdByUserId,
        email: recipient.email?.trim() || null,
        expiresAt,
      }),
    );
  }
  return rows;
}

export async function getInvite(token: string): Promise<InviteRow | null> {
  return getDb().select().from(invites).where(eq(invites.token, token)).get() ?? null;
}

/**
 * Atomically claim an invite for `userId`. Single-use: the guarded UPDATE only
 * matches rows with `used_by_user_id IS NULL`, so a race admits exactly one
 * consumer. Returns null if the token is unknown, already used, or expired.
 *
 * Identity binding (Phase 6): when the invite carries an `email`, the redeemer's
 * `submittedEmail` must match it (case-insensitive) or the claim is rejected —
 * casual link-forwarding to the wrong person then fails.
 */
export async function consumeInvite(
  token: string,
  userId: string,
  submittedEmail?: string | null,
): Promise<InviteRow | null> {
  const db = getDb();
  const invite = db.select().from(invites).where(eq(invites.token, token)).get();
  if (!invite) return null;
  if (invite.usedByUserId) return null;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return null;
  if (
    invite.email &&
    invite.email.trim().toLowerCase() !== (submittedEmail ?? "").trim().toLowerCase()
  ) {
    return null;
  }

  const result = db
    .update(invites)
    .set({ usedByUserId: userId })
    .where(and(eq(invites.token, token), isNull(invites.usedByUserId)))
    .run();
  if (result.changes === 0) return null;
  return { ...invite, usedByUserId: userId };
}

export interface InviteWithContext {
  token: string;
  role: string;
  note: string | null;
  email: string | null;
  expiresAt: Date | null;
  usedByUserId: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  cohortId: string | null;
  cohortName: string | null;
  allowedToolSlugs: string | null;
  createdAt: Date;
}

/**
 * Every invite, newest first, joined with its issuer's name and (if any) the
 * cohort it provisions — the admin oversight list. Not user-scoped by design
 * (an admin sees every invite on the instance).
 */
export async function listInvitesWithContext(): Promise<InviteWithContext[]> {
  return getDb()
    .select({
      token: invites.token,
      role: invites.role,
      note: invites.note,
      email: invites.email,
      expiresAt: invites.expiresAt,
      usedByUserId: invites.usedByUserId,
      createdByUserId: invites.createdByUserId,
      createdByName: users.name,
      cohortId: invites.cohortId,
      cohortName: cohorts.name,
      allowedToolSlugs: invites.allowedToolSlugs,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .leftJoin(users, eq(invites.createdByUserId, users.id))
    .leftJoin(cohorts, eq(invites.cohortId, cohorts.id))
    .orderBy(desc(invites.createdAt))
    .all();
}

/**
 * Revoke an *open* invite by deleting it: an already-redeemed invite is left
 * intact (its account exists). Returns true when a row was removed. A revoked
 * token becomes unknown → the redeem page shows the friendly "invalid" error.
 */
export async function revokeInvite(token: string): Promise<boolean> {
  const result = getDb()
    .delete(invites)
    .where(and(eq(invites.token, token), isNull(invites.usedByUserId)))
    .run();
  return result.changes > 0;
}

/**
 * Bump a user's single-active-session counter (Phase 6 anti-sharing). Called on
 * every login/redeem; the new value is written into the fresh session cookie, so
 * an older cookie's stale `sessionVersion` no longer matches and is logged out.
 */
export async function bumpSessionVersion(userId: string): Promise<number> {
  const db = getDb();
  const current = db.select().from(users).where(eq(users.id, userId)).get();
  const next = (current?.sessionVersion ?? 0) + 1;
  db.update(users).set({ sessionVersion: next }).where(eq(users.id, userId)).run();
  return next;
}

/**
 * Mint a single-use password-reset token for `userId` (default 48h window). With
 * no email service, an admin shares the resulting link out-of-band; the user
 * opens it and sets their own new password. Mirrors the invite-link pattern.
 */
export async function createPasswordReset(
  userId: string,
  ttlHours = 48,
): Promise<PasswordResetRow> {
  const row: PasswordResetRow = {
    token: randomBytes(32).toString("base64url"),
    userId,
    expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    createdAt: new Date(),
  };
  getDb().insert(passwordResets).values(row).run();
  return row;
}

export async function getPasswordReset(token: string): Promise<PasswordResetRow | null> {
  return getDb().select().from(passwordResets).where(eq(passwordResets.token, token)).get() ?? null;
}

/**
 * Consume a reset token: returns its row and deletes it (single-use) when it
 * exists and hasn't expired; null otherwise. The guarded delete admits exactly
 * one consumer under a race, mirroring `revokeInvite`.
 */
export async function consumePasswordReset(token: string): Promise<PasswordResetRow | null> {
  const db = getDb();
  const row = db.select().from(passwordResets).where(eq(passwordResets.token, token)).get();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  const result = db.delete(passwordResets).where(eq(passwordResets.token, token)).run();
  if (result.changes === 0) return null;
  return row;
}
