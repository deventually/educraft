/**
 * Chat-session persistence (Phase 7). A multi-turn tutoring conversation is
 * recorded into the normalised `chat_sessions` + `messages` tables so the
 * cohort-scoped engagement rollups (see `insight.server`) can count sessions,
 * turns and last-active WITHOUT the transcript being duplicated into every
 * generation. This is the student's own raw history — reachable by the student
 * (continuity) and by the post-session summariser, but NEVER by a mentor: the
 * mentor insight layer has no query here that returns message content.
 *
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported function is async; no better-sqlite3 API outside `db.server.ts`.
 */
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { chatSessions, messages, type ChatSessionRow, type MessageRow } from "../schema.server";

export interface RecordChatTurnInput {
  /** Stable client session id — also the `chat_sessions` primary key. */
  sessionId: string;
  userId: string;
  cohortId?: string | null;
  toolSlug: string;
  model: string;
  systemPrompt: string;
  contextProfileId?: string | null;
  /** The full conversation so far (history + the just-completed turn). */
  messages: { role: "user" | "assistant"; content: string }[];
  /** Base timestamp for the rewritten messages (defaults to now; injectable for tests/backfill). */
  at?: Date;
}

/**
 * Persist a completed chat turn. Upserts the session row (created once, its
 * `createdAt` preserved) and rewrites the session's messages from the supplied
 * full history — idempotent, so a re-sent/regenerated turn corrects the record
 * rather than duplicating it. Messages carry strictly increasing timestamps so
 * ordering and last-active survive the rewrite.
 */
export async function recordChatTurn(input: RecordChatTurnInput): Promise<void> {
  const db = getDb();
  const existing = db.select().from(chatSessions).where(eq(chatSessions.id, input.sessionId)).get();

  if (existing) {
    db.update(chatSessions)
      .set({
        userId: input.userId,
        cohortId: input.cohortId ?? null,
        toolSlug: input.toolSlug,
        model: input.model,
        systemPrompt: input.systemPrompt,
        contextProfileId: input.contextProfileId ?? null,
      })
      .where(eq(chatSessions.id, input.sessionId))
      .run();
  } else {
    const row: ChatSessionRow = {
      id: input.sessionId,
      projectId: null,
      toolSlug: input.toolSlug,
      systemPrompt: input.systemPrompt,
      model: input.model,
      contextProfileId: input.contextProfileId ?? null,
      userId: input.userId,
      cohortId: input.cohortId ?? null,
      createdAt: new Date(),
    };
    db.insert(chatSessions).values(row).run();
  }

  // Rewrite the transcript for this session (idempotent per turn).
  db.delete(messages).where(eq(messages.sessionId, input.sessionId)).run();
  const base = (input.at ?? new Date()).getTime();
  const rows: MessageRow[] = input.messages
    .filter((m) => m.content.trim().length > 0)
    .map((m, i) => ({
      id: randomUUID(),
      sessionId: input.sessionId,
      role: m.role,
      content: m.content,
      createdAt: new Date(base + i),
    }));
  if (rows.length > 0) db.insert(messages).values(rows).run();
}

/** The session row, or null. Used by the close action to authorise + scope. */
export async function getChatSession(sessionId: string): Promise<ChatSessionRow | null> {
  return getDb().select().from(chatSessions).where(eq(chatSessions.id, sessionId)).get() ?? null;
}

/**
 * A session's raw messages in order. This is the student-owned / summariser
 * path — deliberately NOT imported by the mentor insight route or repo.
 */
export async function getSessionMessages(sessionId: string): Promise<MessageRow[]> {
  return getDb()
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))
    .all();
}
