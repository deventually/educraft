/**
 * The teacher's never-list (anonymiseerpoort PR 3, BESLUIT-2026-11-17-6): words the live
 * preview and the gate never replace for this teacher. Scoped to `userId` in every WHERE clause.
 * Only words: anything with a digit or an `@` is a person's data and stays in the page.
 */
import { and, asc, eq } from "drizzle-orm";
import { isKeepWord } from "~/lib/privacy/live";
import { getDb } from "../db.server";
import { privacyKeepWords } from "../schema.server";

/** Enough for every researcher and model a teacher meets; the gate matches each one. */
const MAX_WORDS = 300;

const key = (word: string) => word.trim().replace(/\s+/g, " ").toLowerCase();

export async function listKeepWords(userId: string): Promise<string[]> {
  return getDb()
    .select({ shown: privacyKeepWords.shown })
    .from(privacyKeepWords)
    .where(eq(privacyKeepWords.userId, userId))
    .orderBy(asc(privacyKeepWords.word))
    .limit(MAX_WORDS)
    .all()
    .map((r) => r.shown);
}

/** False when the word is refused (not a word, or the list is full); adding twice is fine. */
export async function addKeepWord(userId: string, word: string): Promise<boolean> {
  if (!isKeepWord(word)) return false;
  const db = getDb();
  const count = db
    .select({ word: privacyKeepWords.word })
    .from(privacyKeepWords)
    .where(eq(privacyKeepWords.userId, userId))
    .all().length;
  if (count >= MAX_WORDS) return false;
  db.insert(privacyKeepWords)
    .values({
      userId,
      word: key(word),
      shown: word.trim().replace(/\s+/g, " "),
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .run();
  return true;
}

export async function removeKeepWord(userId: string, word: string): Promise<void> {
  getDb()
    .delete(privacyKeepWords)
    .where(and(eq(privacyKeepWords.userId, userId), eq(privacyKeepWords.word, key(word))))
    .run();
}
