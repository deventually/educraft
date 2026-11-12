/**
 * The second assessor on a track (brief P38.5), the server half: the `second-assessor` intent of
 * the track page. Both scores are level ids on one of the caller's own rubrics (`a:<criterion>`
 * and `b:<criterion>`); the comparison is P34.1's, and only its outcome is kept as a round. No AI.
 */
import { z } from "zod";
import { getMessages, type Locale } from "~/lib/i18n";
import { compareAssessors, secondAssessorMarkdown } from "~/lib/tracks";
import type { User } from "./auth.server";
import { getRubric, listRubrics } from "./repositories/rubrics.server";
import { addRound, type Track } from "./repositories/tracks.server";

const INTENT = "second-assessor" as const;
const RubricId = z.string().min(1).max(100);

type SecondAssessorResult =
  | { ok: true; intent: typeof INTENT }
  | { ok: false; intent: typeof INTENT; error: string };

/** The `second-assessor` intent; null for any other intent. */
export async function trackSecondAssessorAction(
  request: Request,
  user: User,
  track: Track,
  locale: Locale,
): Promise<SecondAssessorResult | null> {
  const fd = await request.clone().formData();
  if (fd.get("intent") !== INTENT) return null;
  const m = getMessages(locale).tracks.secondAssessor;
  const fail = (error: string) => ({ ok: false as const, intent: INTENT, error });
  if (track.closedAt) return fail(m.errors.closed);
  const rubricId = RubricId.safeParse(fd.get("rubricId"));
  const rubric = rubricId.success ? await getRubric(user.id, rubricId.data) : null;
  if (!rubric) return fail(m.errors.rubric);
  const choice = (side: "a" | "b") =>
    Object.fromEntries(
      rubric.data.criteria.map((c) => [c.id, String(fd.get(`${side}:${c.id}`) ?? "")]),
    );
  const result = compareAssessors(rubric.data, choice("a"), choice("b"));
  if (!result) return fail(m.errors.incomplete);
  const text = `**${rubric.name}**\n\n${secondAssessorMarkdown(result, m.labels, locale)}`;
  const round = await addRound(user.id, track.id, {
    milestone: "second-assessor",
    redactedText: "",
    feedback: { text },
  });
  return round ? { ok: true, intent: INTENT } : fail(m.errors.closed);
}

/** The caller's rubrics for the second-assessor tab: names, criteria and levels only. */
export async function rubricChoices(user: User) {
  return (await listRubrics(user.id, 100)).map((r) => ({
    id: r.id,
    name: r.name,
    criteria: r.data.criteria.map((c) => ({
      id: c.id,
      title: c.title,
      levels: c.levels.map((l) => ({ id: l.id, label: l.label })),
    })),
  }));
}
