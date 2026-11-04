// @vitest-environment node
// P18.7 (BESLUIT-2026-11-03-17): the non-destructive migration that brings `users.disabled_at`
// back (owner-set deactivation). Applies the journal up to 0008, seeds a user, applies the rest,
// and asserts. Entries are found via the journal, never by a fixed number. This is test code, so
// it may use better-sqlite3 directly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

const DRIZZLE = join(process.cwd(), "drizzle");
const journal = JSON.parse(readFileSync(join(DRIZZLE, "meta/_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const LAST_OLD = "0008_stormy_bloodaxe";

function readSql(tag: string): string {
  return readFileSync(join(DRIZZLE, `${tag}.sql`), "utf8");
}

function apply(db: Database.Database, tags: string[]) {
  for (const tag of tags) {
    for (const stmt of readSql(tag).split("--> statement-breakpoint")) {
      if (stmt.trim()) db.exec(stmt);
    }
  }
}

const tags = journal.entries.map((e) => e.tag);
const cut = tags.indexOf(LAST_OLD) + 1;
const NOW = 1_700_000_000_000;

let db: Database.Database;

beforeAll(() => {
  db = new Database(":memory:");
  apply(db, tags.slice(0, cut));
  db.prepare(
    "INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)",
  ).run("t1", "t1", "t@x.nl", "h", "teacher", NOW);
  apply(db, tags.slice(cut));
});

const cols = (t: string) =>
  (db.pragma(`table_info(${t})`) as { name: string; notnull: number }[]).map((c) => c);

describe("P18.7 migration", () => {
  it("has a migration after 0008", () => {
    expect(tags.length).toBeGreaterThan(cut);
  });

  it("adds users.disabled_at, nullable, and keeps the existing user active", () => {
    const col = cols("users").find((c) => c.name === "disabled_at");
    expect(col).toBeDefined();
    expect(col?.notnull).toBe(0);
    const row = db.prepare("SELECT disabled_at, name FROM users WHERE id='t1'").get() as {
      disabled_at: number | null;
      name: string;
    };
    expect(row.name).toBe("t1");
    expect(row.disabled_at).toBeNull();
  });

  it("is a plain ADD COLUMN: no table rebuild, nothing dropped", () => {
    const sql = tags
      .slice(cut)
      .map(readSql)
      .join("\n")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(sql).toEqual(["ALTER TABLE `users` ADD `disabled_at` integer;"]);
  });
});
