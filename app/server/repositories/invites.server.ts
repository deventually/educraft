/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db.server";
import { invites, users, type InviteRow } from "../schema.server";
import type { Role } from "~/lib/registry/access";

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
