/**
 * Mentor insight repository (Phase 7) — the ONLY mentor-facing view of student
 * tutoring. It exposes derived, cohort-scoped signal (de-personalised summaries
 * + engagement counts) and, by construction, has NO query that returns message
 * content: engagement counts turns/last-active straight off the `messages` table
 * without ever reading the `content` column. Every read is guarded by cohort
 * management rights: the creator, an assigned co-teacher, or an admin — the same
 * rule as `canManageCohort` (Phase 4). A non-manager sees nothing.
 *
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported function is async; no better-sqlite3 API outside `db.server.ts`.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db.server";
import {
  chatSessions,
  cohortMemberships,
  cohortTeachers,
  cohorts,
  messages,
  sessionSummaries,
  type SessionSummaryRow,
} from "../schema.server";
import { canManageCohort, getCohortTeacherIds } from "./cohorts.server";
import type { SessionSummary } from "~/lib/insight/summary";
import type { Role } from "~/lib/registry/access";

/**
 * Who is asking for insight — their id and role. Authorization mirrors cohort
 * management: an admin always, the creator, or an assigned co-teacher.
 */
export interface InsightRequester {
  id: string;
  role: Role;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export interface SaveSummaryInput {
  sessionId: string;
  userId: string;
  cohortId?: string | null;
  toolSlug: string;
  summary: SessionSummary;
  helpfulness?: number | null;
}

/** Upsert one summary per session (a re-close overwrites in place). */
export async function saveSummary(input: SaveSummaryInput): Promise<SessionSummaryRow> {
  const db = getDb();
  const existing = db
    .select()
    .from(sessionSummaries)
    .where(eq(sessionSummaries.sessionId, input.sessionId))
    .get();
  const summaryJson = JSON.stringify(input.summary);
  const helpfulness = input.helpfulness ?? null;

  if (existing) {
    db.update(sessionSummaries)
      .set({
        userId: input.userId,
        cohortId: input.cohortId ?? null,
        toolSlug: input.toolSlug,
        summaryJson,
        helpfulness,
      })
      .where(eq(sessionSummaries.id, existing.id))
      .run();
    return {
      ...existing,
      userId: input.userId,
      cohortId: input.cohortId ?? null,
      toolSlug: input.toolSlug,
      summaryJson,
      helpfulness,
    };
  }

  const row: SessionSummaryRow = {
    id: randomUUID(),
    sessionId: input.sessionId,
    userId: input.userId,
    cohortId: input.cohortId ?? null,
    toolSlug: input.toolSlug,
    summaryJson,
    helpfulness,
    createdAt: new Date(),
  };
  db.insert(sessionSummaries).values(row).run();
  return row;
}

export async function getSummary(sessionId: string): Promise<SessionSummaryRow | null> {
  return (
    getDb()
      .select()
      .from(sessionSummaries)
      .where(eq(sessionSummaries.sessionId, sessionId))
      .get() ?? null
  );
}

/**
 * The cohort's de-personalised summaries — but only if the requester may manage
 * the cohort. A non-manager (or unknown cohort) gets an empty list, never content.
 */
export async function listSummariesForCohort(
  requester: InsightRequester,
  cohortId: string,
): Promise<SessionSummaryRow[]> {
  if (!(await canReadInsight(requester, cohortId))) return [];
  return getDb()
    .select()
    .from(sessionSummaries)
    .where(eq(sessionSummaries.cohortId, cohortId))
    .all();
}

// ---------------------------------------------------------------------------
// Engagement (derived — never returns message content)
// ---------------------------------------------------------------------------

export interface EngagementTotals {
  sessions: number;
  turns: number;
  lastActiveAt: Date | null;
}
export interface TutorEngagement extends EngagementTotals {
  toolSlug: string;
}
export interface StudentEngagementRow extends EngagementTotals {
  userId: string;
}
export interface CohortEngagement {
  totals: EngagementTotals;
  perTutor: TutorEngagement[];
  perStudent: StudentEngagementRow[];
}
export interface StudentEngagement {
  userId: string;
  totals: EngagementTotals;
  perTutor: TutorEngagement[];
}

/** Minimal session projection — id, who, which tutor, when. No content. */
interface SessionMeta {
  id: string;
  userId: string | null;
  toolSlug: string;
  createdAt: Date;
}

/** Per-session turn count + last message time. Reads NO message content. */
function messageStats(sessionIds: string[]): Map<string, { turns: number; lastAt: Date }> {
  const stats = new Map<string, { turns: number; lastAt: Date }>();
  if (sessionIds.length === 0) return stats;
  const rows = getDb()
    .select({ sessionId: messages.sessionId, createdAt: messages.createdAt })
    .from(messages)
    .where(inArray(messages.sessionId, sessionIds))
    .all();
  for (const r of rows) {
    const cur = stats.get(r.sessionId);
    if (!cur) stats.set(r.sessionId, { turns: 1, lastAt: r.createdAt });
    else {
      cur.turns += 1;
      if (r.createdAt > cur.lastAt) cur.lastAt = r.createdAt;
    }
  }
  return stats;
}

function totalsFrom(
  sessions: SessionMeta[],
  stats: Map<string, { turns: number; lastAt: Date }>,
): EngagementTotals {
  let turns = 0;
  let lastActiveAt: Date | null = null;
  for (const s of sessions) {
    const st = stats.get(s.id);
    turns += st?.turns ?? 0;
    const at = st?.lastAt ?? s.createdAt;
    if (!lastActiveAt || at > lastActiveAt) lastActiveAt = at;
  }
  return { sessions: sessions.length, turns, lastActiveAt };
}

function perTutorFrom(
  sessions: SessionMeta[],
  stats: Map<string, { turns: number; lastAt: Date }>,
): TutorEngagement[] {
  const bySlug = new Map<string, SessionMeta[]>();
  for (const s of sessions) {
    const list = bySlug.get(s.toolSlug) ?? [];
    list.push(s);
    bySlug.set(s.toolSlug, list);
  }
  return [...bySlug.entries()]
    .map(([toolSlug, list]) => ({ toolSlug, ...totalsFrom(list, stats) }))
    .sort((a, b) => b.sessions - a.sessions || a.toolSlug.localeCompare(b.toolSlug));
}

function cohortSessions(cohortId: string): SessionMeta[] {
  return getDb()
    .select({
      id: chatSessions.id,
      userId: chatSessions.userId,
      toolSlug: chatSessions.toolSlug,
      createdAt: chatSessions.createdAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.cohortId, cohortId))
    .all();
}

/** Engagement for a whole cohort (manager-checked). Null if not a manager. */
export async function cohortEngagement(
  requester: InsightRequester,
  cohortId: string,
): Promise<CohortEngagement | null> {
  if (!(await canReadInsight(requester, cohortId))) return null;
  const sessions = cohortSessions(cohortId);
  const stats = messageStats(sessions.map((s) => s.id));

  const byStudent = new Map<string, SessionMeta[]>();
  for (const s of sessions) {
    const key = s.userId ?? "";
    const list = byStudent.get(key) ?? [];
    list.push(s);
    byStudent.set(key, list);
  }
  const perStudent: StudentEngagementRow[] = [...byStudent.entries()]
    .filter(([userId]) => userId !== "")
    .map(([userId, list]) => ({ userId, ...totalsFrom(list, stats) }));

  return {
    totals: totalsFrom(sessions, stats),
    perTutor: perTutorFrom(sessions, stats),
    perStudent,
  };
}

/**
 * Engagement for a single student — only if the requester manages a cohort the
 * student belongs to. Scoped to that student's sessions in the managed cohorts.
 */
export async function studentEngagement(
  requester: InsightRequester,
  userId: string,
): Promise<StudentEngagement | null> {
  const managedCohortIds = await managedCohortIdSet(requester);
  if (managedCohortIds.size === 0) return null;

  const membered = getDb()
    .select({ cohortId: cohortMemberships.cohortId })
    .from(cohortMemberships)
    .where(eq(cohortMemberships.userId, userId))
    .all()
    .some((m) => managedCohortIds.has(m.cohortId));
  if (!membered) return null;

  // Scope to the student's sessions within the requester's managed cohorts only
  // (defensive: a student could belong to another teacher's cohort too).
  const scoped = getDb()
    .select({
      id: chatSessions.id,
      userId: chatSessions.userId,
      toolSlug: chatSessions.toolSlug,
      createdAt: chatSessions.createdAt,
      cohortId: chatSessions.cohortId,
    })
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .all()
    .filter((s) => s.cohortId != null && managedCohortIds.has(s.cohortId));

  const stats = messageStats(scoped.map((s) => s.id));
  return {
    userId,
    totals: totalsFrom(scoped, stats),
    perTutor: perTutorFrom(scoped, stats),
  };
}

// ---------------------------------------------------------------------------
// Abandoned-session sweep (candidate selection — metadata only, no content)
// ---------------------------------------------------------------------------

export interface AbandonedSession {
  sessionId: string;
  userId: string;
  cohortId: string;
  toolSlug: string;
}

/**
 * Cohort-linked sessions a student left without explicitly closing: idle since
 * before `before`, at least `minMessages` long, and not yet summarised. Returns
 * metadata only (no message content) — the sweep service then reads the
 * transcript through the student/summariser path to produce the summary.
 */
export async function listAbandonedSessions(opts: {
  before: Date;
  minMessages: number;
  limit?: number;
}): Promise<AbandonedSession[]> {
  const db = getDb();
  const summarised = new Set(
    db
      .select({ sessionId: sessionSummaries.sessionId })
      .from(sessionSummaries)
      .all()
      .map((r) => r.sessionId),
  );
  const candidates = db
    .select({
      id: chatSessions.id,
      userId: chatSessions.userId,
      cohortId: chatSessions.cohortId,
      toolSlug: chatSessions.toolSlug,
    })
    .from(chatSessions)
    .all()
    .filter((s) => s.cohortId != null && s.userId != null && !summarised.has(s.id));

  const stats = messageStats(candidates.map((s) => s.id));
  const out: AbandonedSession[] = [];
  for (const s of candidates) {
    if (s.cohortId == null || s.userId == null) continue; // narrows the nullable columns
    const st = stats.get(s.id);
    if (!st || st.turns < opts.minMessages || st.lastAt >= opts.before) continue;
    out.push({ sessionId: s.id, userId: s.userId, cohortId: s.cohortId, toolSlug: s.toolSlug });
  }
  return typeof opts.limit === "number" ? out.slice(0, opts.limit) : out;
}

// ---------------------------------------------------------------------------
// Management guard — insight is visible to whoever may manage the cohort
// (creator, assigned co-teacher, or admin), mirroring `canManageCohort`.
// ---------------------------------------------------------------------------

/** Whether `requester` may read a single cohort's insight. */
async function canReadInsight(requester: InsightRequester, cohortId: string): Promise<boolean> {
  const cohort = getDb().select().from(cohorts).where(eq(cohorts.id, cohortId)).get();
  if (!cohort) return false;
  return canManageCohort(requester, cohort, await getCohortTeacherIds(cohortId));
}

/**
 * The set of cohort ids `requester` may see insight for: every cohort for an
 * admin, otherwise the ones they created plus the ones they're assigned to.
 */
async function managedCohortIdSet(requester: InsightRequester): Promise<Set<string>> {
  const db = getDb();
  if (requester.role === "admin") {
    return new Set(
      db
        .select({ id: cohorts.id })
        .from(cohorts)
        .all()
        .map((c) => c.id),
    );
  }
  const created = db
    .select({ id: cohorts.id })
    .from(cohorts)
    .where(eq(cohorts.createdByUserId, requester.id))
    .all()
    .map((c) => c.id);
  const assigned = db
    .select({ cohortId: cohortTeachers.cohortId })
    .from(cohortTeachers)
    .where(eq(cohortTeachers.userId, requester.id))
    .all()
    .map((r) => r.cohortId);
  return new Set([...created, ...assigned]);
}
