/**
 * Two-step verification storage (P2-12): the authenticator secret and the recovery codes of
 * one account. Every function is scoped to its `userId`. The checks themselves are in
 * `totp.server.ts`; nothing here returns a secret except a pending setup to its own owner.
 */
import { randomUUID } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "../db.server";
import { recoveryCodes, twoFactor } from "../schema.server";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotp,
} from "../totp.server";

export interface TwoFactorStatus {
  enabled: boolean;
  /** The secret of a setup that waits for its first code; `null` otherwise. */
  pendingSecret: string | null;
  /** Unused recovery codes. */
  recoveryLeft: number;
}

function row(userId: string) {
  return getDb().select().from(twoFactor).where(eq(twoFactor.userId, userId)).get();
}

export async function getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const r = row(userId);
  const left = getDb()
    .select({ n: count() })
    .from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)))
    .get();
  return {
    enabled: Boolean(r?.enabledAt),
    pendingSecret: r && !r.enabledAt ? r.secret : null,
    recoveryLeft: left?.n ?? 0,
  };
}

export async function isTwoFactorEnabled(userId: string): Promise<boolean> {
  return Boolean(row(userId)?.enabledAt);
}

/** Start (or restart) a setup with a fresh secret. `null` when it is already on. */
export async function startTwoFactorSetup(userId: string): Promise<string | null> {
  if (row(userId)?.enabledAt) return null;
  const secret = generateTotpSecret();
  getDb()
    .insert(twoFactor)
    .values({ userId, secret, enabledAt: null, lastStep: -1, createdAt: new Date() })
    .onConflictDoUpdate({ target: twoFactor.userId, set: { secret, lastStep: -1 } })
    .run();
  return secret;
}

/** Store fresh recovery codes, replacing every earlier one; returns them in plain text once. */
function replaceCodes(userId: string): string[] {
  const codes = generateRecoveryCodes();
  getDb().transaction((tx) => {
    tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId)).run();
    tx.insert(recoveryCodes)
      .values(codes.map((c) => ({ id: randomUUID(), userId, codeHash: hashRecoveryCode(c) })))
      .run();
  });
  return codes;
}

/**
 * Finish a pending setup with the first code from the app. Returns the 10 recovery codes
 * (shown once), or `null` for a wrong code or no pending setup.
 */
export async function confirmTwoFactorSetup(
  userId: string,
  code: string,
): Promise<string[] | null> {
  const r = row(userId);
  if (!r || r.enabledAt) return null;
  const step = verifyTotp(r.secret, code, { lastStep: r.lastStep });
  if (step === null) return null;
  getDb()
    .update(twoFactor)
    .set({ enabledAt: new Date(), lastStep: step })
    .where(eq(twoFactor.userId, userId))
    .run();
  return replaceCodes(userId);
}

/**
 * The second step of a login, or of a change that asks for it: an app code (`"app"`) or an
 * unused recovery code (`"recovery"`, then spent). `null` when neither fits or it is off.
 */
export async function verifySecondFactor(
  userId: string,
  typed: string,
): Promise<"app" | "recovery" | null> {
  const r = row(userId);
  if (!r?.enabledAt) return null;
  const step = verifyTotp(r.secret, typed, { lastStep: r.lastStep });
  if (step !== null) {
    getDb().update(twoFactor).set({ lastStep: step }).where(eq(twoFactor.userId, userId)).run();
    return "app";
  }
  const spent = getDb()
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(recoveryCodes.userId, userId),
        eq(recoveryCodes.codeHash, hashRecoveryCode(typed)),
        isNull(recoveryCodes.usedAt),
      ),
    )
    .run();
  return spent.changes > 0 ? "recovery" : null;
}

/** New recovery codes for an account that has it on; the old ones stop working. */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  if (!row(userId)?.enabledAt) return [];
  return replaceCodes(userId);
}

/** Switch it off: secret and codes go. Returns whether there was anything to remove. */
export async function removeTwoFactor(userId: string): Promise<boolean> {
  return getDb().transaction((tx) => {
    tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId)).run();
    return tx.delete(twoFactor).where(eq(twoFactor.userId, userId)).run().changes > 0;
  });
}
