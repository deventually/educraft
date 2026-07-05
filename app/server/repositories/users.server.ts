/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db.server";
import {
  cohortMemberships,
  contextProfiles,
  feedback,
  generations,
  invites,
  usage,
  users,
  type InviteRow,
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
    createdAt: new Date(),
  };
  getDb().insert(users).values(row).run();
  return row;
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
 * user owns — feedback, usage counters, generations, context profiles — then the
 * user row, in a single transaction so a partial failure leaves nothing orphaned.
 * Scoped by `userId`/`id`, so another user's rows are never touched.
 */
export async function deleteUserCascade(id: string): Promise<void> {
  getDb().transaction((tx) => {
    tx.delete(feedback).where(eq(feedback.userId, id)).run();
    tx.delete(usage).where(eq(usage.userId, id)).run();
    tx.delete(generations).where(eq(generations.userId, id)).run();
    tx.delete(contextProfiles).where(eq(contextProfiles.userId, id)).run();
    tx.delete(cohortMemberships).where(eq(cohortMemberships.userId, id)).run();
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
