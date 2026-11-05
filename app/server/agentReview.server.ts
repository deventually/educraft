/**
 * Role agents, the server half (brief P21, 21.4): "Laat beoordelen" and the teacher's
 * decision. Every hat that watches courses runs on the model the teacher picks (or their
 * default), its answer goes through `parseAgentReview` (21.1) and is stored (21.3). One
 * hat failing never loses another hat's advice. Hats advise; the course is never changed.
 */
import { z } from "zod";
import { buildReviewMessage } from "~/lib/agents/input";
import { parseAgentReview } from "~/lib/agents/filter";
import { agentsWatching } from "~/lib/agents/registry";
import {
  type Agent,
  DECISION_REASON_MAX,
  DECISIONS,
  type ReviewPanelAgent,
} from "~/lib/agents/types";
import { DEFAULT_MODEL, resolveModelInfo } from "~/lib/ai/models";
import { checkAlignment } from "~/lib/courses/alignment";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import {
  effectiveDefaultModel,
  getSelectableModels,
  isFeatureOn,
  isModelSelectableForUser,
} from "./availability.server";
import { log } from "./log.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import type { Course } from "./repositories/courses.server";
import {
  decideFinding,
  getReview,
  listDecisions,
  listRejectedFindings,
  listReviewsForCourse,
  saveReview,
} from "./repositories/agentReviews.server";

const EVENT = "agent-review";

export type ReviewError = "model" | "quota" | "failed";

export type ReviewResult =
  | { ok: true; reviewed: string[]; failed: Agent[] }
  | { ok: false; error: ReviewError };

/** Runs one hat, with one retry on an unusable answer; true when its review was saved. */
async function runAgent(
  user: User,
  course: Course,
  agent: Agent,
  message: string,
  rejected: Parameters<typeof parseAgentReview>[2],
  locale: Locale,
  model: string | undefined,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(
      user,
      agent.promptId,
      message,
      locale,
      4_000,
      EVENT,
      model,
    );
    if (!answer) return false;
    const parsed = parseAgentReview(answer.text, course.data, rejected);
    if (parsed.ok) {
      const saved = await saveReview(user.id, {
        courseId: course.id,
        agentId: agent.id,
        model: answer.model,
        findings: parsed.findings,
      });
      return saved !== null;
    }
    log(EVENT, { agent: agent.id, outcome: "rejected", reason: parsed.error, attempt });
  }
  return false;
}

/** The `review` intent: every course hat reviews the caller's (already loaded) course. */
export async function reviewCourse(
  user: User,
  course: Course,
  requestedModel: string | null,
  locale: Locale,
): Promise<ReviewResult> {
  const model = requestedModel || undefined;
  if (model && !(await isModelSelectableForUser(user, model))) return { ok: false, error: "model" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const rejected = await listRejectedFindings(user.id, course.id, 500);
  const message = buildReviewMessage(
    { course: course.data, alignment: checkAlignment(course.data), rejected },
    locale,
  );
  const reviewed: string[] = [];
  const failed: Agent[] = [];
  for (const agent of agentsWatching("course")) {
    const ok = await runAgent(user, course, agent, message, rejected, locale, model).catch(
      () => false,
    );
    if (ok) reviewed.push(agent.id);
    else failed.push(agent);
  }
  if (reviewed.length === 0) return { ok: false, error: "failed" };
  return { ok: true, reviewed, failed };
}

const DecideSchema = z.object({
  reviewId: z.string().min(1).max(100),
  findingId: z.string().min(1).max(20),
  decision: z.enum(DECISIONS),
  reason: z.string().max(DECISION_REASON_MAX).optional(),
});

/** The `decide` intent: Akkoord / Niet akkoord on one finding of a review of THIS course. */
export async function decideOnFinding(
  user: User,
  course: Course,
  fd: FormData,
): Promise<{ ok: true } | { ok: false; error: "invalid" | "not-found" }> {
  const parsed = DecideSchema.safeParse({
    reviewId: fd.get("reviewId") ?? undefined,
    findingId: fd.get("findingId") ?? undefined,
    decision: fd.get("decision") ?? undefined,
    reason: fd.get("reason")?.toString().trim() || undefined,
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const review = await getReview(user.id, parsed.data.reviewId);
  if (review?.courseId !== course.id) return { ok: false, error: "not-found" };
  const saved = await decideFinding(user.id, parsed.data);
  return saved ? { ok: true } : { ok: false, error: "not-found" };
}

export interface ReviewPanelData {
  agents: ReviewPanelAgent[];
  models: { id: string; displayName: string }[];
  defaultModel: string;
}

/** The panel's loader data; null when role agents are switched off for this teacher. */
export async function loadReviewPanel(user: User, course: Course): Promise<ReviewPanelData | null> {
  if (!(await isFeatureOn(user, "roleAgents"))) return null;
  const all = await listReviewsForCourse(user.id, course.id);
  const agents = await Promise.all(
    agentsWatching("course").map(async (agent): Promise<ReviewPanelAgent> => {
      const latest = all.find((r) => r.agentId === agent.id);
      if (!latest) return { agentId: agent.id, role: agent.role, review: null };
      const decisions = new Map(
        (await listDecisions(user.id, latest.id)).map((d) => [d.findingId, d]),
      );
      return {
        agentId: agent.id,
        role: agent.role,
        review: {
          id: latest.id,
          model: resolveModelInfo(latest.model).displayName,
          stale: course.updatedAt.getTime() > latest.courseUpdatedAt.getTime(),
          findings: latest.findings.map((f) => {
            const d = decisions.get(f.id);
            return d ? { ...f, decision: d.decision, reason: d.reason } : f;
          }),
        },
      };
    }),
  );
  const models = (await getSelectableModels(user)).map((m) => ({
    id: m.id,
    displayName: m.displayName,
  }));
  return { agents, models, defaultModel: await effectiveDefaultModel(user, DEFAULT_MODEL) };
}
