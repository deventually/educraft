/**
 * Closed rubric fill-ins (brief P23.3, BESLUIT-2026-11-04-8). The server keeps only which level
 * was chosen per criterion, and the month: no name, no student code, no comment, no date per
 * fill-in. Every write is re-parsed with `RubricScoresSchema` (strict: extra keys are refused) and
 * checked against the rubric's own ids; invalid → throws, nothing written. Async and scoped to the
 * owning `userId`, like every repository.
 */
import { randomInt, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { rubricScores } from "../schema.server";
import { getRubric } from "./rubrics.server";
import {
  matchesRubric,
  RubricScoreSchema,
  RubricScoresSchema,
  type RubricScore,
} from "~/lib/utilities/rubric";

export interface StoredRubricScore {
  month: string;
  levels: RubricScore;
}

const monthOf = (d: Date) => d.toISOString().slice(0, 7);

/** Fisher–Yates, so the stored order says nothing about the order of students in the batch. */
function shuffle<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Stores the closed fill-ins of one batch. Null when the rubric is not the caller's; throws when
 * any fill-in is invalid (then none is stored). Returns how many were stored.
 */
export async function addRubricScores(
  userId: string,
  rubricId: string,
  scores: unknown,
  now: Date = new Date(),
): Promise<number | null> {
  const rubric = await getRubric(userId, rubricId);
  if (!rubric) return null;
  const parsed = RubricScoresSchema.parse(scores);
  if (!parsed.every((s) => matchesRubric(rubric.data, s))) throw new Error("Invalid rubric score");
  const month = monthOf(now);
  const rows = shuffle(parsed).map((levels) => ({
    id: randomUUID(),
    userId,
    rubricId,
    month,
    levelsJson: JSON.stringify(levels),
  }));
  getDb().transaction((tx) => {
    for (const row of rows) tx.insert(rubricScores).values(row).run();
  });
  return rows.length;
}

export async function listRubricScores(
  userId: string,
  rubricId: string,
  limit?: number,
): Promise<StoredRubricScore[]> {
  return getDb()
    .select({ month: rubricScores.month, levelsJson: rubricScores.levelsJson })
    .from(rubricScores)
    .where(and(eq(rubricScores.userId, userId), eq(rubricScores.rubricId, rubricId)))
    .limit(Math.min(limit ?? 500, 500))
    .all()
    .flatMap((row) => {
      const levels = RubricScoreSchema.safeParse(JSON.parse(row.levelsJson));
      return levels.success ? [{ month: row.month, levels: levels.data }] : [];
    });
}
