/**
 * Mentor insight repository (Phase 7) — the ONLY mentor-facing view of student
 * tutoring. It exposes derived, cohort-scoped signal (de-personalised summaries
 * + engagement counts) and, by construction, has NO query that returns message
 * content: engagement counts turns/last-active straight off the `messages` table
 * without ever reading the `content` column. Every read is guarded by cohort
 * ownership — a teacher sees only cohorts they created.
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
  cohorts,
  messages,
  sessionSummaries,
  type SessionSummaryRow,
} from "../schema.server";
import type { SessionSummary } from "~/lib/insight/summary";

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
 * The cohort's de-personalised summaries — but only if the requester owns the
 * cohort. A non-owner (or unknown cohort) gets an empty list, never content.
 */
export async function listSummariesForCohort(
  ownerId: string,
  cohortId: string,
): Promise<SessionSummaryRow[]> {
  if (!(await ownsCohort(ownerId, cohortId))) return [];
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

/** Engagement for a whole cohort (owner-checked). Null if not the owner. */
export async function cohortEngagement(
  ownerId: string,
  cohortId: string,
): Promise<CohortEngagement | null> {
  if (!(await ownsCohort(ownerId, cohortId))) return null;
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
 * Engagement for a single student — only if the requester owns a cohort the
 * student belongs to. Scoped to that student's sessions in the owner's cohorts.
 */
export async function studentEngagement(
  ownerId: string,
  userId: string,
): Promise<StudentEngagement | null> {
  const ownedCohortIds = (
    await getDb()
      .select({ id: cohorts.id })
      .from(cohorts)
      .where(eq(cohorts.createdByUserId, ownerId))
      .all()
  ).map((c) => c.id);
  if (ownedCohortIds.length === 0) return null;

  const membered = getDb()
    .select({ cohortId: cohortMemberships.cohortId })
    .from(cohortMemberships)
    .where(eq(cohortMemberships.userId, userId))
    .all()
    .some((m) => ownedCohortIds.includes(m.cohortId));
  if (!membered) return null;

  // Scope to the student's sessions within the owner's cohorts only (defensive:
  // a student could belong to another teacher's cohort too).
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
    .filter((s) => s.cohortId != null && ownedCohortIds.includes(s.cohortId));

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
// Ownership guard
// ---------------------------------------------------------------------------

async function ownsCohort(ownerId: string, cohortId: string): Promise<boolean> {
  const cohort = getDb().select().from(cohorts).where(eq(cohorts.id, cohortId)).get();
  return !!cohort && cohort.createdByUserId === ownerId;
}
