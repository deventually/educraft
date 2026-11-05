/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 */
import { randomBytes, randomUUID } from "node:crypto";
import {
  type AnyColumn,
  type SQL,
  and,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "../db.server";
import {
  agentReviews,
  contextProfiles,
  courseLinks,
  courses,
  portfolioDossiers,
  reviewDecisions,
  rubricScores,
  rubrics,
  teamMembers,
  featureExceptions,
  feedback,
  generations,
  instanceSettings,
  invites,
  passwordResets,
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

/** Where a person stands on the admin list (P28.1). */
export type PersonStatus = "active" | "invited" | "disabled";

/**
 * One row of the admin user list (P28.1): an account, or an open invite (`id` is then
 * the invite token). `lastActiveDay` is the newest usage day, null when never used.
 */
export interface PersonRow {
  kind: "user" | "invite";
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: PersonStatus;
  lastActiveDay: string | null;
  createdAt: Date;
}

export interface PeopleFilter {
  /** Part of a name or e-mail address (an invite: its note), case-insensitive. */
  q?: string;
  role?: Role;
  status?: PersonStatus;
  /** Members of this team, and open invites for it (P28.2). */
  teamId?: string;
  limit?: number;
}

/** `haystack` contains `needle`, case-insensitively, with no LIKE wildcards. */
const contains = (haystack: SQL | AnyColumn, needle: string) =>
  sql`instr(lower(coalesce(${haystack}, '')), ${needle.toLowerCase()}) > 0`;

/**
 * The admin user list (P28.1): accounts and open invites (not used, not expired), filtered
 * on the server, open invites first, then newest first. Capped at `Math.min(limit ?? 50, 500)`.
 * Not user-scoped by design (an admin sees every account and invite).
 */
export async function listPeople(filter: PeopleFilter): Promise<PersonRow[]> {
  const cap = Math.min(filter.limit ?? 50, 500);
  const q = filter.q?.trim() ?? "";
  const db = getDb();
  const out: PersonRow[] = [];

  // An invite only ever makes a teacher (BESLUIT-2026-07-03-2).
  const wantInvites =
    (!filter.status || filter.status === "invited") && (!filter.role || filter.role === "teacher");
  if (wantInvites) {
    const open = and(
      isNull(invites.usedByUserId),
      or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
      q ? contains(invites.note, q) : undefined,
      filter.teamId ? eq(invites.teamId, filter.teamId) : undefined,
    );
    for (const i of db
      .select()
      .from(invites)
      .where(open)
      .orderBy(desc(invites.createdAt))
      .limit(cap)
      .all()) {
      out.push({
        kind: "invite",
        id: i.token,
        name: i.note,
        email: null,
        role: i.role,
        status: "invited",
        lastActiveDay: null,
        createdAt: i.createdAt,
      });
    }
  }

  if (filter.status !== "invited" && out.length < cap) {
    const where = and(
      filter.role ? eq(users.role, filter.role) : undefined,
      filter.status === "active" ? isNull(users.disabledAt) : undefined,
      filter.status === "disabled" ? isNotNull(users.disabledAt) : undefined,
      q ? or(contains(users.name, q), contains(users.email, q)) : undefined,
      filter.teamId
        ? inArray(
            users.id,
            db
              .select({ id: teamMembers.userId })
              .from(teamMembers)
              .where(eq(teamMembers.teamId, filter.teamId)),
          )
        : undefined,
    );
    const rows = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        disabledAt: users.disabledAt,
        createdAt: users.createdAt,
        // Fully qualified: inside a subquery drizzle would print bare column names.
        lastActiveDay: sql<
          string | null
        >`(select max(usage.day) from usage where usage.user_id = users.id)`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(cap - out.length)
      .all();
    for (const u of rows) {
      out.push({
        kind: "user",
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.disabledAt ? "disabled" : "active",
        lastActiveDay: u.lastActiveDay ?? null,
        createdAt: u.createdAt,
      });
    }
  }
  return out;
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
 * Together with `setUserDisabled` (deactivation) this is one of the THREE places
 * `sessionVersion` changes (the third is a real role change in `setUserRole`) — a plain login never does.
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
 * A teacher's own model set (`assignedModels:<userId>`, migration-free storage).
 * Since P18 it OVERRIDES the instance set (and may be wider); null/empty = no own
 * set, the teacher follows the instance.
 */
export async function getUserAssignedModels(userId: string): Promise<Set<string> | null> {
  return getAssignedList("assignedModels", userId);
}

/**
 * Set (or clear) a per-user list — the setter half of `getAssignedList`. Writes
 * the `${prefix}:${userId}` instance_settings key with a JSON `string[]`; a
 * null/empty list deletes the key. No `users` column, no migration.
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

/**
 * Which of these e-mail addresses are already spoken for (P28.5): `taken` has an account
 * (compared case-insensitively), `invited` has an open invite whose note ends in
 * `<email>` (the shape a pasted list writes). Not user-scoped by design: it serves the
 * admin's "Add", like `listPeople`. Input is capped at 500 addresses.
 */
export async function findClaimedEmails(
  emails: string[],
): Promise<{ taken: Set<string>; invited: Set<string> }> {
  const wanted = [...new Set(emails.map((e) => e.toLowerCase()))].slice(0, 500);
  const taken = new Set<string>();
  const invited = new Set<string>();
  if (wanted.length === 0) return { taken, invited };
  const db = getDb();
  for (const u of db
    .select({ email: users.email })
    .from(users)
    .where(inArray(sql`lower(${users.email})`, wanted))
    .all()) {
    if (u.email) taken.add(u.email.toLowerCase());
  }
  const open = db
    .select({ note: invites.note })
    .from(invites)
    .where(
      and(
        isNull(invites.usedByUserId),
        or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
        isNotNull(invites.note),
      ),
    )
    .all();
  const wantedSet = new Set(wanted);
  for (const { note } of open) {
    const m = note?.match(/<([^<>\s]+)>\s*$/);
    const email = m?.[1].toLowerCase();
    if (email && wantedSet.has(email)) invited.add(email);
  }
  return { taken, invited };
}

export async function deleteUser(id: string): Promise<void> {
  getDb().delete(users).where(eq(users.id, id)).run();
}

/**
 * Delete-my-data cascade (AVG / AI Act, audit finding). Removes everything the
 * user owns — feedback, usage counters, generations and context profiles,
 * then the user row, in a single transaction so a partial
 * failure leaves nothing orphaned. Scoped by `userId`/`id`, so another user's
 * rows are never touched.
 */
export async function deleteUserCascade(id: string): Promise<void> {
  getDb().transaction((tx) => {
    tx.delete(feedback).where(eq(feedback.userId, id)).run();
    tx.delete(usage).where(eq(usage.userId, id)).run();
    tx.delete(generations).where(eq(generations.userId, id)).run();
    tx.delete(contextProfiles).where(eq(contextProfiles.userId, id)).run();
    tx.delete(portfolioDossiers).where(eq(portfolioDossiers.userId, id)).run();
    tx.delete(rubricScores).where(eq(rubricScores.userId, id)).run();
    tx.delete(rubrics).where(eq(rubrics.userId, id)).run();
    tx.delete(reviewDecisions).where(eq(reviewDecisions.userId, id)).run();
    tx.delete(agentReviews).where(eq(agentReviews.userId, id)).run();
    tx.delete(courseLinks).where(eq(courseLinks.userId, id)).run();
    tx.delete(courses).where(eq(courses.userId, id)).run();
    tx.delete(teamMembers).where(eq(teamMembers.userId, id)).run();
    tx.delete(featureExceptions).where(eq(featureExceptions.userId, id)).run();
    // The teacher's own model set lives in instance_settings.
    tx.delete(instanceSettings)
      .where(eq(instanceSettings.key, `assignedModels:${id}`))
      .run();
    tx.delete(users).where(eq(users.id, id)).run();
  });
}

export interface CreateInviteInput {
  role: Role;
  note?: string | null;
  expiresAt?: Date | null;
  /** Who issued the invite (teacher/admin). Null for legacy ops invites. */
  createdByUserId?: string | null;
  /** The team the new account joins (P28.2); null = none. */
  teamId?: string | null;
}

export async function createInvite(input: CreateInviteInput): Promise<InviteRow> {
  const row: InviteRow = {
    token: randomBytes(32).toString("base64url"),
    role: input.role,
    note: input.note ?? null,
    expiresAt: input.expiresAt ?? null,
    usedByUserId: null,
    createdByUserId: input.createdByUserId ?? null,
    teamId: input.teamId ?? null,
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
        // Invites make teachers only (P18.6); an admin or retired-role invite never redeems.
        eq(invites.role, "teacher"),
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
