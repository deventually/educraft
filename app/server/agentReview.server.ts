/**
 * Role agents, the server half (brief P21, 21.4): "Laat beoordelen" and the teacher's
 * decision. Every hat that watches courses runs on the model the teacher picks (or their
 * default), its answer goes through `parseAgentReview` (21.1) and is stored (21.3). One
 * hat failing never loses another hat's advice. Hats advise; the course is never changed.
 */
import { z } from "zod";
import { buildReviewMessage, LINKED_LIMITS, type LinkedWorkInput } from "~/lib/agents/input";
import { parseAgentReview } from "~/lib/agents/filter";
import { activeAgents, chosenAgents } from "~/lib/agents/registry";
import {
  type Agent,
  DECISION_REASON_MAX,
  DECISIONS,
  type ReviewPanelAgent,
  type ReviewPanelChoice,
} from "~/lib/agents/types";
import {
  DEFAULT_MODEL,
  forwardRetired,
  isResolvableModel,
  resolveModelInfo,
} from "~/lib/ai/models";
import { syncModelRegistry } from "./modelRegistry.server";
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
import { type Course, listLinkedWork } from "./repositories/courses.server";
import { getGeneration } from "./repositories/generations.server";
import {
  decideFinding,
  getReview,
  listDecisions,
  listRejectedFindings,
  listReviewsForCourse,
  saveReview,
} from "./repositories/agentReviews.server";
import { getAgentStands } from "./repositories/settings.server";
import { getAgentChoices, setAgentChoices } from "./repositories/agentChoices.server";

const EVENT = "agent-review";

/** The course hats an admin has not switched off on /admin/agents. */
const courseAgents = async (): Promise<Agent[]> => activeAgents("course", await getAgentStands());

/** Of the hats the admin has on, the ones this teacher chose. */
const teacherAgents = async (user: User, active: Agent[]): Promise<Agent[]> =>
  chosenAgents(active, await getAgentChoices(user.id));

export type ReviewError = "model" | "quota" | "failed" | "none";

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

/** The only tool whose linked work a hat may review, for now (brief P21: other tools later). */
const REVIEWABLE_TOOL = "test-items";

async function linkedTestItems(userId: string, courseId: string) {
  return (await listLinkedWork(userId, courseId, 500)).filter(
    (w) => w.toolSlug === REVIEWABLE_TOOL,
  );
}

/** The caller's own linked test questions, newest first, as hat input (P21.7). */
async function loadLinkedWork(userId: string, courseId: string): Promise<LinkedWorkInput[]> {
  const links = (await linkedTestItems(userId, courseId)).slice(0, LINKED_LIMITS.count);
  const work = await Promise.all(
    links.map(async (w) => {
      const g = await getGeneration(userId, w.generationId);
      return g ? { itemId: w.itemId, text: g.outputMarkdown } : null;
    }),
  );
  return work.filter((w): w is LinkedWorkInput => w !== null);
}

/**
 * The `review` intent: every course hat reviews the caller's (already loaded) course. With
 * `includeLinked`, hats that watch generations also get the linked test questions.
 */
export async function reviewCourse(
  user: User,
  course: Course,
  requestedModel: string | null,
  locale: Locale,
  includeLinked = false,
  /** The hats the teacher ticked (remembered as their choice); absent = their earlier choice. */
  ticked?: string[],
): Promise<ReviewResult> {
  const active = await courseAgents();
  if (active.length === 0) return { ok: false, error: "failed" };
  if (ticked)
    await setAgentChoices(
      user.id,
      Object.fromEntries(active.map((a) => [a.id, ticked.includes(a.id) ? "on" : "off"])),
    );
  const agents = await teacherAgents(user, active);
  if (agents.length === 0) return { ok: false, error: "none" };
  // A retired model hands over to its newest version (the page may be older than the upgrade).
  await syncModelRegistry();
  const model = requestedModel ? forwardRetired(requestedModel) : undefined;
  if (model && !(await isModelSelectableForUser(user, model))) return { ok: false, error: "model" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const rejected = await listRejectedFindings(user.id, course.id, 500);
  const input = { course: course.data, alignment: checkAlignment(course.data), rejected };
  const message = buildReviewMessage(input, locale);
  const linkedWork = includeLinked ? await loadLinkedWork(user.id, course.id) : [];
  const withLinked = linkedWork.length
    ? buildReviewMessage({ ...input, linkedWork }, locale)
    : message;
  const reviewed: string[] = [];
  const failed: Agent[] = [];
  for (const agent of agents) {
    const text = agent.watches.includes("generation") ? withLinked : message;
    const ok = await runAgent(user, course, agent, text, rejected, locale, model).catch(
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
  /** The reviews of the hats this teacher chose. */
  agents: ReviewPanelAgent[];
  /** Every hat the admin has on, ticked when the teacher chose it. */
  choices: ReviewPanelChoice[];
  /** How many test-question generations are linked to the course (the "also review" box). */
  linkedTests: number;
  models: { id: string; displayName: string }[];
  defaultModel: string;
}

/** The panel's loader data; null when role agents, or every hat, are switched off. */
export async function loadReviewPanel(user: User, course: Course): Promise<ReviewPanelData | null> {
  if (!(await isFeatureOn(user, "roleAgents"))) return null;
  const active = await courseAgents();
  if (active.length === 0) return null;
  const chosen = await teacherAgents(user, active);
  const all = await listReviewsForCourse(user.id, course.id);
  const agents = await Promise.all(
    chosen.map(async (agent): Promise<ReviewPanelAgent> => {
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
          // An added model may not be installed yet on a fresh process: keep its id then.
          model: isResolvableModel(latest.model)
            ? resolveModelInfo(latest.model).displayName
            : latest.model,
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
  return {
    agents,
    choices: active.map((a) => ({
      agentId: a.id,
      role: a.role,
      focus: a.focus,
      chosen: chosen.includes(a),
    })),
    models,
    defaultModel: await effectiveDefaultModel(user, DEFAULT_MODEL),
    linkedTests: (await linkedTestItems(user.id, course.id)).length,
  };
}

/**
 * Open role-agent findings per course (P22.3): findings of each active agent's latest
 * review without a decision. Null when role agents are switched off for this teacher.
 */
export async function openAgentFindings(
  user: User,
  courseIds: string[],
): Promise<Record<string, number> | null> {
  if (!(await isFeatureOn(user, "roleAgents"))) return null;
  const agents = await teacherAgents(user, await courseAgents());
  const out: Record<string, number> = {};
  for (const courseId of courseIds) {
    const all = await listReviewsForCourse(user.id, courseId);
    let open = 0;
    for (const agent of agents) {
      const latest = all.find((r) => r.agentId === agent.id);
      if (!latest) continue;
      const decided = new Set((await listDecisions(user.id, latest.id)).map((d) => d.findingId));
      open += latest.findings.filter((f) => !decided.has(f.id)).length;
    }
    if (open > 0) out[courseId] = open;
  }
  return out;
}
