/**
 * A teacher's exceptions (P28.3, admin only): per feature (`feature:<id>`) or tool
 * (`tool:<slug>`) "on" or "off", above every team. Repository rule: every exported
 * function is `async` and scoped to its owning `userId`.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { featureExceptions } from "../schema.server";
import { type Choice, isChoice } from "~/lib/features/rule";

/** The key of a feature or tool in the exception and team stores. */
export const featureKey = (id: string) => `feature:${id}`;
export const toolKey = (slug: string) => `tool:${slug}`;

export async function getExceptions(userId: string): Promise<Map<string, Choice>> {
  const rows = getDb()
    .select()
    .from(featureExceptions)
    .where(eq(featureExceptions.userId, userId))
    .all();
  return new Map(rows.flatMap((r) => (isChoice(r.choice) ? [[r.key, r.choice] as const] : [])));
}

/** Set or clear (null) one exception. Switching off deletes nothing else. */
export async function setException(
  userId: string,
  key: string,
  choice: Choice | null,
): Promise<void> {
  const db = getDb();
  if (choice === null) {
    db.delete(featureExceptions)
      .where(and(eq(featureExceptions.userId, userId), eq(featureExceptions.key, key)))
      .run();
    return;
  }
  db.insert(featureExceptions)
    .values({ userId, key, choice, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [featureExceptions.userId, featureExceptions.key],
      set: { choice, updatedAt: new Date() },
    })
    .run();
}
