/**
 * The institution's never-list (anonymiseerpoort PR 5): words the admin keeps for everyone,
 * picked from what teachers put on their own never-list (`keepWords.server.ts`). The admin sees
 * how many teachers chose a word, never who. A user's full name never shows here and never goes
 * on the shared list; a lone part of a name ("Visser") may, since that is what a never-list holds.
 * Instance-wide like the team list (the route checks the role).
 * Repository rule: every exported function is `async`.
 */
import { asc, desc, eq, sql } from "drizzle-orm";
import { isKeepWord } from "~/lib/privacy/live";
import { KEEP_WORDS } from "~/lib/privacy/pack/keep";
import { getDb } from "../db.server";
import { privacyKeepWords, privacySharedKeepWords, users } from "../schema.server";

/** Enough for every word an institution keeps; the gate and every page match each one. */
const MAX_WORDS = 500;
/** The admin reads the most chosen words first; the long tail is noise. */
const MAX_SUGGESTIONS = 200;

const tidy = (word: string) => word.trim().replace(/\s+/g, " ");
const key = (word: string) => tidy(word).toLowerCase();

function userNames(): Set<string> {
  return new Set(
    getDb()
      .select({ name: users.name })
      .from(users)
      .all()
      .map((u) => key(u.name)),
  );
}

export async function listSharedKeepWords(): Promise<string[]> {
  return getDb()
    .select({ shown: privacySharedKeepWords.shown })
    .from(privacySharedKeepWords)
    .orderBy(asc(privacySharedKeepWords.word))
    .limit(MAX_WORDS)
    .all()
    .map((r) => r.shown);
}

/**
 * The teachers' words that are not kept for everyone yet, with how many teachers chose each, most
 * first. Leaves out a user's full name and what the privacy pack already keeps.
 */
export async function listKeepWordSuggestions(): Promise<{ word: string; teachers: number }[]> {
  const db = getDb();
  const skip = new Set([
    ...userNames(),
    ...KEEP_WORDS,
    ...db
      .select({ word: privacySharedKeepWords.word })
      .from(privacySharedKeepWords)
      .all()
      .map((r) => r.word),
  ]);
  const teachers = sql<number>`count(*)`;
  return db
    .select({
      word: privacyKeepWords.word,
      shown: sql<string>`min(${privacyKeepWords.shown})`,
      teachers,
    })
    .from(privacyKeepWords)
    .groupBy(privacyKeepWords.word)
    .orderBy(desc(teachers), asc(privacyKeepWords.word))
    .all()
    .filter((r) => !skip.has(r.word))
    .slice(0, MAX_SUGGESTIONS)
    .map((r) => ({ word: r.shown, teachers: Number(r.teachers) }));
}

/** Keeps a word for everyone. Refused when it is not a word, a user's full name, or the list is full. */
export async function addSharedKeepWord(
  word: string,
  adminId: string,
): Promise<"added" | "invalid" | "name"> {
  if (!isKeepWord(word)) return "invalid";
  if (userNames().has(key(word))) return "name";
  const db = getDb();
  if (
    db.select({ word: privacySharedKeepWords.word }).from(privacySharedKeepWords).all().length >=
    MAX_WORDS
  )
    return "invalid";
  db.insert(privacySharedKeepWords)
    .values({ word: key(word), shown: tidy(word), addedBy: adminId, createdAt: new Date() })
    .onConflictDoNothing()
    .run();
  return "added";
}

export async function removeSharedKeepWord(word: string): Promise<void> {
  getDb()
    .delete(privacySharedKeepWords)
    .where(eq(privacySharedKeepWords.word, key(word)))
    .run();
}
