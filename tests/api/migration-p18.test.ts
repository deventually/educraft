// @vitest-environment node
// P18.7 + P18.8 (BESLUIT-2026-11-03-15, -17). 18.7: the non-destructive migration that brings
// `users.disabled_at` back. 18.8: the destructive clean-up (dormant tables, retired columns and
// settings keys, open admin invites). Each applies the journal up to the previous step, seeds,
// applies the next, and asserts. Entries are found via the journal, never by a fixed number. This is test code, so
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
// The 18.7 migration is this entry; everything after it is 18.8 (found via the journal, so a
// later renumbering or an extra entry never breaks the cut).
const LAST_P18_7 = "0009_empty_trauma";

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
const cut187 = tags.indexOf(LAST_P18_7) + 1;
const NOW = 1_700_000_000_000;

let db: Database.Database;

beforeAll(() => {
  db = new Database(":memory:");
  apply(db, tags.slice(0, cut));
  db.prepare(
    "INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)",
  ).run("t1", "t1", "t@x.nl", "h", "teacher", NOW);
  apply(db, tags.slice(cut, cut187));
});

const cols = (t: string) =>
  (db.pragma(`table_info(${t})`) as { name: string; notnull: number }[]).map((c) => c);

describe("P18.7 migration", () => {
  it("has a migration after 0008", () => {
    expect(cut187).toBeGreaterThan(cut);
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
      .slice(cut, cut187)
      .map(readSql)
      .join("\n")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(sql).toEqual(["ALTER TABLE `users` ADD `disabled_at` integer;"]);
  });
});

// ---------------------------------------------------------------------------------------------
// 18.8
// ---------------------------------------------------------------------------------------------

// 18.8 is exactly one migration (0010). Later phases add their own migrations after it, so
// bound the slice instead of reading "everything after 18.7".
const sqlOf18_8 = () =>
  tags
    .slice(cut187, cut187 + 1)
    .map(readSql)
    .join("\n");
let db8: Database.Database;
const tableNames = () =>
  (
    db8.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
  ).map((r) => r.name);
const cols8 = (t: string) =>
  (db8.pragma(`table_info(${t})`) as { name: string }[]).map((c) => c.name);
const keys8 = () =>
  (db8.prepare("SELECT key FROM instance_settings ORDER BY key").all() as { key: string }[]).map(
    (r) => r.key,
  );

describe("P18.8 migration", () => {
  beforeAll(() => {
    db8 = new Database(":memory:");
    apply(db8, tags.slice(0, cut187));
    const run = (sql: string, ...p: unknown[]) => db8.prepare(sql).run(...p);
    run(
      "INSERT INTO users (id,name,email,password_hash,role,allowed_tool_slugs,created_at) VALUES (?,?,?,?,?,?,?)",
      "t1",
      "Teacher One",
      "t@x.nl",
      "h",
      "teacher",
      '["a"]',
      NOW,
    );
    run("INSERT INTO projects (id,user_id,name,created_at) VALUES (?,?,?,?)", "p1", "t1", "p", NOW);
    for (const id of ["g1", "g2"]) {
      run(
        "INSERT INTO generations (id,user_id,project_id,tool_slug,model,input_json,output_markdown,created_at) VALUES (?,?,?,?,?,?,?,?)",
        id,
        "t1",
        "p1",
        "arcs-reactor",
        "m",
        '{"x":1}',
        `out-${id}`,
        NOW,
      );
    }
    run(
      "INSERT INTO chat_sessions (id,tool_slug,system_prompt,model,user_id,created_at) VALUES (?,?,?,?,?,?)",
      "cs1",
      "mentorai",
      "s",
      "m",
      "t1",
      NOW,
    );
    run(
      "INSERT INTO messages (id,session_id,role,content,created_at) VALUES (?,?,?,?,?)",
      "m1",
      "cs1",
      "user",
      "hi",
      NOW,
    );
    run(
      "INSERT INTO invites (token,role,allowed_tool_slugs,created_at) VALUES (?,?,?,?)",
      "inv-teacher",
      "teacher",
      '["a"]',
      NOW,
    );
    run("INSERT INTO invites (token,role,created_at) VALUES (?,?,?)", "inv-admin", "admin", NOW);
    run(
      "INSERT INTO invites (token,role,used_by_user_id,created_at) VALUES (?,?,?,?)",
      "inv-admin-used",
      "admin",
      "t1",
      NOW,
    );
    const setting = (k: string) =>
      run("INSERT INTO instance_settings (key,value_json,updated_at) VALUES (?,?,?)", k, "[]", NOW);
    for (const k of [
      "enabledCountries",
      "assignedCountries:t1",
      "assignedSectors:t1",
      "assignedDomains:t1",
      "contextCustomAccess:t1",
      "assignedModels:t1",
      "enabledModels",
      "enabledSectors",
      "enabledDomains",
      "ownerUserId",
    ])
      setting(k);
    apply(db8, tags.slice(cut187));
  });

  it("has a migration after 18.7", () => {
    expect(tags.length).toBeGreaterThan(cut187);
  });

  it("drops chat_sessions, messages and projects", () => {
    const names = tableNames();
    for (const t of ["chat_sessions", "messages", "projects"]) expect(names).not.toContain(t);
    for (const t of ["users", "invites", "generations", "instance_settings", "usage"])
      expect(names).toContain(t);
  });

  it("drops the retired columns", () => {
    expect(cols8("users")).not.toContain("allowed_tool_slugs");
    expect(cols8("invites")).not.toContain("allowed_tool_slugs");
    expect(cols8("generations")).not.toContain("project_id");
    expect(cols8("users")).toContain("disabled_at");
  });

  it("removes the retired settings keys and keeps the live ones", () => {
    expect(keys8()).toEqual([
      "assignedModels:t1",
      "enabledDomains",
      "enabledModels",
      "enabledSectors",
      "ownerUserId",
    ]);
  });

  it("removes open admin invites and keeps the open teacher invite", () => {
    const tokens = (
      db8.prepare("SELECT token FROM invites ORDER BY token").all() as { token: string }[]
    ).map((r) => r.token);
    expect(tokens).toEqual(["inv-admin-used", "inv-teacher"]);
  });

  it("keeps every generation of the teacher, and the kept columns of the users", () => {
    const gens = db8
      .prepare("SELECT id, output_markdown, input_json FROM generations ORDER BY id")
      .all();
    expect(gens).toEqual([
      { id: "g1", output_markdown: "out-g1", input_json: '{"x":1}' },
      { id: "g2", output_markdown: "out-g2", input_json: '{"x":1}' },
    ]);
    const u = db8.prepare("SELECT name, email, role FROM users WHERE id='t1'").get();
    expect(u).toEqual({ name: "Teacher One", email: "t@x.nl", role: "teacher" });
  });

  it("only uses DROP TABLE / DROP COLUMN plus the two settings clean-ups (no rebuild)", () => {
    const stmts = sqlOf18_8()
      .split("--> statement-breakpoint")
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    for (const s of stmts) {
      expect(s).toMatch(
        /^(DROP TABLE `\w+`;|ALTER TABLE `\w+` DROP COLUMN `\w+`;|DELETE FROM `(instance_settings|invites)` WHERE [^;]+;)$/,
      );
    }
    expect(stmts.some((s) => /CREATE TABLE|RENAME/i.test(s))).toBe(false);
  });
});
