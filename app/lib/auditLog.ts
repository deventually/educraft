/**
 * The admin actions the audit log records (client-safe: the log page labels each one).
 * Stable slugs, never shown; the label is `t.auditLog.actions[action]`.
 */
export const AUDIT_ACTIONS = [
  "accountCreated",
  "accountDeleted",
  "aiLimitChanged",
  "courseMemberChanged",
  "coursesTransferred",
  "deactivated",
  "instanceModelsChanged",
  "inviteCreated",
  "inviteRevoked",
  "logCleaned",
  "modelPriceChanged",
  "passwordSet",
  "reactivated",
  "resetLinkCreated",
  "roleChanged",
  "teacherModelsChanged",
  "twoFactorDisabled",
  "twoFactorEnabled",
  "twoFactorRecoveryUsed",
  "twoFactorReset",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}

/**
 * Facts about one action: a role change (`from`, `to`), a bulk change (`bulk`), how many
 * invites or removed entries (`count`), a cleanup's `olderThanDays`, a new account's `role`, or the chosen `models` (`null` = follows the
 * instance), or `via: "server"` for a server command. Never a password, link, token or note.
 */
export interface AuditDetail {
  bulk?: boolean;
  count?: number;
  /** A monthly AI limit in euros: the budget, a team's (with its name) or a teacher's. */
  limit?: { kind: "budget" | "team" | "user"; name?: string; euros: number | null };
  from?: string;
  /** A cleanup: entries older than this many days went; `null` = everything. */
  olderThanDays?: number | null;
  models?: string[] | null;
  /** A model's new price (euro per million tokens); `null` = removed. */
  price?: { input: number; output: number; cacheRead?: number; cacheWrite?: number } | null;
  role?: string;
  to?: string;
  /** Done on the server itself (`reset-2fa`), not in the app. */
  via?: "server";
}

/** One line of the log, as the page shows it. */
export interface AuditEntry {
  id: string;
  at: Date;
  action: AuditAction;
  actorUserId: string;
  actorName: string | null;
  targetUserId: string | null;
  targetName: string | null;
  detail: AuditDetail | null;
}

/** Days the log keeps an entry; older ones are removed automatically. */
export const AUDIT_RETENTION_DAYS = 365;

/** What the owner may clean up by hand: entries older than N days, or everything. */
export const CLEANUP_CHOICES = ["30", "90", "180", "all"] as const;
export type CleanupChoice = (typeof CLEANUP_CHOICES)[number];

export function isCleanupChoice(value: unknown): value is CleanupChoice {
  return (CLEANUP_CHOICES as readonly unknown[]).includes(value);
}
