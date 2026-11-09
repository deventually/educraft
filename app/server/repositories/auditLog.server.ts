/**
 * The admin audit log: who changed whose access, when (P1). An instance-wide record, written by
 * the admin actions and read by admins only (the route checks the role). Nothing edits a row;
 * rows only go by age: automatically after `AUDIT_RETENTION_DAYS`, or by hand by the owner
 * (`pruneAdminActions`). Repository rule: every exported function is `async`.
 */
import { randomUUID } from "node:crypto";
import { desc, eq, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "../db.server";
import { adminAudit, users } from "../schema.server";
import {
  AUDIT_RETENTION_DAYS,
  type AuditAction,
  type AuditDetail,
  type AuditEntry,
  isAuditAction,
} from "~/lib/auditLog";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Remove the entries recorded before `before` (`null` = every entry). Returns how many went.
 * Without an argument it applies the retention period: everything older than a year.
 */
export async function pruneAdminActions(
  before: Date | null = new Date(Date.now() - AUDIT_RETENTION_DAYS * DAY_MS),
): Promise<number> {
  const query = getDb().delete(adminAudit);
  return (before ? query.where(lt(adminAudit.at, before)) : query).run().changes;
}

export interface AuditInput {
  actorUserId: string;
  action: AuditAction;
  targetUserId?: string | null;
  detail?: AuditDetail;
}

/** Record one admin action. Call it after the change succeeded, never for a refusal. */
export async function recordAdminAction(input: AuditInput): Promise<void> {
  await pruneAdminActions();
  getDb()
    .insert(adminAudit)
    .values({
      id: randomUUID(),
      at: new Date(),
      actorUserId: input.actorUserId,
      action: input.action,
      targetUserId: input.targetUserId ?? null,
      detail: input.detail ? JSON.stringify(input.detail) : null,
    })
    .run();
}

function parseDetail(raw: string | null): AuditDetail | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as AuditDetail) : null;
  } catch {
    return null;
  }
}

/**
 * The newest entries first (capped), with the current names of actor and target. A deleted
 * account has no name any more: the log keeps the fact, not the person.
 */
export async function listAdminActions(limit?: number): Promise<AuditEntry[]> {
  const cap = Math.min(limit ?? 200, 500);
  const actor = alias(users, "actor");
  const target = alias(users, "target");
  const rows = getDb()
    .select({
      id: adminAudit.id,
      at: adminAudit.at,
      action: adminAudit.action,
      actorUserId: adminAudit.actorUserId,
      actorName: actor.name,
      targetUserId: adminAudit.targetUserId,
      targetName: target.name,
      detail: adminAudit.detail,
    })
    .from(adminAudit)
    .leftJoin(actor, eq(actor.id, adminAudit.actorUserId))
    .leftJoin(target, eq(target.id, adminAudit.targetUserId))
    // rowid breaks ties within one millisecond (a bulk change writes several rows at once).
    .orderBy(desc(adminAudit.at), desc(sql`${adminAudit}.rowid`))
    .limit(cap)
    .all();
  return rows.flatMap((r) =>
    isAuditAction(r.action)
      ? [
          {
            ...r,
            action: r.action,
            actorName: r.actorName ?? null,
            targetName: r.targetName ?? null,
            detail: parseDetail(r.detail),
          },
        ]
      : [],
  );
}
