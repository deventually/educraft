/**
 * The admin actions the audit log records (client-safe: the log page labels each one).
 * Stable slugs, never shown; the label is `t.auditLog.actions[action]`.
 */
export const AUDIT_ACTIONS = [
  "accountCreated",
  "accountDeleted",
  "deactivated",
  "instanceModelsChanged",
  "inviteCreated",
  "inviteRevoked",
  "passwordSet",
  "reactivated",
  "resetLinkCreated",
  "roleChanged",
  "teacherModelsChanged",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}

/**
 * Facts about one action: a role change (`from`, `to`), a bulk change (`bulk`), how many
 * invites (`count`), a new account's `role`, or the chosen `models` (`null` = follows the
 * instance). Never a password, link, token or note.
 */
export interface AuditDetail {
  bulk?: boolean;
  count?: number;
  from?: string;
  models?: string[] | null;
  role?: string;
  to?: string;
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
