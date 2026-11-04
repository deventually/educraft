/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../db.server";
import {
  chatSessions,
  contextProfiles,
  feedback,
  generations,
  instanceSettings,
  invites,
  messages,
  passwordResets,
  usage,
  users,
  type InviteRow,
  type PasswordResetRow,
  type UserRow,
} from "../schema.server";
import { ROLES, type Role } from "~/lib/registry/access";

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
    allowedToolSlugs: null, // retired per-teacher gate (P18); the column goes in 18.8
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

/**
 * Overwrite a user's password hash (self-service change or reset-link redemption)
 * and bump `sessionVersion` in the same statement, so every session minted before
 * the change is logged out. Callers re-issue the acting device's cookie afterwards.
 * This is the ONLY place `sessionVersion` changes — a plain login never does.
 */
export async function updateUserPassword(id: string, passwordHash: string): Promise<void> {
  getDb()
    .update(users)
    .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, id))
    .run();
}

/**
 * A per-user list stored as an `instance_settings` key `${prefix}:${userId}`
 * (returns a `Set<string>` or null; null/empty = unset). Migration-free store;
 * today only the per-teacher model set (`assignedModels`) uses it.
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

/**
 * Per-teacher model assignment (Phase 13) — the admin→teacher gate. Same
 * migration-free storage as the context axes (`assignedModels:<userId>`), but
 * composed by INTERSECT, not override: a teacher's effective models are the
 * instance base ∩ this set. null/empty = unrestricted (inherit the instance).
 */
export async function getUserAssignedModels(userId: string): Promise<Set<string> | null> {
  return getAssignedList("assignedModels", userId);
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

/** Set (or clear, with null/[]) a per-teacher model assignment (Phase 13). */
export async function setUserAssignedModels(userId: string, ids: string[] | null): Promise<void> {
  return setAssignedList("assignedModels", userId, ids);
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
 * user owns — feedback, usage counters, generations, context profiles, and
 * their chat history — then the user row, in a single transaction so a partial
 * failure leaves nothing orphaned. Scoped by `userId`/`id`, so another user's
 * rows are never touched.
 */
export async function deleteUserCascade(id: string): Promise<void> {
  getDb().transaction((tx) => {
    tx.delete(feedback).where(eq(feedback.userId, id)).run();
    tx.delete(usage).where(eq(usage.userId, id)).run();
    tx.delete(generations).where(eq(generations.userId, id)).run();
    tx.delete(contextProfiles).where(eq(contextProfiles.userId, id)).run();
    // Chat history: drop the user's messages (via their sessions) and the sessions.
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
    tx.delete(users).where(eq(users.id, id)).run();
  });
}

export interface CreateInviteInput {
  role: Role;
  note?: string | null;
  expiresAt?: Date | null;
  /** Who issued the invite (teacher/admin). Null for legacy ops invites. */
  createdByUserId?: string | null;
}

export async function createInvite(input: CreateInviteInput): Promise<InviteRow> {
  const row: InviteRow = {
    token: randomBytes(32).toString("base64url"),
    role: input.role,
    note: input.note ?? null,
    expiresAt: input.expiresAt ?? null,
    usedByUserId: null,
    createdByUserId: input.createdByUserId ?? null,
    allowedToolSlugs: null, // retired per-teacher gate (P18); the column goes in 18.8
    createdAt: new Date(),
  };
  getDb().insert(invites).values(row).run();
  return row;
}

export async function getInvite(token: string): Promise<InviteRow | null> {
  return getDb().select().from(invites).where(eq(invites.token, token)).get() ?? null;
}

/**
 * Atomically claim an invite for `userId`. Single-use: the guarded UPDATE only
 * matches rows with `used_by_user_id IS NULL`, so a race admits exactly one
 * consumer. Returns null if the token is unknown, already used, or expired.
 */
export async function consumeInvite(token: string, userId: string): Promise<InviteRow | null> {
  const db = getDb();
  const invite = db.select().from(invites).where(eq(invites.token, token)).get();
  if (!invite) return null;
  if (invite.usedByUserId) return null;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return null;

  const result = db
    .update(invites)
    .set({ usedByUserId: userId })
    .where(
      and(
        eq(invites.token, token),
        isNull(invites.usedByUserId),
        inArray(invites.role, [...ROLES]),
      ),
    )
    .run();
  if (result.changes === 0) return null;
  return { ...invite, usedByUserId: userId };
}

export interface InviteWithContext {
  token: string;
  role: string;
  note: string | null;
  expiresAt: Date | null;
  usedByUserId: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: Date;
}

/**
 * Every invite, newest first, joined with its issuer's name — the admin oversight
 * list. Not user-scoped by design (an admin sees every invite on the instance).
 */
export async function listInvitesWithContext(): Promise<InviteWithContext[]> {
  return getDb()
    .select({
      token: invites.token,
      role: invites.role,
      note: invites.note,
      expiresAt: invites.expiresAt,
      usedByUserId: invites.usedByUserId,
      createdByUserId: invites.createdByUserId,
      createdByName: users.name,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .leftJoin(users, eq(invites.createdByUserId, users.id))
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
