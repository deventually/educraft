/**
 * Role-agent reviews and the teacher's decisions (brief P21, 21.3). Repository rule:
 * async, every query scoped to the owning `userId`, lists capped. A review can only be
 * saved for the caller's own course, a decision only on the caller's own review and on a
 * finding that review contains. Hats advise; nothing here touches the course.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { AGENT_LIMITS } from "~/lib/agents/schema";
import {
  DECISION_REASON_MAX,
  SEVERITIES,
  type AgentFinding,
  type Decision,
  type RejectedFinding,
  type ReviewFinding,
} from "~/lib/agents/types";
import { getDb } from "../db.server";
import { agentReviews, reviewDecisions } from "../schema.server";
import { getCourse } from "./courses.server";

export interface AgentReview {
  id: string;
  courseId: string;
  agentId: string;
  model: string;
  findings: ReviewFinding[];
  /** The course's `updatedAt` when it was reviewed; later means "out of date". */
  courseUpdatedAt: Date;
  createdAt: Date;
}

export interface ReviewDecision {
  id: string;
  reviewId: string;
  findingId: string;
  decision: Decision;
  reason: string | null;
  createdAt: Date;
}

const cap = (limit?: number) => Math.min(limit ?? 50, 500);

const ReviewFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(SEVERITIES),
  targetId: z.string().optional(),
  message: z.string().max(AGENT_LIMITS.message),
  suggestion: z.string().max(AGENT_LIMITS.suggestion),
});
const FindingsSchema = z.array(ReviewFindingSchema).max(AGENT_LIMITS.findings);

function rowToReview(row: typeof agentReviews.$inferSelect): AgentReview {
  return {
    id: row.id,
    courseId: row.courseId,
    agentId: row.agentId,
    model: row.model,
    findings: FindingsSchema.parse(JSON.parse(row.findingsJson)) as ReviewFinding[],
    courseUpdatedAt: row.courseUpdatedAt,
    createdAt: row.createdAt,
  };
}

const rowToDecision = (row: typeof reviewDecisions.$inferSelect): ReviewDecision => ({
  id: row.id,
  reviewId: row.reviewId,
  findingId: row.findingId,
  decision: row.decision as Decision,
  reason: row.reason,
  createdAt: row.createdAt,
});

const ownReview = (userId: string, id: string) =>
  and(eq(agentReviews.id, id), eq(agentReviews.userId, userId));

/**
 * Saves one hat's findings for the caller's course; null when the course is not theirs.
 * Throws on findings outside the hat's bounds (nothing is written).
 */
export async function saveReview(
  userId: string,
  input: { courseId: string; agentId: string; model: string; findings: AgentFinding[] },
): Promise<AgentReview | null> {
  const course = await getCourse(userId, input.courseId);
  if (!course) return null;
  const findings = FindingsSchema.parse(
    input.findings.map((f, i) => ({ ...f, id: `f${i + 1}` })),
  ) as ReviewFinding[];
  const row = {
    id: randomUUID(),
    userId,
    courseId: course.id,
    agentId: input.agentId,
    model: input.model,
    findingsJson: JSON.stringify(findings),
    courseUpdatedAt: course.updatedAt,
    createdAt: new Date(),
  };
  getDb().insert(agentReviews).values(row).run();
  return rowToReview(row);
}

export async function getReview(userId: string, id: string): Promise<AgentReview | null> {
  const row = getDb().select().from(agentReviews).where(ownReview(userId, id)).get();
  return row ? rowToReview(row) : null;
}

/** The caller's reviews of one course, newest first. */
export async function listReviewsForCourse(
  userId: string,
  courseId: string,
  limit?: number,
): Promise<AgentReview[]> {
  return getDb()
    .select()
    .from(agentReviews)
    .where(and(eq(agentReviews.courseId, courseId), eq(agentReviews.userId, userId)))
    .orderBy(desc(agentReviews.createdAt))
    .limit(cap(limit))
    .all()
    .map(rowToReview);
}

/**
 * Records (or replaces) the teacher's decision on one finding. Null when the review is not
 * the caller's or has no such finding; throws when the reason is too long.
 */
export async function decideFinding(
  userId: string,
  input: { reviewId: string; findingId: string; decision: Decision; reason?: string | null },
): Promise<ReviewDecision | null> {
  const trimmed = input.reason?.trim() ?? "";
  if (trimmed.length > DECISION_REASON_MAX) throw new Error("Reason too long");
  const reason = trimmed === "" ? null : trimmed;
  const review = await getReview(userId, input.reviewId);
  if (!review?.findings.some((f) => f.id === input.findingId)) return null;
  const row = {
    id: randomUUID(),
    userId,
    reviewId: review.id,
    findingId: input.findingId,
    decision: input.decision,
    reason,
    createdAt: new Date(),
  };
  const saved = getDb()
    .insert(reviewDecisions)
    .values(row)
    .onConflictDoUpdate({
      target: [reviewDecisions.reviewId, reviewDecisions.findingId],
      set: { decision: row.decision, reason, createdAt: row.createdAt },
    })
    .returning()
    .get();
  return rowToDecision(saved);
}

export async function listDecisions(
  userId: string,
  reviewId: string,
  limit?: number,
): Promise<ReviewDecision[]> {
  return getDb()
    .select()
    .from(reviewDecisions)
    .where(and(eq(reviewDecisions.reviewId, reviewId), eq(reviewDecisions.userId, userId)))
    .orderBy(desc(reviewDecisions.createdAt))
    .limit(cap(limit))
    .all()
    .map(rowToDecision);
}

/**
 * Every finding the teacher rejected on this course, so the next review does not raise it
 * again (input to `buildReviewMessage` and `parseAgentReview`).
 */
export async function listRejectedFindings(
  userId: string,
  courseId: string,
  limit?: number,
): Promise<RejectedFinding[]> {
  const reviews = await listReviewsForCourse(userId, courseId, limit);
  if (reviews.length === 0) return [];
  const rejected = getDb()
    .select({ reviewId: reviewDecisions.reviewId, findingId: reviewDecisions.findingId })
    .from(reviewDecisions)
    .where(
      and(
        eq(reviewDecisions.userId, userId),
        eq(reviewDecisions.decision, "rejected"),
        inArray(
          reviewDecisions.reviewId,
          reviews.map((r) => r.id),
        ),
      ),
    )
    .all();
  const byReview = new Map(reviews.map((r) => [r.id, r]));
  return rejected.flatMap(({ reviewId, findingId }) => {
    const f = byReview.get(reviewId)?.findings.find((x) => x.id === findingId);
    if (!f) return [];
    return [
      f.targetId === undefined
        ? { message: f.message }
        : { targetId: f.targetId, message: f.message },
    ];
  });
}
