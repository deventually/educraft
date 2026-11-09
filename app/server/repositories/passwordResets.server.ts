/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { passwordResets, type PasswordResetRow } from "../schema.server";

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
